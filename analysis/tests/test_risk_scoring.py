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
from app.pipeline import analyze_directory

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
        "provenance_flags",
        "similarity_score",
        "risk_band",
    }
    for fingerprint in result["fingerprints"]:
        assert set(fingerprint) == {"file_path", "hash_value", "window_position"}


def test_the_risk_band_matches_the_score_it_is_derived_from(tmp_path):
    """Internal consistency: band = f(similarity_score, flag counts), with the
    boundaries the pipeline uses. A drift between the two would silently
    mis-colour every row on the instructor dashboard."""
    for name, body in (("many", MANY_FUNCTIONS), ("few", FEW_CLASSES)):
        result = analyze_directory(write(tmp_path, name, body), "python")
        score = (
            result["similarity_score"]
            + 0.15 * len(result["commit_signals"])
            + 0.15 * len(result["provenance_flags"])
        )
        expected = "high" if score >= 0.75 else "medium" if score >= 0.35 else "low"
        assert result["risk_band"] == expected, f"{name}: band {result['risk_band']} does not match score {score:.4f}"


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

def test_defect_d18_similarity_score_measures_volume_not_similarity(tmp_path):
    """risk_scores.similarity_score and similarity_clusters.similarity_score are
    both fed by min(1.0, len(fingerprints) / 1000) -- a proxy for how much code
    was submitted. It never consults any other submission, so two files that
    share nothing at all still get non-zero 'similarity', and the larger one
    scores higher purely for being larger."""
    large = analyze_directory(write(tmp_path, "large", MANY_FUNCTIONS), "python")
    small = analyze_directory(write(tmp_path, "small", FEW_CLASSES), "python")

    shared = {f["hash_value"] for f in large["fingerprints"]} & {f["hash_value"] for f in small["fingerprints"]}
    assert shared == set(), "the fixtures accidentally overlap; pick different ones"

    assert large["similarity_score"] == round(min(1.0, len(large["fingerprints"]) / 1000), 4)
    assert small["similarity_score"] == round(min(1.0, len(small["fingerprints"]) / 1000), 4)
    assert large["similarity_score"] > small["similarity_score"] > 0, (
        "similarity_score is no longer a pure function of fingerprint count -- D-18 can be closed"
    )


@pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is not set")
def test_defect_d17_commit_flag_count_overcounts_the_rows_it_stores(tmp_path):
    """save_analysis() moves author_committer_mismatch out of commit_signals and
    into provenance_flags, but still sets risk_scores.commit_flag_count to the
    length of the original list. The stored count is then larger than the number
    of commit_signals rows an instructor could actually be shown."""
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
            """INSERT INTO users (email, password_hash, role, full_name)
               VALUES (gen_random_uuid() || '@risk.origintrace.test', 'x', 'student', 'Risk Probe')
               RETURNING id""",
        ).fetchone()[0]
    try:
        submission_id, _ = save_analysis(str(user_id), "git", "https://example.test/risk-probe.git", False, storable)
        with psycopg.connect(DATABASE_URL) as conn:
            stored_rows = conn.execute(
                "SELECT count(*) FROM commit_signals WHERE submission_id = %s", (submission_id,)
            ).fetchone()[0]
            recorded_count = conn.execute(
                "SELECT commit_flag_count FROM risk_scores WHERE submission_id = %s", (submission_id,)
            ).fetchone()[0]
        assert recorded_count == len(result["commit_signals"])
        assert stored_rows == recorded_count - 1, (
            "the count and the rows agree now -- D-17 can be closed"
        )
    finally:
        with psycopg.connect(DATABASE_URL) as conn:
            conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
