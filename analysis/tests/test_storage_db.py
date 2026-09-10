"""WBS 3.2.3 / 3.2.2 -- fingerprint persistence in PostgreSQL.

Runs the real pipeline over a real directory and persists the result with the
service's own save_analysis(), against a real database. Skipped automatically
when DATABASE_URL is unset, so `pytest` stays green without one.
"""

from __future__ import annotations

import psycopg
import pytest

from app.config import DATABASE_URL
from app.db import save_analysis
from app.pipeline import analyze_directory

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is not set")

INT64_MAX = 2 ** 63 - 1
PROBE_URL = "https://example.test/storage-probe.git"


def connect():
    return psycopg.connect(DATABASE_URL)


@pytest.fixture
def student_id():
    """A throwaway student. Dropping the user cascades away every row this
    module wrote, so the suite leaves the database as it found it."""
    with connect() as conn:
        row = conn.execute(
            """INSERT INTO users (email, password_hash, role, full_name)
               VALUES ('storage-probe@origintrace.test', 'x', 'student', 'Storage Probe')
               RETURNING id""",
        ).fetchone()
        user = row[0]
    yield str(user)
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (user,))


@pytest.fixture
def source_tree(tmp_path):
    """Two python files, one of them nested, each long enough to fingerprint."""
    body = "\n".join(
        f"def function_{index}(alpha, bravo):\n"
        f"    charlie = alpha + bravo\n"
        f"    if charlie > {index}:\n"
        f"        return charlie\n"
        f"    return alpha\n"
        for index in range(12)
    )
    (tmp_path / "top.py").write_text(body, encoding="utf-8")
    nested = tmp_path / "package"
    nested.mkdir()
    (nested / "nested.py").write_text(body, encoding="utf-8")
    return tmp_path


@pytest.fixture
def result(source_tree):
    analysed = analyze_directory(source_tree, "python")
    assert analysed["files_included"] == 2
    assert analysed["fingerprints"], "the fixture produced no fingerprints"
    return analysed


def within_bigint(analysed: dict) -> dict:
    """The same result with hash values masked into signed BIGINT range.

    Only needed because of defect D-02 (winnow emits unsigned 64-bit hashes into
    a signed BIGINT column). Masking here lets the storage layer be verified on
    its own terms instead of failing on every run for an unrelated reason.
    """
    return {
        **analysed,
        "fingerprints": [
            {**fingerprint, "hash_value": fingerprint["hash_value"] & INT64_MAX}
            for fingerprint in analysed["fingerprints"]
        ],
    }


def test_fingerprints_are_stored_for_the_submission(student_id, result):
    storable = within_bigint(result)
    submission_id, matches = save_analysis(student_id, "git", PROBE_URL, False, storable)

    assert matches == [], "a fresh database reported similarity cluster members"
    with connect() as conn:
        rows = conn.execute(
            "SELECT file_path, hash_value, window_position FROM fingerprints WHERE submission_id = %s",
            (submission_id,),
        ).fetchall()
    assert len(rows) == len(storable["fingerprints"])
    assert all(-(2 ** 63) <= row[1] <= INT64_MAX for row in rows)


def test_stored_file_paths_are_relative_to_the_submission_root(student_id, result):
    submission_id, _ = save_analysis(student_id, "git", PROBE_URL, False, within_bigint(result))
    with connect() as conn:
        paths = {
            row[0]
            for row in conn.execute(
                "SELECT DISTINCT file_path FROM fingerprints WHERE submission_id = %s",
                (submission_id,),
            ).fetchall()
        }
    assert paths == {"top.py", "package/nested.py"}
    for path in paths:
        assert not path.startswith("/"), "an absolute path leaked into the database"
        assert "tmp" not in path, "a temporary directory name leaked into the database"


def test_no_duplicate_file_path_and_window_position_per_submission(student_id, result):
    submission_id, _ = save_analysis(student_id, "git", PROBE_URL, False, within_bigint(result))
    with connect() as conn:
        duplicates = conn.execute(
            """SELECT file_path, window_position, count(*)
               FROM fingerprints WHERE submission_id = %s
               GROUP BY file_path, window_position HAVING count(*) > 1""",
            (submission_id,),
        ).fetchall()
    assert duplicates == [], f"duplicate fingerprint records: {duplicates}"


def test_the_submission_and_its_risk_score_are_written_together(student_id, result):
    storable = within_bigint(result)
    submission_id, _ = save_analysis(student_id, "git", PROBE_URL, False, storable)
    with connect() as conn:
        submission = conn.execute(
            "SELECT student_id, source_type, source_url, language, is_self_check, status FROM submissions WHERE id = %s",
            (submission_id,),
        ).fetchone()
        risk = conn.execute(
            "SELECT risk_band, similarity_score, commit_flag_count, provenance_flag_count FROM risk_scores WHERE submission_id = %s",
            (submission_id,),
        ).fetchone()

    assert str(submission[0]) == student_id
    assert submission[1:6] == ("git", PROBE_URL, "python", False, "complete")
    assert risk[0] == storable["risk_band"]
    assert risk[2] == len(storable["commit_signals"])
    assert risk[3] == len(storable["provenance_flags"])


def test_a_second_identical_submission_is_clustered_with_the_first(student_id, result):
    storable = within_bigint(result)
    first_id, first_matches = save_analysis(student_id, "git", PROBE_URL, False, storable)
    second_id, second_matches = save_analysis(student_id, "git", PROBE_URL, False, storable)

    assert first_matches == []
    assert first_id in second_matches, "an identical resubmission was not matched to the first"

    with connect() as conn:
        members = {
            str(row[0])
            for row in conn.execute(
                """SELECT submission_id FROM similarity_cluster_members
                   WHERE cluster_id IN (
                     SELECT cluster_id FROM similarity_cluster_members WHERE submission_id = %s)""",
                (second_id,),
            ).fetchall()
        }
    assert {first_id, second_id} <= members


def test_deleting_the_submission_cascades_to_its_fingerprints(student_id, result):
    submission_id, _ = save_analysis(student_id, "git", PROBE_URL, False, within_bigint(result))
    with connect() as conn:
        conn.execute("DELETE FROM submissions WHERE id = %s", (submission_id,))
    with connect() as conn:
        remaining = conn.execute(
            "SELECT count(*) FROM fingerprints WHERE submission_id = %s", (submission_id,)
        ).fetchone()[0]
        scores = conn.execute(
            "SELECT count(*) FROM risk_scores WHERE submission_id = %s", (submission_id,)
        ).fetchone()[0]
    assert remaining == 0
    assert scores == 0


# --- Evidence for defects, not aspirations. -----------------------------------

def test_defect_d02_save_analysis_rejects_the_pipeline_its_own_output(student_id, result):
    """The unmodified pipeline result cannot be stored. winnow() emits unsigned
    64-bit hashes; fingerprints.hash_value is a signed BIGINT. Any submission
    with a hash above 2^63-1 aborts the whole save_analysis transaction, so the
    submission, its fingerprints and its risk score are all lost.

    Every other test in this module masks the hashes to get past this; this one
    proves the unmasked path is broken.
    """
    oversized = [f for f in result["fingerprints"] if f["hash_value"] > INT64_MAX]
    if not oversized:
        pytest.skip("this fixture happened to produce no out-of-range hashes; see D-02")

    with pytest.raises(psycopg.errors.NumericValueOutOfRange):
        save_analysis(student_id, "git", f"{PROBE_URL}#unmasked", False, result)

    with connect() as conn:
        orphan = conn.execute(
            "SELECT count(*) FROM submissions WHERE source_url = %s", (f"{PROBE_URL}#unmasked",)
        ).fetchone()[0]
    assert orphan == 0, "the failed save left a partial submission behind"
