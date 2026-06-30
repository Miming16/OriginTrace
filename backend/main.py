"""OriginTrace POC backend — wraps origintrace_poc.py behind a REST API."""
from datetime import datetime, timezone
import sqlite3
import re
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import origintrace_poc as ot

app = FastAPI(title="OriginTrace POC API")

DB_PATH = Path(__file__).with_name("origintrace.db")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                student_name TEXT NOT NULL,
                assignment_name TEXT NOT NULL,
                language TEXT NOT NULL,
                role TEXT NOT NULL,
                code TEXT NOT NULL,
                reference_code TEXT,
                risk_band TEXT NOT NULL,
                structural_similarity REAL NOT NULL,
                ai_residue_markers INTEGER NOT NULL,
                fingerprints INTEGER NOT NULL
            )
            """
        )


init_db()


def tokenize(code: str, language: str):
    """Prefer the AST node-type stream (rename-resistant). If tree-sitter isn't
    installed, fall back to a fine-grained tokenizer that splits words AND
    symbols, so the fingerprinter still has enough tokens to work with."""
    try:
        return ot.ast_token_stream(code, language)
    except Exception:
        # Fallback when tree-sitter isn't installed: split into words + symbols,
        # then normalize every alphanumeric token to "id" so that renaming a
        # variable does not change the structure (a coarse stand-in for the AST
        # node-type stream the real engine uses).
        raw = re.findall(r"\w+|[^\s\w]", code)
        return ["id" if t[0].isalnum() else t for t in raw]


class AnalyzeRequest(BaseModel):
    language: str = "python"
    code: str
    reference_code: Optional[str] = None
    role: str = "student"


class SubmitRequest(AnalyzeRequest):
    student_name: str = "Anonymous"
    assignment_name: str = "Chapter 1 POC"


class CompareRequest(BaseModel):
    submission_id: int
    reference_submission_id: int


@app.get("/")
def health():
    return {"status": "ok", "service": "OriginTrace POC"}


def build_analysis(req: AnalyzeRequest):
    fp_a = ot.winnow(tokenize(req.code, req.language), k=4, w=3)
    structural_sim = 0.0
    if req.reference_code:
        fp_b = ot.winnow(tokenize(req.reference_code, req.language), k=4, w=3)
        structural_sim = round(ot.similarity(fp_a, fp_b), 2)

    ai_residue = ot.scan_ai_residue(req.code)

    band = ot.risk_band(
        structural_sim=structural_sim,
        big_bang_ratio=0.0,
        msg_quality=1.0,
        author_mismatch=0,
        ai_residue=ai_residue,
    )

    return {
        "risk_band": band,
        "structural_similarity": structural_sim,
        "ai_residue_markers": ai_residue,
        "fingerprints": len(fp_a),
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    full = build_analysis(req)
    band = full["risk_band"]

    if req.role == "instructor":
        return {"role": "instructor", **full}
    return {
        "role": "student",
        "risk_band": band,
        "guidance": {
            "Low": "Looks original. Keep committing your work incrementally.",
            "Medium": "Some signals stand out. Review your work before submitting.",
            "High": "Strong overlap or pasted-content signals detected. Revise and resubmit.",
        }[band],
    }



@app.post("/submit")
def submit(req: SubmitRequest):
    analysis = build_analysis(req)
    created_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO submissions (
                created_at, student_name, assignment_name, language, role,
                code, reference_code, risk_band, structural_similarity,
                ai_residue_markers, fingerprints
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                req.student_name.strip() or "Anonymous",
                req.assignment_name.strip() or "Chapter 1 POC",
                req.language,
                req.role,
                req.code,
                req.reference_code,
                analysis["risk_band"],
                analysis["structural_similarity"],
                analysis["ai_residue_markers"],
                analysis["fingerprints"],
            ),
        )
        submission_id = cursor.lastrowid
    return {
        "submission_id": submission_id,
        "created_at": created_at,
        "student_name": req.student_name.strip() or "Anonymous",
        "assignment_name": req.assignment_name.strip() or "Chapter 1 POC",
        "role": req.role,
        **analysis,
    }



@app.get("/submissions")
def list_submissions(limit: int = 50):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, student_name, assignment_name, language, role,
                   risk_band, structural_similarity, ai_residue_markers, fingerprints,
                   substr(code, 1, 600) AS code_preview
            FROM submissions
            ORDER BY id DESC
            LIMIT ?
            """,
            (max(1, min(limit, 200)),),
        ).fetchall()
    return [dict(row) for row in rows]



@app.get("/submissions/{submission_id}")
def get_submission(submission_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return dict(row)



@app.post("/compare")
def compare_submissions(req: CompareRequest):
    with get_db() as conn:
        left = conn.execute("SELECT * FROM submissions WHERE id = ?", (req.submission_id,)).fetchone()
        right = conn.execute("SELECT * FROM submissions WHERE id = ?", (req.reference_submission_id,)).fetchone()
    if left is None or right is None:
        raise HTTPException(status_code=404, detail="One or both submissions not found")

    compare_req = AnalyzeRequest(
        language=left["language"],
        code=left["code"],
        reference_code=right["code"],
        role="instructor",
    )
    analysis = build_analysis(compare_req)
    return {
        "left_submission": {
            "id": left["id"],
            "student_name": left["student_name"],
            "assignment_name": left["assignment_name"],
            "language": left["language"],
        },
        "right_submission": {
            "id": right["id"],
            "student_name": right["student_name"],
            "assignment_name": right["assignment_name"],
            "language": right["language"],
        },
        **analysis,
    }
