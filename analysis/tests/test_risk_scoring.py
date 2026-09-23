"""WBS 3.2.2 -- the fingerprint result format and the risk score derived from it.

analyze_directory() returns the record the whole system reasons about: a
similarity score, a risk band, and flag counts that are written into
risk_scores. These tests check that record for internal consistency, and record
where it does not mean what its column names say.
"""

from __future__ import annotations

import subprocess

import psycopg
import pytest

from app.config import DATABASE_URL
from app.pipeline import analyze_directory, risk_band

MANY_FUNCTIONS = "\n".join(f"def function_{index}(alpha, bravo):\n    return alpha + bravo\n" for index in range(20))
FEW_CLASSES = "\n".join(
    f"class Type{index}:\n"
    f"    value = {index}\n"
    f"    def drain(self):\n"
    f"        while self.value:\n"
    f"            self.value -= 1\n"
    for index in range(6)
)
INT64_MAX = 2 ** 63 - 1


def write(tmp_path, name, body):
    directory = tmp_path / name
    directory.mkdir()
    (directory / "module.py").write_text(body, encoding="utf-8")
    return directory


def test_the_result_record_has_the_documented_shape(tmp_path):
    result = analyze_directory(write(tmp_path, "one", MANY_FUNCTIONS), "python")
    assert set(result) == {
        "language",
        "files_included",
        "boilerplate_lines_excluded",
        "fingerprints",
        "commit_signals",
        "commit_metrics",
        "provenance_flags",
        "similarity_score",
        "risk_band",
    }
    for fingerprint in result["fingerprints"]:
        assert set(fingerprint) == {"file_path", "hash_value", "window_position"}


def test_commit_history_metrics_distinguish_single_and_multi_commit_repositories(tmp_path):
    def commit(repository, message, date):
        environment = {
            "GIT_AUTHOR_DATE": date,
            "GIT_COMMITTER_DATE": date,
        }
        subprocess.run(["git", "add", "-A"], cwd=repository, check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-q", "-m", message],
            cwd=repository, env={**__import__("os").environ, **environment}, check=True, capture_output=True,
        )

    single = write(tmp_path, "single", "\n".join(f"def function_{index}():\n    return {index}" for index in range(10)))
    multi = write(tmp_path, "multi", "\n".join(f"def function_{index}():\n    return {index}" for index in range(5)))
    for repository in (single, multi):
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repository, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "student@origintrace.test"], cwd=repository, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Student"], cwd=repository, check=True, capture_output=True)
    commit(single, "Add complete solution", "2026-01-01T00:00:00+00:00")
    commit(multi, "Start solution history", "2026-01-01T00:00:00+00:00")
    (multi / "module.py").write_text("\n".join(f"def function_{index}():\n    return {index}" for index in range(10)), encoding="utf-8")
    commit(multi, "Add remaining functions", "2026-01-03T00:00:00+00:00")

    single_result = analyze_directory(single, "python")
    single_metrics = single_result["commit_metrics"]
    multi_metrics = analyze_directory(multi, "python")["commit_metrics"]

    assert single_metrics["commit_count"] == 1
    assert single_metrics["has_big_bang"] is True
    assert any(flag["flag_type"] == "orphan_commit" for flag in single_result["provenance_flags"])
    assert multi_metrics == {
        "commit_count": 2,
        "timespan_days": 2.0,
        "has_big_bang": False,
        "low_entropy_count": 0,
        "author_committer_match_pct": 100.0,
    }


def test_duplicate_messages_and_enrolled_email_are_provenance_signals(tmp_path):
    repository = write(tmp_path, "history", "def answer():\n    return 42\n")
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repository, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "student@origintrace.test"], cwd=repository, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Student"], cwd=repository, check=True, capture_output=True)
    for index in range(2):
        if index:
            (repository / "module.py").write_text(f"def answer():\n    return {index}\n", encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repository, check=True, capture_output=True)
        subprocess.run(["git", "commit", "-q", "-m", "update"], cwd=repository, check=True, capture_output=True)

    result = analyze_directory(repository, "python", enrolled_email="enrolled@origintrace.test")
    assert result["commit_metrics"]["low_entropy_count"] == 2
    flags = {flag["flag_type"]: flag for flag in result["provenance_flags"]}
    assert flags["enrolled_email_mismatch"]["severity"] == "medium"


def test_identical_timestamps_and_orphan_root_are_hard_provenance_flags(tmp_path):
    repository = write(tmp_path, "suspicious", "def answer():\n    return 42\n")
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repository, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "student@origintrace.test"], cwd=repository, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Student"], cwd=repository, check=True, capture_output=True)
    environment = {**__import__("os").environ, "GIT_AUTHOR_DATE": "2026-01-01T00:00:00+00:00", "GIT_COMMITTER_DATE": "2026-01-01T00:00:00+00:00"}
    subprocess.run(["git", "add", "-A"], cwd=repository, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-q", "-m", "start"], cwd=repository, env=environment, check=True, capture_output=True)
    (repository / "module.py").write_text("def answer():\n    return 43\n", encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=repository, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-q", "-m", "update"], cwd=repository, env=environment, check=True, capture_output=True)

    result = analyze_directory(repository, "python")
    flags = {flag["flag_type"]: flag for flag in result["provenance_flags"]}
    assert flags["timestamp_anomaly"]["severity"] == "high"
    assert "orphan_commit" not in flags


def test_the_risk_band_matches_the_score_it_is_derived_from(tmp_path):
    """With no peer submissions, the pipeline delegates to the shared band rule."""
    for name, body in (("many", MANY_FUNCTIONS), ("few", FEW_CLASSES)):
        result = analyze_directory(write(tmp_path, name, body), "python")
        assert result["risk_band"] == risk_band(0.0, result["commit_signals"], result["provenance_flags"])


def test_a_directory_with_no_matching_source_files_still_returns_a_record(tmp_path):
    directory = tmp_path / "empty"
    directory.mkdir()
    (directory / "README.md").write_text("nothing to analyse", encoding="utf-8")
    result = analyze_directory(directory, "python")
    assert result["files_included"] == 0
    assert result["fingerprints"] == []
    assert result["similarity_score"] == 0.0
    assert result["risk_band"] in {"low", "medium", "high"}


# --- Evidence for defects, not aspirations. -----------------------------------

@pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is not set")
def test_commit_flag_count_matches_stored_commit_signal_rows(tmp_path):
    """Provenance flags are stored separately from commit-signal rows."""
    from app.db import save_analysis

    repository = write(tmp_path, "repo", MANY_FUNCTIONS)
    setup = [
        ["git", "init", "-q", "-b", "main"],
        ["git", "config", "user.email", "committer@origintrace.test"],
        ["git", "config", "user.name", "Committer"],
        ["git", "add", "-A"],
        ["git", "commit", "-q", "-m", "initial", "--author", "Author Else <author@origintrace.test>"],
    ]
    for command in setup:
        subprocess.run(command, cwd=repository, check=True, capture_output=True)

    result = analyze_directory(repository, "python")
    assert any(flag["flag_type"] == "author_committer_mismatch" for flag in result["provenance_flags"]), (
        "the fixture did not produce an author/committer mismatch"
    )
    storable = {
        **result,
        "fingerprints": [{**f, "hash_value": f["hash_value"] & INT64_MAX} for f in result["fingerprints"]],
    }

    with psycopg.connect(DATABASE_URL) as conn:
        user_id = conn.execute(
                """INSERT INTO users (id_number, email, password_hash, role, full_name)
                    VALUES (substr(md5(random()::text), 1, 20), gen_random_uuid() || '@risk.origintrace.test', 'x', 'student', 'Risk Probe')
               RETURNING id""",
        ).fetchone()[0]
    try:
        submission_id, _, _, _ = save_analysis(str(user_id), "git", "https://example.test/risk-probe.git", False, storable)
        with psycopg.connect(DATABASE_URL) as conn:
            stored_rows = conn.execute(
                "SELECT count(*) FROM commit_signals WHERE submission_id = %s", (submission_id,)
            ).fetchone()[0]
            recorded_count = conn.execute(
                "SELECT commit_flag_count FROM risk_scores WHERE submission_id = %s", (submission_id,)
            ).fetchone()[0]
        assert recorded_count == len(result["commit_signals"])
        assert stored_rows == recorded_count
    finally:
        with psycopg.connect(DATABASE_URL) as conn:
            conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
