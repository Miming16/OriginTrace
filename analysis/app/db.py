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
        for flag in result["commit_signals"]:
            if flag["signal_type"] != "author_committer_mismatch":
                conn.execute("INSERT INTO commit_signals (submission_id, signal_type, severity, description) VALUES (%s, %s, %s, %s)", (submission, flag["signal_type"], flag["severity"], flag["description"]))
        for flag in result["provenance_flags"]:
            conn.execute("INSERT INTO provenance_flags (submission_id, flag_type, severity, description) VALUES (%s, %s, %s, %s)", (submission, flag["flag_type"], flag["severity"], flag["description"]))
        conn.execute("INSERT INTO risk_scores (submission_id, risk_band, similarity_score, commit_flag_count, provenance_flag_count) VALUES (%s, %s, %s, %s, %s)", (submission, result["risk_band"], result["similarity_score"], len(result["commit_signals"]), len(result["provenance_flags"])))
        hashes = [f["hash_value"] for f in result["fingerprints"]]
        matches, overlap = [], 0.0
        if hashes:
            rows = conn.execute(
                """SELECT submission_id, count(*) AS shared
                   FROM fingerprints
                   WHERE hash_value = ANY(%s) AND submission_id <> %s
                   GROUP BY submission_id
                   ORDER BY shared DESC
                   LIMIT 20""",
                (hashes, submission),
            ).fetchall()
            matches = [
                {"submission_id": str(peer), "shared": int(shared),
                 "overlap": round(int(shared) / len(hashes), 4)}
                for peer, shared in rows
            ]
            if matches:
                overlap = matches[0]["overlap"]

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
            for member in [str(submission), *[m["submission_id"] for m in matches]]:
                conn.execute(
                    "INSERT INTO similarity_cluster_members (cluster_id, submission_id) VALUES (%s, %s)",
                    (cluster, member),
                )

        return str(submission), band, overlap, matches