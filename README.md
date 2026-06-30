# OriginTrace — POC Web App

A minimal React (Vite + Tailwind) front end with a FastAPI back end that runs the
OriginTrace detection POC. Includes both the **student self-check** and
**instructor full-detail** views.

```
OriginTrace_App/
├── backend/      FastAPI API wrapping origintrace_poc.py
└── frontend/     Vite + React + Tailwind UI
```

## Prerequisites (install on your VM)

- **Python 3.10+**  →  https://www.python.org/downloads/
- **Node.js 18+ and npm**  →  https://nodejs.org/  (LTS)

Check they're installed:
```bash
python --version
node --version
npm --version
```

## 1. Back end (FastAPI)

```bash
cd OriginTrace_App/backend

# create + activate a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# install dependencies
pip install -r requirements.txt

# run the API (http://localhost:8000)
uvicorn main:app --reload
```
Leave this terminal running. Visit http://localhost:8000 — you should see
`{"status":"ok"}`. Interactive API docs are at http://localhost:8000/docs.

> Note: `tree_sitter_languages` powers AST parsing. If it fails to install on
> your machine, the backend automatically falls back to simple tokenization so
> the demo still works — you can revisit AST parsing later.

## 2. Front end (React + Vite)

Open a **second** terminal:
```bash
cd OriginTrace_App/frontend

npm install
npm run dev
```
Open the URL it prints (usually http://localhost:5173).

## Using it

1. Pick **Student** or **Instructor** (top right).
2. In **Student** mode, enter your name, assignment, choose the language, paste
   your code, and click **Submit Code**. The backend stores the submission for later review.
3. In **Instructor** mode, load the stored submissions list, pick any two entries,
   and click **Compare Stored Submissions**.
4. **Student** sees the Low / Medium / High band plus guidance.
5. **Instructor** sees the comparison breakdown (similarity %, residue markers,
   fingerprints) and the saved code previews.

Both views still use the same analysis pipeline, but the student flow now stores
each submission locally so the instructor can review and compare saved work later.

Stored submissions are kept in `backend/origintrace.db`.

## What's a POC vs. full system

- Implemented: structural similarity (winnowing), AI/authorship residue scan,
  rule-based risk band, dual-audience output.
- Not in this paste-only demo: commit-pattern and provenance signals (those need
  a linked Git repository) and persistence (PostgreSQL). The backend already has
  the functions for these in `origintrace_poc.py`.
