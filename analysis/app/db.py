from __future__ import annotations

from contextlib import contextmanager

import psycopg

from .config import DATABASE_URL
from .pipeline import risk_band

@contextmanager
def connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    with psycopg.connect(DATABASE_URL) as conn:
        yield conn


def student_checks_used(user_id: str) -> int:
    with connection() as conn:
        row = conn.execute("SELECT count(*) FROM submissions WHERE student_id = %s AND is_self_check = true AND submitted_at >= current_date", (user_id,)).fetchone()
        return int(row[0])


def validate_student_subject(user_id: str, subject_id: str) -> None:
    with connection() as conn:
        subject = conn.execute(
            """SELECT s.is_published, s.is_open
               FROM subjects s
               WHERE s.id = %s""",
            (subject_id,),
        ).fetchone()

    if not subject or not subject[0]:
        raise LookupError("Subject not found")

    with connection() as conn:
        enrolled = conn.execute(
            """SELECT 1 FROM enrollments
               WHERE subject_id = %s AND student_id = %s""",
            (subject_id, user_id),
        ).fetchone()

    if not enrolled:
        raise PermissionError("You are not enrolled in this subject")

    if not subject[1]:
        raise RuntimeError("This subject is closed for submissions")


def save_analysis(user_id: str, source_type: str, source_url: str, is_self_check: bool, result: dict, subject_id: str | None = None) -> tuple[str, list[str]]:
    with connection() as conn:
        submission = conn.execute("INSERT INTO submissions (student_id, subject_id, source_type, source_url, language, is_self_check, status) VALUES (%s, %s, %s, %s, %s, %s, 'complete') RETURNING id", (user_id, subject_id, source_type, source_url, result["language"], is_self_check)).fetchone()[0]
        for fingerprint in result["fingerprints"]:
            conn.execute("INSERT INTO fingerprints (submission_id, file_path, hash_value, window_position) VALUES (%s, %s, %s, %s)", (submission, fingerprint["file_path"], fingerprint["hash_value"], fingerprint["window_position"]))
        metrics = result.get("commit_metrics", {})
        for flag in result["commit_signals"]:
            if flag["signal_type"] != "author_committer_mismatch":
                conn.execute(
                    """INSERT INTO commit_signals
                       (submission_id, signal_type, severity, description,
                        commit_count, timespan_days, has_big_bang,
                        low_entropy_count, author_committer_match_pct)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (submission, flag["signal_type"], flag["severity"], flag["description"],
                     metrics.get("commit_count", 0), metrics.get("timespan_days", 0),
                     metrics.get("has_big_bang", False), metrics.get("low_entropy_count", 0),
                     metrics.get("author_committer_match_pct", 100)),
                )
        if not result["commit_signals"]:
            conn.execute(
                """INSERT INTO commit_signals
                   (submission_id, signal_type, severity, description,
                    commit_count, timespan_days, has_big_bang,
                    low_entropy_count, author_committer_match_pct)
                   VALUES (%s, 'history_metrics', 'low', %s, %s, %s, %s, %s, %s)""",
                (submission, "Commit-history metrics computed without a flagged signal.",
                 metrics.get("commit_count", 0), metrics.get("timespan_days", 0),
                 metrics.get("has_big_bang", False), metrics.get("low_entropy_count", 0),
                 metrics.get("author_committer_match_pct", 100)),
            )
        for flag in result["provenance_flags"]:
            conn.execute(
                """INSERT INTO provenance_flags
                   (submission_id, flag_type, severity, flag_level, description)
                   VALUES (%s, %s, %s, CASE WHEN %s = 'high' THEN 'HARD' ELSE 'SOFT' END, %s)""",
                (submission, flag["flag_type"], flag["severity"], flag["severity"], flag["description"]),
            )
        hashes = [f["hash_value"] for f in result["fingerprints"]]
        matches, overlap = [], 0.0
        if hashes:
            rows = conn.execute(
                """SELECT f.submission_id, u.full_name, f.file_path,
                          f.hash_value, f.window_position
                   FROM fingerprints f
                   JOIN submissions s ON s.id = f.submission_id
                   JOIN users u ON u.id = s.student_id
                   WHERE f.hash_value = ANY(%s) AND f.submission_id <> %s
                   ORDER BY f.submission_id, f.file_path, f.window_position""",
                (hashes, submission),
            ).fetchall()
            grouped_matches = {}
            for peer, student_name, file_path, hash_value, window_position in rows:
                match = grouped_matches.setdefault(str(peer), {
                    "peer_submission_id": str(peer),
                    "student_name": student_name,
                    "fragments": [],
                })
                match["fragments"].append({
                    "file_path": file_path,
                    "hash_value": int(hash_value),
                    "window_position": int(window_position),
                })
            matches = [
                {
                    **match,
                    "overlap_pct": round(100 * len(match["fragments"]) / len(hashes), 2),
                }
                for match in grouped_matches.values()
            ]
            matches.sort(key=lambda match: len(match["fragments"]), reverse=True)
            if matches:
                overlap = round(matches[0]["overlap_pct"] / 100, 4)

        band = risk_band(overlap, result["commit_signals"], result["provenance_flags"])

        conn.execute(
            """INSERT INTO risk_scores
                   (submission_id, risk_band, similarity_score,
                    commit_flag_count, provenance_flag_count)
               VALUES (%s, %s, %s, %s, %s)""",
            (submission, band, overlap,
             len(result["commit_signals"]), len(result["provenance_flags"])),
        )

        if matches:
            cluster = conn.execute(
                "INSERT INTO similarity_clusters (similarity_score) VALUES (%s) RETURNING id",
                (overlap,),
            ).fetchone()[0]
            for member in [str(submission), *[m["peer_submission_id"] for m in matches]]:
                conn.execute(
                    "INSERT INTO similarity_cluster_members (cluster_id, submission_id) VALUES (%s, %s)",
                    (cluster, member),
                )

        return str(submission), band, overlap, matches