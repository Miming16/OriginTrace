from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .auth import current_user, require_submission_role
from .config import MAX_UPLOAD_BYTES
from .db import save_analysis, student_check_limit, student_checks_used, validate_student_subject
from .pipeline import analyze_directory, analyze_git_url, validate_language

app = FastAPI(title="OriginTrace Analysis Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/api/analyze")
async def analyze(
    source_url: str | None = Form(default=None),
    language: str = Form(...),
    is_self_check: bool = Form(default=False),
    subject_id: str | None = Form(default=None),
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

    try:
        if source_url:
            result = analyze_git_url(source_url, language, enrolled_email=user.get("email"))
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
                result = analyze_directory(target.parent, language, enrolled_email=user.get("email"))
            source_type = "upload"
            source_value = upload.filename or "upload"
        submission_id, saved_band, overlap, cluster_members = save_analysis(user["sub"], source_type, source_value, is_self_check, result, subject_id)
    except HTTPException:
        raise
    except (OSError, RuntimeError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    public_flags = public_provenance_flags(result["provenance_flags"])
    legacy_cluster_members = [match["peer_submission_id"] for match in cluster_members]
    return {
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