# OriginTrace — Phase 1 verification report

**Scope.** Verify that the tools, dependencies and components already chosen and
built for Phase 1 of the WBS (epics 0.x–3.x) work, and leave automated tests
behind as evidence. No feature work, no redesign, no repairs: where something is
broken it is recorded as a defect with a reproduction.

**Base.** `ducut` @ `990f9ec`. All work sits on `staging`, branched from it.

**Run date.** 2026-09-10.

| | Before | After |
|---|---|---|
| Node tests (`cd backend; npm test`) | 5 pass | **38** — 38 pass with a database, 14 pass + 24 skipped without one |
| Python tests (`cd analysis; python -m pytest -q`) | 3 pass | **111** — 111 pass with a database, 84 pass + 27 skipped without one |
| Failures | 0 | 0 |

Every DB-backed test skips itself when `DATABASE_URL` is unset, so both suites
stay green with no database and no Docker. They clean up after themselves: after
a full run the database holds only the three seeded users.

> **The one finding that matters most.** `POST /api/analyze` answers **500 and
> stores nothing** for any submission larger than a toy file. A twelve-function
> Python file is already enough. See defect **D-02** — nothing else in Phase 1's
> ingestion or similarity work can be exercised end to end until it is fixed.

## Environment caveat

`docker compose up` could not be run: the verification shell had no Docker
socket. A real PostgreSQL 16.2 was used instead, with `001_initial_schema.sql`
applied verbatim, and both services were driven **in-process** (supertest for
Express, `fastapi.testclient` for FastAPI) against it. That covers the
application code the containers would run; it does not cover the containers
themselves. `docs/verification/ENVIRONMENT.md` lists every claim this excluded,
and `docs/verification/smoke.ps1` is the script that covers them — delivered
unexecuted, ready to run against a real stack.

Because there were also no git credentials, nothing has been pushed. See
[Pushing](#pushing) at the end.

## Reproducing this run

Neither image can run its own suite (D-20): `backend/Dockerfile` installs with
`npm ci --omit=dev` and copies only `src/`, and `analysis/Dockerfile` installs
only `requirements.txt` and copies only `app/`. Both suites therefore run
against the containerised database from outside the containers.

```powershell
# 1. fresh volume, stack up, dev users loaded
docker compose down -v
docker compose up --build -d
docker compose ps                       # wait for db / api / analysis to be healthy
Get-Content db/seeds/001_dev_users.sql -Raw |
    docker compose exec -T db psql -U origintrace -d origintrace

# 2. node suite, from the host
cd backend
npm install
npm test                                # 14 pass, 24 skipped (no DATABASE_URL)
$env:DATABASE_URL = 'postgres://origintrace:origintrace@localhost:5432/origintrace'
npm test                                # 38 pass
Remove-Item Env:\DATABASE_URL
cd ..

# 3. pytest, in a throwaway container with analysis/ mounted over /app -- it
#    joins the compose network and inherits DATABASE_URL=...@db:5432/...
docker compose run --rm -v "${PWD}/analysis:/app" -w /app analysis `
    sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q"   # 111 pass

# 4. the container-only checks
pwsh docs/verification/smoke.ps1
```

Run steps 2 and 3 in sequence, not in parallel: both suites write to the same
database.

## Phase 1 WBS status

Owners are the Jira assignees: **Balista** (`vjbal21054`), **Ducut**
(`angelineducut883`), **Mascardo** (`chadangelo.mascardo`). Frontend items are
`OUT OF SCOPE` for this run — that work lives on `origin/chadDev`.

### Epic 0.0 — Project Planning & Setup

| WBS | Item | Owner | What exists on `ducut` | How verified | Result | Notes |
|---|---|---|---|---|---|---|
| 0.1 | Requirements & Scope Finalization | — | `docs/0.1.2_*.md`, `docs/0.1.3_*.md` | file inventory of `ducut` | PASS-with-notes | one of the three sub-documents is not in the repo |
| 0.1.1 | Backend & Data Requirements | Balista | *not in the repo* | `git ls-tree -r ducut -- docs/` | PASS-with-notes | the document exists as `Capstone/testing/0.1.1-backend-data-requirements.md`, outside version control — it should be moved into `docs/` |
| 0.1.2 | User Stories & UI Acceptance Criteria | Mascardo | `docs/0.1.2_user_stories_and_acceptance_criteria.md` | file present | PASS | |
| 0.1.3 | Non-Functional & Integration Requirements | Ducut | `docs/0.1.3_non_functional_and_integration_requirements.md` | file present | PASS | |
| 0.2 | System Architecture Design | — | `docs/SA.png`, `docs/0.2.2_*.md`, `docs/0.2.3_*.md` | file inventory | PASS-with-notes | |
| 0.2.1 | Backend Service & Data-Flow Architecture | Balista | `docs/SA.png` only | file inventory | PASS-with-notes | a diagram with no accompanying data-flow document; the flow it describes is not written down anywhere reviewable |
| 0.2.2 | Frontend Architecture & Component Hierarchy | Mascardo | `docs/0.2.2_frontend_architecture.md` | file present | PASS | |
| 0.2.3 | Integration & Deployment Topology | Ducut | `docs/0.2.3_integration_and_deployment_topology.md`, `docker-compose.yml` | file present; compose file read | PASS | topology as *written* matches the compose file; it was not run — see D-19 |
| 0.3 | Database Schema Design | — | `db/migrations/001_initial_schema.sql` | `backend/test/schema.db.test.js` | PASS-with-notes | |
| 0.3.1 | Analysis & Scoring Tables | Balista | migration §51–109: `fingerprints`, `commit_signals`, `provenance_flags`, `risk_scores` | `migration creates exactly the nine tables it declares`; CHECK/index/FK tests | PASS-with-notes | D-02 — `fingerprints.hash_value` is too narrow for what the pipeline writes into it |
| 0.3.2 | User, Role & Submission Tables | Mascardo | migration §13–46; `docs/0.3.2_users_and_submissions_tables.md` | same tests, plus `users.role rejects a value outside the CHECK constraint` | PASS-with-notes | D-01 — `submissions.language` allows a language nothing can parse and rejects one that can |
| 0.3.3 | Constraints, Indexes & Migration Script | Ducut | whole migration | 9 FKs with delete rules, 18 CHECKs, 12 indexes, 4 unique constraints, all asserted; `docs/verification/schema-dump.txt` | PASS-with-notes | D-11, D-14 |
| 0.4 | UI/UX Wireframes | Mascardo | `design/wireframes/Instructordashboardwireframe.jsx`, `Studentselfcheckwireframe.jsx` | files present | PASS | |
| 0.5 | API Contract Definition | Ducut | `docs/0.5_api_contract.yaml` | `every status code documented in 0.5_api_contract.yaml is reachable` | PASS-with-notes | D-09, D-12, D-15 — the contract is reachable as written, but it omits `/auth/register` and `/submissions`, and puts `/analyze` on the wrong service |

### Epic 1.0 — Infrastructure & Authentication

| WBS | Item | Owner | What exists on `ducut` | How verified | Result | Notes |
|---|---|---|---|---|---|---|
| 1.1 | Docker Compose Setup | — | `docker-compose.yml` | — | **NOT VERIFIED** | no Docker in the verification shell |
| 1.1.1 | Compose Services: API & PostgreSQL Containers | Balista | `docker-compose.yml` `db` + `api` services, `backend/Dockerfile`, `analysis/Dockerfile` | read only; `docker compose up` not runnable | **NOT VERIFIED** | the file is complete and internally consistent: `postgres:16-alpine`, `node:22-alpine`, `python:3.12-slim`, healthchecks on all three, `api`/`analysis` gated on `db: service_healthy`. Build time, image sizes and actual health were not observed |
| 1.1.2 | Environment Config, Volumes & Container Networking | Ducut | compose `environment:` blocks, `postgres-data` volume, `backend/.env.example`, `frontend/.env.example` | env loading exercised via `dotenv` in every backend test; volume persistence and service-name DNS not runnable | PASS-with-notes | data survived a stop/start of the substitute PostgreSQL, which is a weaker check than a named-volume restart. `api → http://analysis:8100` was never resolved. D-19 |
| 1.2 | Backend Project Scaffolding | — | `backend/src/{app,auth,config,db,server}.js` | node suite | PASS-with-notes | |
| 1.2.1 | Backend Repo Structure & Database Connection Pool | Balista | `backend/src/db.js` (`pg.Pool`, lazy `requirePool`) | `WBS 1.2.1: twenty concurrent /api/me requests all succeed on the pool` | PASS | 20 concurrent requests through a default-size (10) pool all returned 200; the pool never exceeded its maximum |
| 1.2.2 | Linting, Environment Config & Application Entry Point | Ducut | `backend/src/config.js`, `backend/src/server.js` | `grep -n "lint" backend/package.json` → no match | PASS-with-notes | config loading and the entry point are present and work. **No linter is configured at all** — D-13 |
| 1.3 | PostgreSQL Schema Migration | Balista | `db/migrations/001_initial_schema.sql`; **new:** `db/seeds/001_dev_users.sql`, `db/seeds/README.md` | migration applied verbatim to PostgreSQL 16.2; 11 tests in `backend/test/schema.db.test.js`; seeds loaded twice to prove idempotency | PASS-with-notes | 9 tables, `gen_random_uuid()` working, invalid role rejected, user deletion cascading to submissions, fingerprints and risk scores. D-11 |
| 1.4 | Authentication Module (JWT + bcrypt) | Balista | `backend/src/auth.js`, `POST /api/auth/login` in `app.js` | `backend/test/auth.test.js` (9) and `auth.db.test.js` (13) | PASS-with-notes | login, its three failure modes, email normalisation, no `password_hash` in any response, forged/expired/malformed tokens all rejected. **`POST /auth/register`, which this WBS item names, does not exist** — D-04 |
| 1.4.1 | Role-Based Route Middleware | — | `allowRoles()` in `backend/src/auth.js` | node suite | PASS | |
| 1.4.1.1 | Role Enforcement Middleware Implementation | Balista | `allowRoles()` | `an admin token is forbidden on both role-scoped routes`, `a token carrying no role claim is forbidden` | PASS | |
| 1.4.1.2 | Route-Level Role Mapping & Integration Tests | Ducut | route wiring in `app.js` | `authentication is checked before role, and role before the database`; full status-code matrix | PASS | 401 and 403 are both decided before the pool is touched, so an unauthenticated request never costs a connection |
| 1.5 | Frontend Project Scaffolding | Mascardo | `frontend/` (Vite + React) | — | OUT OF SCOPE | |
| 1.5.1 | Login Page & Auth Flow | Mascardo | `frontend/src/pages/LoginPage.jsx`, `src/api/axios.js`, `src/context/AuthContext.jsx` | read only | OUT OF SCOPE | worth flagging for whoever merges `chadDev`: on `ducut` the login buttons post the hardcoded `demo@usjr.edu` / `demo123`, which matches no user the seeds or the schema can produce, so this page cannot authenticate against the real API as it stands |

### Epic 2.0 — Submission Ingestion Module

| WBS | Item | Owner | What exists on `ducut` | How verified | Result | Notes |
|---|---|---|---|---|---|---|
| 2.1 | Git Repository Ingestion | Balista | `analyze_git_url()` in `analysis/app/pipeline.py`; `POST /api/analyze` in `analysis/app/main.py` | `a git url is cloned analysed and stored`, `an unreachable repository fails cleanly inside the clone timeout` | **FAIL** | a clone of a real repository succeeds and is stored *only* while the file is small enough to dodge D-02. A bad URL fails cleanly with `Repository could not be cloned` inside the 60 s timeout. The WBS asks for "size/timeout limits" — the size half does not exist (D-10) |
| 2.1.1 | Source File Extraction by Language | — | `source_files()`, `SOURCE_EXTENSIONS` | pytest | PASS-with-notes | |
| 2.1.1.1 | Language Detection & Extension Filtering | Balista | `SOURCE_EXTENSIONS = {c: .c/.h, java: .java, python: .py, php: .php}` | `extension filtering is per language` | PASS-with-notes | filtering itself is exact — `.c` and `.h` for C, nothing for PHP in a Python tree. But this WBS item names `.js`, and `.js` is not in the table at all (D-06) |
| 2.1.1.2 | Extracted-File Summary in Submission View | Mascardo | — (API returns `files_included`) | — | OUT OF SCOPE | the data the view needs is present in the `/api/analyze` response |
| 2.1.1.3 | Vendor & Generated Path Exclusion Rules | Ducut | `IGNORED_PARTS` | `only source files outside vendor directories are analysed` | PASS | a tree containing `src/a.py`, `node_modules/x.py`, `vendor/y.py`, `build/z.py`, `dist/w.py`, `__pycache__/v.py` and `README.md` yields `files_included == 1`, and the single fingerprinted path is `src/a.py`. Lockfiles, also named in this item, are excluded for free — they match no source extension |
| 2.2 | Direct File Upload (Fallback) | Ducut | upload branch of `POST /api/analyze` | `DEFECT D-08: a zip upload is stored with zero files`, `an upload over the size limit is rejected with 413` | **FAIL** | the size limit works (`MAX_UPLOAD_BYTES` → 413). Everything else in this item does not: a `.zip` is never extracted. It is accepted, a submission row is written, and `files_included` is `0` — a silent no-op the student sees as success (D-08) |
| 2.3 | Boilerplate / Starter-Code Filter | Balista | `remove_boilerplate()`, `BOILERPLATE_PATTERNS` | 13 tests in `analysis/tests/test_winnowing.py`; `boilerplate_lines_excluded` cross-checked against the filter | PASS-with-notes | all four patterns strip correctly (`#include <…>`, `using namespace …`, the Python main guard in both quote styles, the Java `main`), and six lookalike lines are correctly left alone — including `int total = include_me(1);` and a comment containing the word "include". Narrow, though: `#include "local.h"` survives, and there are no patterns for the C++/Python/PHP scaffolds a starter project usually ships |

### Epic 3.0 — AST Structural Similarity Engine

| WBS | Item | Owner | What exists on `ducut` | How verified | Result | Notes |
|---|---|---|---|---|---|---|
| 3.1 | Tree-Sitter Parser Integration (C, Python, JS, PHP) | — | `LANGUAGE_MODULES`, `normalized_ast()` | `analysis/tests/test_grammars.py` (36) | PASS-with-notes | four grammars are integrated and all four parse — but the four are C, Python, PHP and **Java**, not JS (D-06) |
| 3.1.1 | Grammar Installation & Parser Wrapper | Balista | `analysis/requirements.txt` (`tree-sitter-c/java/php/python`), `normalized_ast()` | `parser wrapper covers exactly the configured languages`; per-language AST tests | PASS-with-notes | one wrapper over all four grammars, and `LANGUAGE_MODULES`, `SOURCE_EXTENSIONS` and `SUPPORTED_LANGUAGES` agree with each other exactly. D-06 |
| 3.1.2 | Parse-Output Verification Across All Four Languages | Ducut | — (this run *is* the verification) | `a grammar produces a non-empty ast` and `the expected declaration node` ×4; `a broken file yields error nodes instead of raising` ×4 | PASS-with-notes | each language yields the declaration node it should (`function_definition` for C/Python/PHP, `method_declaration` for Java) plus `if_statement` and `return_statement`. A deliberately malformed file per language produces `ERROR` nodes, raises nothing, and the pipeline still returns a result. **This item's note — "requires tree-sitter pinned to 0.21.3" — is obsolete on this branch**: it describes `tree_sitter_languages 1.10.2`, which is not used here. The per-language packages need tree-sitter ≥ 0.23; 0.25.2 is installed |
| 3.1.3 | AST Node Normalization | Balista | `normalized_ast()` — emits `node.type` for named nodes only | `normalisation leaks no identifier or string text` ×4, `renaming every identifier leaves the sequence identical` ×4, `changing control flow changes the sequence` ×4 | PASS-with-notes | the identifier and string-literal half of this item is **proved**, not assumed: no identifier name and no string content reaches the sequence in any of the four languages, renaming every identifier leaves it byte-identical, and `if → while` changes exactly one element. Comments are the exception — they survive (D-05) |
| 3.2 | Winnowing Fingerprinting Algorithm | — | `winnow()` | `analysis/tests/test_winnowing.py` (28 algorithm tests) | PASS-with-notes | |
| 3.2.1 | k-Gram Hashing & Minimum-Hash Window Selection | Balista | `winnow(values, k=5, window=4)` | k-boundary, strictly increasing positions, every selected hash is a window minimum, density bounds, determinism, single-token locality | PASS-with-notes | the algorithm is a correct self-implementation of Schleimer et al.: below `k` tokens it emits nothing, exactly `k` emits one, every selected hash really is the minimum of some window, and a single inserted token invalidates at most `k` hashes out of ~50 rather than shifting the whole file. Two problems are in the *output*, not the selection: D-02 (magnitude) and D-07 (absolute positions) |
| 3.2.2 | Fingerprint Output Format & Pipeline Wiring | Ducut | `analyze_directory()` result dict | `analysis/tests/test_risk_scoring.py` (5) | PASS-with-notes | the record shape is stable and the risk band always matches the score it is derived from. But `similarity_score` does not measure similarity (D-18) and `commit_flag_count` overcounts what is stored (D-17) |
| 3.2.3 | Fingerprint Storage in PostgreSQL | Balista | `save_analysis()` in `analysis/app/db.py` | `analysis/tests/test_storage_db.py` (7) | **FAIL** | with hashes masked into range, storage is correct in every respect — one row per fingerprint, relative paths with no temp-directory leakage, no duplicate `(file_path, window_position)`, submission and risk score written together, cascade on delete, and an identical resubmission correctly clustered with the first. **Unmasked, it cannot store the pipeline's own output at all** (D-02) |
| 3.3 | Instructor Dashboard Skeleton (Frontend) | Mascardo | `frontend/src/pages/instructor/Dashboard.jsx` | — | OUT OF SCOPE | |
| 3.4 | Student Self-Check Skeleton (Frontend) | Mascardo | `frontend/src/pages/student/SelfCheck.jsx` | — | OUT OF SCOPE | |
| 3.5 | Submission API Endpoints | Ducut | `POST /api/analyze` (analysis service), `GET /api/instructor/submissions` (API service) | `analysis/tests/test_ingestion_e2e.py` (19) | **NOT BUILT** | this item asks for `POST /submissions` (ingest + trigger the pipeline **async**) and `GET /submissions/:id` (status + result). Neither exists. What exists is a single synchronous `POST /api/analyze` that clones, parses, fingerprints and stores inside one request, and a list endpoint with no per-submission detail route. The `status` column already has `pending`/`processing` values that nothing can ever set (D-12) |

## Defects

Severity: **Critical** blocks the feature entirely · **Major** breaks a WBS
acceptance criterion · **Minor** correctness or hygiene worth fixing before it
compounds. Each has a test that passes today *because* the defect is present; if
one starts failing, the defect is fixed and the row can be closed.

### D-02 — `/api/analyze` returns 500 and stores nothing for any normal-sized submission — **Critical** — WBS 3.2.1, 3.2.3, 2.1

`winnow()` builds each hash as `int(sha256(...).hexdigest()[:16], 16)` — an
**unsigned** 64-bit value, up to 2^64−1. `fingerprints.hash_value` is `BIGINT`,
which is **signed**, so anything above 2^63−1 is rejected. `save_analysis()`
inserts fingerprints one by one inside a single transaction, so one out-of-range
hash rolls back the submission, its fingerprints and its risk score together.
`psycopg.errors.NumericValueOutOfRange` is not in the `except (OSError,
RuntimeError, ValueError)` clause in `main.py`, so it escapes as an unhandled
exception and the client gets a bare 500.

Min-hash selection biases the output low — the minimum of four uniform draws
exceeds 2^63 only about 6% of the time — which is exactly why this survived the
existing tests: a two-function file usually squeaks through, and a real one
never does.

*Repro:* `analysis/tests/test_ingestion_e2e.py::test_defect_d02_a_normal_sized_submission_returns_500`
— upload a twelve-function Python file to `POST /api/analyze`.
*Observed:* HTTP 500 `Internal Server Error`; `select count(*) from submissions` unchanged.
*Expected:* 200 with `files_included: 1` and a stored submission.
*Also covered by:* `test_storage_db.py::test_defect_d02_save_analysis_rejects_the_pipeline_its_own_output`, `test_winnowing.py::test_defect_d02_winnow_emits_hashes_too_large_for_the_bigint_column`, `schema.db.test.js` `DEFECT D-02`.

### D-01 — the supported-language sets disagree between the parser and the schema — **Critical** — WBS 0.3.2, 3.1.1

`SUPPORTED_LANGUAGES` is `{c, java, python, php}`. `submissions.language`'s CHECK
is `('c', 'javascript', 'python', 'php')`. The two overlap on three values and
disagree on the fourth in *both* directions: `javascript` is storable but
unparseable, and `java` is parseable but unstorable. A Java submission therefore
passes validation, gets cloned and fingerprinted, and only then dies on the
CHECK constraint — as another unhandled `psycopg` error, so another bare 500
after all the work is done. `docs/0.5_api_contract.yaml` sides with the parser
(`enum: [c, java, python, php]`), which makes the migration the odd one out.

*Repro:* `analysis/tests/test_ingestion_e2e.py::test_defect_d01_a_java_submission_returns_500`; also `schema.db.test.js` `DEFECT D-01`.
*Observed:* `language=java` → HTTP 500. Direct insert of `'java'` → `23514 check_violation`; `'javascript'` inserts happily.
*Expected:* one agreed set of languages across parser, schema and contract.

### D-08 — a `.zip` upload is accepted, never extracted, and recorded as a successful empty submission — **Major** — WBS 2.2

The upload branch writes the uploaded file into a temporary directory and calls
`analyze_directory()` on that directory. A `.zip` matches no entry in
`SOURCE_EXTENSIONS`, so it is skipped. The request still returns 200, a
submission row is still written, and a risk band is still computed — over
nothing. The student is told their work was analysed when no line of it was
read. WBS 2.2 is specifically "*Accept .zip upload; extract, validate file types
and size*"; only the size half exists.

*Repro:* `analysis/tests/test_ingestion_e2e.py::test_defect_d08_a_zip_upload_is_stored_with_zero_files`.
*Observed:* HTTP 200, `files_included: 0`, one submission row.
*Expected:* the archive extracted and its source files analysed, or an explicit rejection.

### D-06 — JavaScript is named everywhere and installed nowhere — **Major** — WBS 3.1, 3.1.1, 2.1.1.1

WBS 3.1 is "Tree-Sitter Parser Integration (**C, Python, JS, PHP**)", 2.1.1.1
asks for "`.c` / `.py` / **`.js`** / `.php`", and `submissions.language` allows
`javascript`. The service installs `tree-sitter-java` instead, and `.js` appears
in no extension table. Either the WBS and the migration are wrong about
JavaScript or the implementation is — but the four artefacts cannot all be right.

*Repro:* `analysis/tests/test_grammars.py::test_defect_d06_javascript_is_rejected_although_the_wbs_and_schema_expect_it`.
*Observed:* `validate_language("javascript")` raises `Unsupported language: javascript`; `.js` is in no `SOURCE_EXTENSIONS` entry.
*Expected:* a decision, recorded in one place, that the other three follow.

### D-18 — `similarity_score` measures how much code was submitted, not how similar it is — **Major** — WBS 3.2.2

`similarity_score = min(1.0, len(fingerprints) / 1000)`. It never looks at any
other submission. Two files that share no fingerprint at all both score non-zero,
and the larger one scores higher — for being larger. That number is written into
`risk_scores.similarity_score`, feeds the risk band, and is copied into
`similarity_clusters.similarity_score` as the cluster's score. So today the risk
band is, in effect, a measure of file size.

*Repro:* `analysis/tests/test_risk_scoring.py::test_defect_d18_similarity_score_measures_volume_not_similarity`.
*Observed:* two unrelated files with zero shared hashes score 0.078 and 0.046.
*Expected:* a score derived from fingerprint overlap with other submissions.

### D-03 — the self-check quota endpoint returns a constant — **Major** — WBS 1.4.1.2, 2.x

`GET /api/student/self-checks/quota` returns the literal
`{limit: 3, used: 0, remaining: 3, window: 'daily'}`. The analysis service
enforces the real limit correctly by counting rows, so a student is told they
have three checks left and is then refused with 429 on their fourth.

*Repro:* `backend/test/auth.db.test.js` `DEFECT D-03` — commit three self-checks for a student, then read the endpoint.
*Observed:* `used: 0, remaining: 3`, with three self-checks in the database for that student today.
*Expected:* `used: 3, remaining: 0` — the same count `student_checks_used()` already computes.

### D-04 — `POST /api/auth/register` does not exist — **Major** — WBS 1.4

WBS 1.4 is "*POST /auth/register and POST /auth/login*". Only login is built,
and the contract does not mention register either. Consequence: users can only
be created by direct SQL, which is why `db/seeds/001_dev_users.sql` had to be
written for this verification run in the first place.

*Repro:* `backend/test/auth.db.test.js` `DEFECT D-04`.
*Observed:* HTTP 404.
*Expected:* a registration endpoint, or the WBS item rescoped.

### D-10 — git ingestion has no size limit — **Major** — WBS 2.1

WBS 2.1 asks for a clone "*with size/timeout limits*". `analyze_git_url()` has
`--depth 50` and `timeout=60`, and nothing else. A shallow clone of a large
repository can still fill the container's disk inside sixty seconds, and every
file it contains is then parsed. `MAX_UPLOAD_BYTES` guards only the upload path.

*Repro:* `analysis/tests/test_ingestion_e2e.py::test_defect_d10_git_ingestion_has_a_timeout_and_depth_limit_but_no_size_limit`.
*Observed:* no size check anywhere in the clone path.
*Expected:* a byte or file-count ceiling, enforced after clone and before analysis.

### D-12 — WBS 3.5's submission endpoints are not built — **Major** — WBS 3.5, 0.5

`POST /submissions` (ingest + trigger the pipeline **asynchronously**) and
`GET /submissions/:id` (status + result) do not exist. Ingestion is one
synchronous `POST /api/analyze` on the analysis service that clones, parses,
fingerprints and stores inside a single HTTP request — so a large repository
holds a connection open for as long as it takes, and there is no way to poll.
`submissions.status` already has `pending` and `processing` in its CHECK
constraint; nothing can ever set them, because every row is written as
`complete` after the fact.

*Repro:* inspection; `docs/0.5_api_contract.yaml` has no `/submissions` path.
*Observed:* no such routes in `backend/src/app.js` or `analysis/app/main.py`.
*Expected:* the two endpoints, or the WBS item rescoped to what `/api/analyze` does.

### D-17 — `risk_scores.commit_flag_count` counts a row it does not store — **Minor** — WBS 3.2.2

`save_analysis()` skips `author_committer_mismatch` when writing `commit_signals`
(it goes into `provenance_flags` instead) but still sets `commit_flag_count` to
the length of the unfiltered list. An instructor shown "3 commit flags" can only
be given two of them.

*Repro:* `analysis/tests/test_risk_scoring.py::test_defect_d17_commit_flag_count_overcounts_the_rows_it_stores`.
*Observed:* 2 `commit_signals` rows, `commit_flag_count = 3`.
*Expected:* the count equals the rows stored.

### D-05 — comments survive AST normalisation — **Minor** — WBS 3.1.3

WBS 3.1.3 is "*Strip identifiers, string literals, comments*". Identifiers and
string literals are handled. Comments are not: `normalized_ast()` walks every
named node, and a comment is a named node, so `comment` (or `line_comment` in
Java) stays in the sequence. Adding or deleting a comment therefore moves a
file's fingerprints — which is exactly the trivial edit structural similarity is
supposed to be immune to.

*Repro:* `analysis/tests/test_grammars.py::test_defect_d05_comments_survive_normalisation`.
*Observed:* `normalized_ast("# note\nalpha = 1\n", "python") != normalized_ast("alpha = 1\n", "python")`.
*Expected:* identical sequences.

### D-07 — `window_position` is an absolute index, so one insertion renumbers every later fingerprint — **Minor** — WBS 3.2.1, 3.2.3

The hashes themselves are properly local: inserting one token changes at most
`k` of ~50. But the stored record is `(file_path, hash_value, window_position)`
and `window_position` is the k-gram's absolute index, so everything after the
insertion point shifts by one. Joining on `(path, position)` sees ~50% churn
where the algorithm produced ~2%. Only matters once cross-submission comparison
is written — which is Phase 2 — but it is cheaper to fix now than to work around
later.

*Repro:* `analysis/tests/test_winnowing.py::test_defect_d07_window_position_is_absolute_so_an_insertion_shifts_every_later_record`.
*Observed:* hash overlap 0.98 after a single-token insertion, `(position, hash)` overlap 0.51.
*Expected:* a position that survives an edit, or comparison keyed on hashes alone.

### D-09 — a missing form field is 422, not the documented 400 — **Minor** — WBS 0.5

FastAPI's own request validation answers 422 before the handler runs, so a
request missing `language` never reaches the `400` path the contract documents.

*Repro:* `analysis/tests/test_ingestion_e2e.py::test_defect_d09_a_missing_language_field_is_422_not_the_documented_400`.
*Observed:* HTTP 422 with FastAPI's error body.
*Expected:* 400, or 422 added to the contract.

### D-15 — the API contract puts `/analyze` on the wrong service — **Minor** — WBS 0.5

`docs/0.5_api_contract.yaml` declares one server, `http://localhost:8000/api`,
and lists `/analyze` under it. `/analyze` is served by the analysis service on
`http://localhost:8100`. A client generated from this contract would call the
wrong port.

*Repro:* read `docs/0.5_api_contract.yaml` against `docker-compose.yml`.
*Observed:* one `servers:` entry covering endpoints from two services.
*Expected:* both services declared, or `/analyze` moved to its own document.

### D-11 — the migration requires `pgcrypto` it does not need — **Minor** — WBS 0.3.3

`CREATE EXTENSION IF NOT EXISTS "pgcrypto"` exists for `gen_random_uuid()`, which
has been a core builtin since PostgreSQL 13. The compose file pins
`postgres:16-alpine`, so the extension is present and nothing breaks today —
but the dependency is real: any PostgreSQL build without contrib modules refuses
the migration for no reason. This is not hypothetical; it is exactly what
happened in this verification environment (see `ENVIRONMENT.md`).

*Repro:* apply the migration to a PostgreSQL 16 build without contrib.
*Observed:* `ERROR: could not open extension control file ... pgcrypto.control`.
*Expected:* the migration applies on any PostgreSQL 13+.

### D-20 — neither image can run its own test suite — **Minor** — WBS 1.1.1, 1.2.2

`backend/Dockerfile` runs `npm ci --omit=dev` and copies only `src/`, so the api
image has neither `supertest` nor `backend/test/`. `analysis/Dockerfile`
installs only `requirements.txt` and copies only `app/`, so the analysis image
has neither `pytest` nor `analysis/tests/`. Lean production images are the right
default, but the consequence is that there is no way to run either suite in the
environment the code actually ships in — CI has to reconstruct it from outside,
and a dependency that behaves differently on Python 3.12 or Alpine would not be
caught. A test stage in a multi-stage build, or a compose profile that mounts
the tests, would close it.

*Repro:* `docker compose exec analysis python -m pytest -q`.
*Observed:* `/usr/local/bin/python: No module named pytest`; `analysis/tests/` is not in the image either.
*Expected:* a supported way to run each suite inside its own image.

### D-13 — no linter is configured — **Minor** — WBS 1.2.2

WBS 1.2.2 is "*Linting, environment config and the service entry point*". The
config and entry point are built. There is no `lint` script and no ESLint,
Prettier, Ruff or Black configuration anywhere in `backend/`, `frontend/` or
`analysis/`.

*Repro:* `grep -rn "lint" backend/package.json frontend/package.json` → no match.
*Observed:* nothing configured.
*Expected:* a `lint` script per service that CI can run.

### D-14 — the migration's header comment contradicts the migration — **Minor** — WBS 0.3.3

The header says "*Scope: the 6 tables named in 0.3's description only*" and that
clusters, decisions and self-check rate limiting "*are tracked as a separate
follow-up task*". The file then creates nine tables including
`similarity_clusters`, `similarity_cluster_members` and `originality_decisions`.
Only the self-check rate-limiting table really is absent — the quota is enforced
by counting `submissions` rows instead, which works but is not what the comment
describes.

*Repro:* read `db/migrations/001_initial_schema.sql` lines 3–5 against lines 114–135.
*Observed:* comment says 6 tables and three deferrals; the file creates 9 and defers one.
*Expected:* the comment matches the file.

### D-19 — the container topology has never been observed running — **Major (process)** — WBS 1.1, 1.1.1, 1.1.2, 0.2.3

Not a code defect: a gap in evidence. Nothing in this run, and nothing recorded
anywhere else in the repository, demonstrates that `docker compose up --build`
produces three healthy containers that can reach each other. The compose file is
internally consistent on inspection, but "the API resolves `analysis:8100`" and
"the named volume survives a restart" remain claims. `docs/verification/smoke.ps1`
exists precisely to close this, and takes about a minute to run.

*Repro:* run `docker compose up --build -d` on a machine with Docker, then `pwsh docs/verification/smoke.ps1`.
*Observed:* not observed.
*Expected:* recorded output from a real bring-up attached to this report.

## Dependency & tool inventory

Versions as resolved during this run. Full captures:
`docs/verification/backend-npm-ls.txt`, `docs/verification/analysis-pip-freeze.txt`.
Both carry a caveat header — they were captured on the verification VM, not
inside the containers, because there was no Docker.

### Runtimes

| Tool | Pinned as | Resolved | Fit for purpose? |
|---|---|---|---|
| Node.js | `node:22-alpine` (`backend/Dockerfile`) | v22.23.2 | Yes — current LTS; `node --test` and `node:test` are stable here, which is why the suite needs no test framework |
| Python | `python:3.12-slim` (`analysis/Dockerfile`) | 3.10.12 in the verification VM | Yes, with a caveat — nothing in `analysis/app/` requires 3.11+, so 3.10 was a safe substitute, but the container's 3.12 behaviour is unobserved |
| PostgreSQL | `postgres:16-alpine` | 16.2 substitute | Yes — the migration applies cleanly and every constraint behaves as declared |
| git | container `apt-get install git` | 2.34.1 | Yes — `--depth 50` shallow clone is the right primitive for ingestion |
| Docker Compose | `docker-compose.yml` | **not exercised** | Unknown — see D-19 |

### Backend (`backend/package.json`)

| Package | Resolved | Fit for purpose? |
|---|---|---|
| `express` ^4.21.2 | 4.22.2 | Yes — the whole API is five routes; Express 4 is the boring correct choice |
| `pg` ^8.13.1 | 8.23.0 | Yes — pooling verified under 20 concurrent requests with no exhaustion |
| `bcryptjs` ^2.4.3 | 2.4.3 | Adequate — pure JS, so no native build in Alpine, at the cost of speed. Cost 10 is a reasonable default. Consider `bcrypt` or `argon2` if login latency ever matters |
| `jsonwebtoken` ^9.0.2 | 9.0.3 | Yes — HS256, 8 h expiry, and forged/expired/malformed tokens all correctly rejected |
| `cors` ^2.8.5 | 2.8.6 | Yes — locked to a single configured origin rather than `*` |
| `dotenv` ^16.4.5 | 16.6.1 | Yes |
| `supertest` ^7.0.0 (dev) | 7.2.2 | Yes — in-process HTTP without binding a port, which is what made this verification possible without Docker |
| *(a linter)* | **absent** | No — D-13 |

### Analysis (`analysis/requirements.txt`)

| Package | Pinned | Resolved | Fit for purpose? |
|---|---|---|---|
| `fastapi` | ==0.115.6 | 0.115.6 | Yes — multipart form handling and dependency injection are exactly what `/api/analyze` needs |
| `uvicorn[standard]` | ==0.34.0 | 0.34.0 | Yes |
| `psycopg[binary]` | ==3.2.13 | 3.2.13 | Yes — though every call site uses raw `conn.execute` with no error translation, which is how D-01 and D-02 surface as 500s instead of 400s |
| `PyJWT` | ==2.10.1 | 2.10.1 | Yes — verifies the same HS256 tokens the Express service issues, with a shared `JWT_SECRET` |
| `python-multipart` | ==0.0.20 | 0.0.20 | Yes |
| `tree-sitter` | >=0.23,<0.26 | 0.25.2 | Yes — and the range is right. WBS 3.1.2's "pin to 0.21.3" note is obsolete; it described `tree_sitter_languages`, which this branch does not use |
| `tree-sitter-c` | >=0.23 | 0.24.2 | Yes |
| `tree-sitter-java` | >=0.23 | 0.23.5 | Works, but see D-06 — this is where `tree-sitter-javascript` was expected |
| `tree-sitter-php` | >=0.23 | 0.24.1 | Yes — note `language_php()`, not `language()`, which the wrapper already handles |
| `tree-sitter-python` | >=0.23 | 0.25.0 | Yes |
| `pytest` (dev) | ==8.3.4 | 8.3.4 | Yes |
| `httpx` (dev) | **added by this run** | 0.28.1 | Needed — `fastapi.testclient.TestClient` does not work without it. Added to `analysis/requirements-dev.txt` |

One note on the unpinned tree-sitter ranges: they are convenient now, but a
fingerprint is only comparable to another fingerprint produced by the same
grammar version. If a grammar's node types change between builds, previously
stored fingerprints silently stop matching new ones. That argues for exact pins
before any fingerprint is kept longer than a test run.

## Recommendations for Phase 2

1. Fix D-02 first — until `/api/analyze` can store a normal file, nothing downstream can be tested at all.
2. Settle the language question once (D-01, D-06) and make parser, migration and contract follow that single decision.
3. Wrap `psycopg` calls so constraint violations become 4xx with a message, instead of escaping as bare 500s.
4. Replace `similarity_score` (D-18) with real fingerprint overlap before anyone reads a risk band as meaningful.
5. Build `/submissions` and make ingestion asynchronous (D-12) — `status` already has the states waiting for it.
6. Add a `lint` script per service (D-13) and run both suites plus `smoke.ps1` in CI on every push to `develop`.
7. Run `smoke.ps1` once on a machine with Docker and attach the output here — it closes D-19 in about a minute.
8. Pin the tree-sitter grammar versions exactly before any fingerprint outlives a test run.
9. Extract the shared `JWT_SECRET` and language list into one place both services read, rather than two copies that can drift.
10. Keep the DB-backed suites out of each other's way: they share one database, so run `npm test` and `pytest` in sequence, not in parallel.

## Pushing

Nothing from this run has been pushed — the verification shell had no git
credentials. Every branch is local, linear, and fast-forward only. From a shell
that can authenticate as a collaborator on `Miming16/OriginTrace`:

```powershell
git push -u origin staging
git push origin test/1.1-environment-inventory test/1.3-seed-and-schema `
              test/1.4-auth-and-roles test/3.1-tree-sitter-grammars `
              test/3.2-winnowing-and-storage test/3.2.2-risk-scoring `
              test/2.1-ingestion-e2e test/phase1-report
```

`staging → ducut` is left for the team to open after review. No protected branch
(`main`, `develop`, `ducut`, `Chad`, `balista`, `merge-test`,
`balista-integration`, `origin/POC`, `origin/chadDev`) was modified, committed
to, rebased or pushed during this run, and no product file was changed — every
commit touches only `backend/test/`, `analysis/tests/`, `db/seeds/` and
`docs/verification/`.
