from __future__ import annotations

import os
import shutil
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import current_user, require_submission_role
from .config import DEMO_MODE, MAX_UPLOAD_BYTES, VISUALIZER_DIR
from .db import connection, save_analysis, student_check_limit, student_checks_used, validate_assignment, validate_student_subject
from .logger import RunLog, log_status, new_run_id, short_id
from .pipeline import analyze_directory, analyze_git_url, risk_band, validate_language


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Status lines for service start, database reachability and shutdown."""
    log_status("start", service="analysis", pid=os.getpid())
    try:
        with connection() as conn:
            conn.execute("SELECT 1")
        log_status("db", status="ok")
    except Exception as error:
        log_status("db", "E", status="down", error=error)
    yield
    log_status("stop", service="analysis")


app = FastAPI(title="OriginTrace Analysis Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """One status line per request. Passing health checks and CORS preflights are skipped."""
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        log_status("error", "E", method=request.method, path=request.url.path, status=500, error=f"{type(error).__name__}: {error}")
        raise
    quiet = request.method == "OPTIONS" or request.url.path == "/api/health" or request.url.path.startswith("/visualizer")
    if not quiet or response.status_code >= 400:
        level = "E" if response.status_code >= 500 else "W" if response.status_code >= 400 else "I"
        log_status("req", level, method=request.method, path=request.url.path, status=response.status_code, ms=int((time.perf_counter() - started) * 1000))
    return response


if DEMO_MODE:
    # Live demo for visualizer/index.html: open http://localhost:8100/visualizer/
    from .demo import router as demo_router

    app.include_router(demo_router)
    if Path(VISUALIZER_DIR).is_dir():
        app.mount("/visualizer", StaticFiles(directory=VISUALIZER_DIR, html=True), name="visualizer")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "origintrace-analysis"}


def guidance_for(risk_band: str, provenance_flags: list[dict], matches: list[dict]) -> str:
    if risk_band == "high":
        return "Review the matched fragments and commit history with your instructor before submitting."
    if provenance_flags:
        return "Review the provenance flags and keep a clear record of your development history."
    if matches:
        return "Review the matched fragments and revise any code that is not your own."
    return "No significant structural or provenance concerns were detected."


def public_provenance_flags(flags: list[dict]) -> list[dict]:
    return [
        {
            "flag_type": flag["flag_type"],
            "flag_level": "HARD" if flag.get("severity") == "high" else "SOFT",
            "description": flag["description"],
        }
        for flag in flags
    ]


def log_outcome(log: RunLog, result: dict, band: str, overlap: float, matches: list[dict], submission_id: str) -> None:
    """How the risk band was reached: closest peers, the band from overlap alone, then the soft flags that raised it."""
    for match in matches[:5]:
        log.write("match", peer=short_id(match["peer_submission_id"]), pct=match["overlap_pct"], frags=len(match["fragments"]))
    soft = [signal["signal_type"] for signal in result["commit_signals"] if signal["signal_type"] == "big_bang_commit"]
    soft += [flag["flag_type"] for flag in result["provenance_flags"] if flag["severity"] == "high"]
    log.write("risk", overlap=overlap, base=risk_band(overlap, [], []), soft=",".join(soft) or "-", band=band, peers=len(matches))
    log.write("done", submission=submission_id, ms=log.ms())


@app.post("/api/analyze")
async def analyze(
    source_url: str | None = Form(default=None),
    language: str = Form(...),
    is_self_check: bool = Form(default=False),
    subject_id: str | None = Form(default=None),
    assignment_id: str | None = Form(default=None),
    upload: UploadFile | None = File(default=None),
    user: dict = Depends(current_user),
) -> dict:
    user = require_submission_role(user)
    if bool(source_url) == bool(upload):
        raise HTTPException(status_code=400, detail="Provide exactly one repository URL or upload")
    try:
        validate_language(language)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if is_self_check and user["role"] != "student":
        raise HTTPException(status_code=400, detail="Only students may create self-checks")
    if is_self_check and not subject_id:
        raise HTTPException(status_code=400, detail="subject_id is required for self-checks")
    if is_self_check:
        try:
            validate_student_subject(user["sub"], subject_id)
        except PermissionError as error:
            raise HTTPException(status_code=403, detail=str(error)) from error
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
    if is_self_check and student_checks_used(user["sub"], subject_id) >= student_check_limit(subject_id):
        raise HTTPException(status_code=429, detail="Daily self-check limit reached")

    if assignment_id:
        if not subject_id:
            raise HTTPException(status_code=400, detail="subject_id is required with assignment_id")
        try:
            validate_assignment(assignment_id, subject_id)
            if not is_self_check and user["role"] == "student":
                validate_student_subject(user["sub"], subject_id)
        except PermissionError as error:
            raise HTTPException(status_code=403, detail=str(error)) from error
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        
    run_id = new_run_id()
    with RunLog("analysis", run_id) as log:
        log.write(
            "start",
            user=short_id(user["sub"]),
            role=user["role"],
            src="git" if source_url else "upload",
            source=source_url or upload.filename,
            lang=language.lower().strip(),
            self_check=is_self_check,
            subject=short_id(subject_id),
            assignment=short_id(assignment_id),
        )
        try:
            if source_url:
                result = analyze_git_url(source_url, language, enrolled_email=user.get("email"), run_id=run_id, log=log)
                source_type = "git"
                source_value = source_url
            else:
                with tempfile.TemporaryDirectory() as directory:
                    target = Path(directory) / (upload.filename or "upload")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    size = 0
                    with target.open("wb") as output:
                        while chunk := await upload.read(1024 * 1024):
                            size += len(chunk)
                            if size > MAX_UPLOAD_BYTES:
                                raise HTTPException(status_code=413, detail="Upload exceeds size limit")
                            output.write(chunk)
                    result = analyze_directory(target.parent, language, enrolled_email=user.get("email"), log=log)
                source_type = "upload"
                source_value = upload.filename or "upload"
            submission_id, saved_band, overlap, cluster_members = save_analysis(user["sub"], source_type, source_value, is_self_check, result, subject_id, assignment_id)
        except HTTPException:
            raise
        except (OSError, RuntimeError, ValueError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        log_outcome(log, result, saved_band, overlap, cluster_members, submission_id)
    public_flags = public_provenance_flags(result["provenance_flags"])
    legacy_cluster_members = [match["peer_submission_id"] for match in cluster_members]
    response = {
        "submission_id": submission_id,
        "risk_band": saved_band.upper(),
        "structural_score": round(overlap * 100, 2),
        "matches": cluster_members,
        "commit_signals": result["commit_metrics"],
        "provenance_flags": public_flags,
        "guidance": guidance_for(saved_band, public_flags, cluster_members),
        "files_included": result["files_included"],
        "boilerplate_lines_excluded": result["boilerplate_lines_excluded"],
        "similarity_score": overlap,
        "commit_metrics": result["commit_metrics"],
        "similarity_cluster_members": legacy_cluster_members,
    }
    if user["role"] == "student":
        return {
            "submission_id": response["submission_id"],
            "risk_band": response["risk_band"],
            "guidance": response["guidance"],
        }
    return response