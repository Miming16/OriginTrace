"""WBS 2.1 / 2.1.1.1 / 2.1.1.3 / 2.2 / 3.5 -- ingestion through the running app.

Drives the FastAPI application itself with fastapi.testclient, against a real
database, so the request/response contract, the auth and validation gates, the
self-check quota and the clone path are exercised end to end rather than at the
function level.

Docker was not available in the verification environment, so the app is mounted
in-process instead of being reached over http://localhost:8100. The
request-handling path is identical; what is not covered is the container, its
healthcheck and its published port. docs/verification/smoke.ps1 covers those
against a real `docker compose up` and is delivered unexecuted.

`raise_server_exceptions=False` is deliberate: two of the cases below make the
service raise an unhandled exception, and the point of the test is to record the
500 a real client would see.
"""

from __future__ import annotations

import inspect
import io
import subprocess
import zipfile
from pathlib import Path

import jwt
import psycopg
import pytest
from fastapi.testclient import TestClient

from app import pipeline
from app.config import DATABASE_URL, JWT_SECRET, SELF_CHECK_LIMIT
from app.main import app

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is not set")

INT64_MAX = 2 ** 63 - 1

# Two functions: small enough that every fingerprint fits in a signed BIGINT, so
# the happy-path tests are deterministic instead of hostage to defect D-02.
SMALL_SOURCE = "\n".join(f"def function_{index}(alpha, bravo):\n    return alpha + bravo\n" for index in range(2))

# Twelve branching functions: large enough that at least one fingerprint exceeds
# a signed BIGINT. Used only to demonstrate D-02.
LARGE_SOURCE = "\n".join(
    f"def function_{index}(alpha, bravo):\n"
    f"    charlie = alpha + bravo\n"
    f"    if charlie > {index}:\n"
    f"        return charlie\n"
    f"    return alpha\n"
    for index in range(12)
)


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def make_user(role: str) -> str:
    with psycopg.connect(DATABASE_URL) as conn:
        return str(
            conn.execute(
                """INSERT INTO users (email, password_hash, role, full_name)
                   VALUES (gen_random_uuid() || '@e2e.origintrace.test', 'x', %s, 'E2E Probe')
                   RETURNING id""",
                (role,),
            ).fetchone()[0]
        )


def drop_user(user_id: str) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))


@pytest.fixture
def student():
    """A student with no submission history, so quota tests start from zero.
    Dropping the user cascades away everything the test created."""
    user_id = make_user("student")
    yield user_id
    drop_user(user_id)


@pytest.fixture
def self_check_subject(student):
    with psycopg.connect(DATABASE_URL) as conn:
        subject_id = str(
            conn.execute(
                """INSERT INTO subjects (instructor_id, subject_code, subject_title, is_published, is_open)
                   VALUES (%s, 'E2E-SC', 'E2E Self Check', true, true)
                   RETURNING id""",
                (student,),
            ).fetchone()[0]
        )
        conn.execute(
            "INSERT INTO enrollments (student_id, subject_id) VALUES (%s, %s)",
            (student, subject_id),
        )
    yield subject_id
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("DELETE FROM subjects WHERE id = %s", (subject_id,))


@pytest.fixture
def instructor():
    user_id = make_user("instructor")
    yield user_id
    drop_user(user_id)


@pytest.fixture
def administrator():
    user_id = make_user("admin")
    yield user_id
    drop_user(user_id)


def auth(user_id: str, role: str) -> dict:
    token = jwt.encode(
        {"sub": user_id, "role": role, "email": f"{role}@e2e.origintrace.test"},
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def upload(name: str, content) -> dict:
    return {"upload": (name, content, "application/octet-stream")}


@pytest.fixture
def git_repository(tmp_path):
    """A real local git repository, cloned over file:// so the clone path is
    exercised without depending on the network."""
    repository = tmp_path / "repository"
    repository.mkdir()
    (repository / "solution.py").write_text(SMALL_SOURCE, encoding="utf-8")
    commands = [
        ["git", "init", "-q", "-b", "main"],
        ["git", "config", "user.email", "probe@origintrace.test"],
        ["git", "config", "user.name", "Ingestion Probe"],
        ["git", "add", "-A"],
        ["git", "commit", "-q", "-m", "Add the initial solution module"],
    ]
    for command in commands:
        subprocess.run(command, cwd=repository, check=True, capture_output=True)
    return f"file://{repository}"


# --- health and the auth gate -------------------------------------------------

def test_health_endpoint_shape(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "origintrace-analysis"}


def test_analyze_requires_authentication(client):
    response = client.post("/api/analyze", data={"language": "python"}, files=upload("a.py", SMALL_SOURCE))
    assert response.status_code == 401


def test_analyze_forbids_the_admin_role(client, administrator):
    response = client.post(
        "/api/analyze",
        data={"language": "python"},
        files=upload("a.py", SMALL_SOURCE),
        headers=auth(administrator, "admin"),
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Instructor or student role required"


# --- 2.1 / 2.2 source selection and validation --------------------------------

def test_exactly_one_source_is_required(client, student):
    neither = client.post("/api/analyze", data={"language": "python"}, headers=auth(student, "student"))
    assert neither.status_code == 400
    assert neither.json()["detail"] == "Provide exactly one repository URL or upload"

    both = client.post(
        "/api/analyze",
        data={"language": "python", "source_url": "https://example.test/repo.git"},
        files=upload("a.py", SMALL_SOURCE),
        headers=auth(student, "student"),
    )
    assert both.status_code == 400
    assert both.json()["detail"] == "Provide exactly one repository URL or upload"


def test_an_unsupported_language_is_rejected_before_any_work(client, student):
    response = client.post(
        "/api/analyze",
        data={"language": "javascript"},
        files=upload("a.js", "const alpha = 1;"),
        headers=auth(student, "student"),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported language: javascript"


def test_only_students_may_create_self_checks(client, instructor):
    response = client.post(
        "/api/analyze",
        data={"language": "python", "is_self_check": "true"},
        files=upload("a.py", SMALL_SOURCE),
        headers=auth(instructor, "instructor"),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Only students may create self-checks"


def test_an_unreachable_repository_fails_cleanly_inside_the_clone_timeout(client, student):
    response = client.post(
        "/api/analyze",
        data={"language": "python", "source_url": "https://example.invalid/does-not-exist.git"},
        headers=auth(student, "student"),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Repository could not be cloned"


def test_an_upload_over_the_size_limit_is_rejected_with_413(client, student, monkeypatch):
    monkeypatch.setattr("app.main.MAX_UPLOAD_BYTES", 64)
    response = client.post(
        "/api/analyze",
        data={"language": "python"},
        files=upload("big.py", "x" * 5000),
        headers=auth(student, "student"),
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Upload exceeds size limit"


# --- 2.1 the happy path -------------------------------------------------------

def test_a_git_url_is_cloned_analysed_and_stored(client, student, git_repository):
    response = client.post(
        "/api/analyze",
        data={"language": "python", "source_url": git_repository},
        headers=auth(student, "student"),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {
        "submission_id",
        "risk_band",
        "files_included",
        "boilerplate_lines_excluded",
        "similarity_score",
        "commit_metrics",
        "commit_signals",
        "provenance_flags",
        "similarity_cluster_members",
    }
    assert body["files_included"] == 1
    assert body["risk_band"] in {"low", "medium", "high"}
    assert body["similarity_cluster_members"] == []

    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "SELECT source_type, source_url, language, status FROM submissions WHERE id = %s",
            (body["submission_id"],),
        ).fetchone()
        fingerprints = conn.execute(
            "SELECT count(*) FROM fingerprints WHERE submission_id = %s", (body["submission_id"],)
        ).fetchone()[0]
    assert row == ("git", git_repository, "python", "complete")
    assert fingerprints > 0


def test_the_same_repository_twice_is_clustered(client, student, git_repository):
    headers = auth(student, "student")
    first = client.post("/api/analyze", data={"language": "python", "source_url": git_repository}, headers=headers)
    second = client.post("/api/analyze", data={"language": "python", "source_url": git_repository}, headers=headers)
    assert first.status_code == 200 and second.status_code == 200

    assert first.json()["submission_id"] in second.json()["similarity_cluster_members"], (
        "resubmitting the same repository did not cluster it with the first submission"
    )


def test_an_instructor_sees_the_ingested_row_with_its_risk_band(client, student, instructor, git_repository):
    """The Express API's instructor list is this exact query. Running it here
    proves ingestion leaves a row the dashboard can render."""
    response = client.post(
        "/api/analyze",
        data={"language": "python", "source_url": git_repository},
        headers=auth(student, "student"),
    )
    assert response.status_code == 200

    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            """SELECT s.id, u.full_name, s.language, s.status, r.risk_band
               FROM submissions s
               JOIN users u ON u.id = s.student_id
               LEFT JOIN risk_scores r ON r.submission_id = s.id
               WHERE s.student_id = %s
               ORDER BY s.submitted_at DESC""",
            (student,),
        ).fetchall()
    assert len(rows) == 1
    assert str(rows[0][0]) == response.json()["submission_id"]
    assert rows[0][2:] == ("python", "complete", response.json()["risk_band"])
    assert rows[0][4] is not None, "the dashboard would show an empty risk band"


def test_the_self_check_quota_is_enforced_on_the_fourth_attempt(client, student, self_check_subject):
    headers = auth(student, "student")
    for attempt in range(1, SELF_CHECK_LIMIT + 1):
        response = client.post(
            "/api/analyze",
            data={"language": "python", "is_self_check": "true", "subject_id": self_check_subject},
            files=upload("a.py", SMALL_SOURCE),
            headers=headers,
        )
        assert response.status_code == 200, f"self-check {attempt} failed: {response.text}"

    blocked = client.post(
        "/api/analyze",
        data={"language": "python", "is_self_check": "true", "subject_id": self_check_subject},
        files=upload("a.py", SMALL_SOURCE),
        headers=headers,
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Daily self-check limit reached"


def test_closed_subject_rejects_self_check(client, student, self_check_subject):
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("UPDATE subjects SET is_open = false WHERE id = %s", (self_check_subject,))

    response = client.post(
        "/api/analyze",
        data={"language": "python", "is_self_check": "true", "subject_id": self_check_subject},
        files=upload("a.py", SMALL_SOURCE),
        headers=auth(student, "student"),
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "This subject is closed for submissions"


def test_unenrolled_student_rejects_self_check(client, student, instructor):
    with psycopg.connect(DATABASE_URL) as conn:
        subject_id = str(
            conn.execute(
                """INSERT INTO subjects (instructor_id, subject_code, subject_title, is_published, is_open)
                   VALUES (%s, 'E2E-UE', 'E2E Unenrolled', true, true)
                   RETURNING id""",
                (instructor,),
            ).fetchone()[0]
        )
    try:
        response = client.post(
            "/api/analyze",
            data={"language": "python", "is_self_check": "true", "subject_id": subject_id},
            files=upload("a.py", SMALL_SOURCE),
            headers=auth(student, "student"),
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "You are not enrolled in this subject"
    finally:
        with psycopg.connect(DATABASE_URL) as conn:
            conn.execute("DELETE FROM subjects WHERE id = %s", (subject_id,))


# --- 2.1.1.1 / 2.1.1.3 file selection (in-process, no database needed) --------

def test_only_source_files_outside_vendor_directories_are_analysed(tmp_path):
    for relative in ("src/a.py", "node_modules/x.py", "vendor/y.py", "build/z.py", "dist/w.py", "__pycache__/v.py"):
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(SMALL_SOURCE, encoding="utf-8")
    (tmp_path / "README.md").write_text("not source", encoding="utf-8")

    result = pipeline.analyze_directory(tmp_path, "python")
    assert result["files_included"] == 1
    assert {fingerprint["file_path"] for fingerprint in result["fingerprints"]} == {"src/a.py"}


def test_extension_filtering_is_per_language(tmp_path):
    (tmp_path / "a.py").write_text(SMALL_SOURCE, encoding="utf-8")
    (tmp_path / "b.c").write_text("int alpha(int bravo) { return bravo; }\n", encoding="utf-8")
    (tmp_path / "c.h").write_text("int alpha(int bravo);\n", encoding="utf-8")

    assert pipeline.analyze_directory(tmp_path, "python")["files_included"] == 1
    assert pipeline.analyze_directory(tmp_path, "c")["files_included"] == 2  # .c and .h
    assert pipeline.analyze_directory(tmp_path, "php")["files_included"] == 0


# --- Evidence for defects, not aspirations. -----------------------------------

def test_a_normal_sized_submission_is_stored_and_returns_200(client, student):
    """Regression guard for D-02. winnow() masks every hash to 63 bits, so a
    normal-sized file fits fingerprints.hash_value (signed BIGINT) and saves
    instead of rolling the whole transaction back with a 500."""
    fingerprints = pipeline.winnow(pipeline.normalized_ast(LARGE_SOURCE, "python"))
    assert fingerprints, "fixture produced no fingerprints"
    assert all(0 <= f["hash_value"] <= INT64_MAX for f in fingerprints), \
        "winnow emitted a value too large for the BIGINT column"

    response = client.post(
        "/api/analyze",
        data={"language": "python"},
        files=upload("large.py", LARGE_SOURCE),
        headers=auth(student, "student"),
    )
    assert response.status_code == 200, response.text

    with psycopg.connect(DATABASE_URL) as conn:
        stored = conn.execute(
            """SELECT count(*) FROM fingerprints f
               JOIN submissions s ON s.id = f.submission_id
               WHERE s.student_id = %s""",
            (student,),
        ).fetchone()[0]
    assert stored > 0, "no fingerprints were stored -- the save rolled back"


def test_defect_d08_a_zip_upload_is_stored_with_zero_files(client, student):
    """WBS 2.2 asks for '.zip upload; extract, validate file types and size'.
    The upload path writes the single uploaded file into a temp directory and
    analyses that directory, so a .zip matches no source extension: the request
    succeeds, a submission row is created, and nothing was actually analysed."""
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("src/solution.py", SMALL_SOURCE)

    response = client.post(
        "/api/analyze",
        data={"language": "python"},
        files=upload("submission.zip", archive.getvalue()),
        headers=auth(student, "student"),
    )
    assert response.status_code == 200
    assert response.json()["files_included"] == 0, "zip extraction appears to work now -- D-08 can be closed"

    with psycopg.connect(DATABASE_URL) as conn:
        stored = conn.execute(
            "SELECT count(*) FROM submissions WHERE student_id = %s", (student,)
        ).fetchone()[0]
    assert stored == 1, "a submission with nothing in it was still recorded"


def test_defect_d01_a_java_submission_returns_500(client, student, tmp_path):
    """validate_language accepts 'java' but submissions.language does not, so the
    request dies on the CHECK constraint after the analysis has already run."""
    response = client.post(
        "/api/analyze",
        data={"language": "java"},
        files=upload("Alpha.java", "class Alpha { int bravo(int charlie) { return charlie; } }\n"),
        headers=auth(student, "student"),
    )
    assert response.status_code == 500, "java submissions now succeed -- D-01 can be closed"


def test_defect_d09_a_missing_language_field_is_422_not_the_documented_400(client, student):
    """docs/0.5_api_contract.yaml documents 400 for an invalid request body.
    FastAPI's own validation answers 422 before the handler runs."""
    response = client.post(
        "/api/analyze",
        files=upload("a.py", SMALL_SOURCE),
        headers=auth(student, "student"),
    )
    assert response.status_code == 422, "the handler now returns the documented 400 -- D-09 can be closed"


def test_defect_d10_git_ingestion_has_a_timeout_and_depth_limit_but_no_size_limit():
    """WBS 2.1 asks for a clone with 'size/timeout limits'. Only the timeout and
    a shallow depth exist; nothing bounds how large the cloned tree may be, and
    MAX_UPLOAD_BYTES applies to uploads only."""
    source = inspect.getsource(pipeline.analyze_git_url)
    assert "timeout=60" in source, "the clone timeout is gone"
    assert "--depth" in source
    assert "MAX_UPLOAD_BYTES" not in source
    assert not any(token in source for token in ("--filter", "max_size", "MAX_REPO", "st_size")), (
        "a repository size limit appears to exist now -- D-10 can be closed"
    )
