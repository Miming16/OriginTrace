from __future__ import annotations

from contextlib import contextmanager

import psycopg

from .config import DATABASE_URL


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


def save_analysis(user_id: str, source_type: str, source_url: str, is_self_check: bool, result: dict) -> tuple[str, list[str]]:
    with connection() as conn:
        submission = conn.execute("INSERT INTO submissions (student_id, source_type, source_url, language, is_self_check, status) VALUES (%s, %s, %s, %s, %s, 'complete') RETURNING id", (user_id, source_type, source_url, result["language"], is_self_check)).fetchone()[0]
        for fingerprint in result["fingerprints"]:
            conn.execute("INSERT INTO fingerprints (submission_id, file_path, hash_value, window_position) VALUES (%s, %s, %s, %s)", (submission, fingerprint["file_path"], fingerprint["hash_value"], fingerprint["window_position"]))
        for flag in result["commit_signals"]:
            if flag["signal_type"] != "author_committer_mismatch":
                conn.execute("INSERT INTO commit_signals (submission_id, signal_type, severity, description) VALUES (%s, %s, %s, %s)", (submission, flag["signal_type"], flag["severity"], flag["description"]))
        for flag in result["provenance_flags"]:
            conn.execute("INSERT INTO provenance_flags (submission_id, flag_type, severity, description) VALUES (%s, %s, %s, %s)", (submission, flag["flag_type"], flag["severity"], flag["description"]))
        conn.execute("INSERT INTO risk_scores (submission_id, risk_band, similarity_score, commit_flag_count, provenance_flag_count) VALUES (%s, %s, %s, %s, %s)", (submission, result["risk_band"], result["similarity_score"], len(result["commit_signals"]), len(result["provenance_flags"])))
        hashes = [fingerprint["hash_value"] for fingerprint in result["fingerprints"]]
        matches = []
        if hashes:
            rows = conn.execute("SELECT DISTINCT submission_id FROM fingerprints WHERE hash_value = ANY(%s) AND submission_id <> %s", (hashes, submission)).fetchall()
            matches = [str(row[0]) for row in rows]
        if matches:
            cluster = conn.execute("INSERT INTO similarity_clusters (similarity_score) VALUES (%s) RETURNING id", (result["similarity_score"],)).fetchone()[0]
            for member in [str(submission), *matches]:
                conn.execute("INSERT INTO similarity_cluster_members (cluster_id, submission_id) VALUES (%s, %s)", (cluster, member))
        return str(submission), matches