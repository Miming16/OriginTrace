**Scope:** What the backend services and the PostgreSQL database must provide for the OriginTrace 50% build: services, authentication, data model, migrations, endpoints, business rules, and known gaps.

**Baseline:** `sprint50` at commit `92ce934` (assignments table and routes) plus the student and instructor assignment wiring. When the code changes, update this document in the same commit.

## 1. Services

| Service | Stack | Port | Responsibility |
|---|---|---|---|
| `db` | PostgreSQL 16 (Docker, `postgres-data` volume) | 5432 | All persistent data. Runs `db/migrations` on the first start of an empty volume. |
| `api` | Node 22, Express, `pg`, `bcryptjs`, `jsonwebtoken` | 8000 | Login, subjects, enrollments, assignments, dashboards, originality decisions. |
| `analysis` | Python 3.12, FastAPI, psycopg 3, tree-sitter | 8100 | Ingestion (Git clone or upload), AST fingerprinting, commit-history and provenance analysis, similarity, risk band. Writes submissions and all analysis results. |
| `frontend` | React 18, Vite | 5173 | Not in `docker compose`; run with `npm run dev` in `frontend/`. |

| Variable | Used by | Value / rule |
|---|---|---|
| `DATABASE_URL` | api, analysis | `postgres://origintrace:origintrace@db:5432/origintrace` inside compose |
| `JWT_SECRET` | api, analysis | Must be identical in both, or the analysis service rejects every token |
| `FRONTEND_ORIGIN` | api (CORS) | `http://localhost:5173`; the analysis service allows the same origin (hardcoded) |
| `MAX_UPLOAD_BYTES` | analysis | 26214400 (25 MB) |
| `SELF_CHECK_LIMIT` | analysis | Fallback daily limit when a subject has none (3) |

## 2. Authentication and roles

- **Login:** `POST /api/auth/login` with `{ idNumber, password }`. The ID number is trimmed; passwords are bcrypt hashes. Returns `{ token, user: { id, id_number, email, role, full_name } }`. Missing fields → 400; wrong ID or password → 401.
- **Token:** JWT (HS256), 8-hour expiry, payload `{ sub, role, email }`. Both services verify it with `JWT_SECRET`. The frontend keeps the token in memory only, so a page refresh requires logging in again.
- **Roles:** `student`, `instructor`, `admin`. No or invalid token → 401; valid token with the wrong role → 403.
- **Email:** still required and unique, but not used to log in. The analysis service compares commit author emails against it (`enrolled_email_mismatch`).

## 3. Data model

| Table | Purpose | Key columns and rules |
|---|---|---|
| `users` | Accounts | `id_number` unique, not blank; `email` unique, not blank; `role` ∈ student, instructor, admin; `full_name` not blank |
| `subjects` | A course section | `instructor_id` → users (cascade); `subject_code`, `subject_title`; `is_published` and `is_open` default **false**; `self_check_limit` default 3 |
| `enrollments` | Student ↔ subject | unique (`student_id`, `subject_id`); both cascade |
| `assignments` | Work inside a subject | `subject_id` → subjects (cascade); `title` not blank; `instructions`; `due_at` (optional) |
| `submissions` | One analysis run | `student_id` (cascade); `subject_id` and `assignment_id` (set null on delete); `source_type` ∈ git, upload; `language` ∈ c, javascript, python, php; `is_self_check`; `status` ∈ pending, processing, complete, failed |
| `fingerprints` | Winnowed AST hashes | `hash_value` BIGINT (63-bit masked); `file_path` relative, forward slashes; `window_position` ≥ 0 |
| `commit_signals` | Commit-history findings | `signal_type` ∈ big_bang_commit, zombie_code, low_message_entropy, history_metrics; `severity`; metrics: `commit_count`, `timespan_days`, `has_big_bang`, `low_entropy_count`, `author_committer_match_pct` (0–100) |
| `provenance_flags` | Authorship anomalies | `flag_type` ∈ author_committer_mismatch, enrolled_email_mismatch, timestamp_anomaly, embedded_authorship_marker, orphan_commit, history_rewritten; `severity`; `flag_level` HARD when severity is high, otherwise SOFT |
| `risk_scores` | One per submission | `risk_band` ∈ low, medium, high (stored lowercase); `similarity_score` 0–1; flag counts |
| `similarity_clusters`, `similarity_cluster_members` | Groups of matching final submissions | cluster `similarity_score` 0–1 |
| `originality_decisions` | Instructor's final call | one per submission; `decision` ∈ cleared, under_review, flagged; optional `note`; `instructor_id` → users |

Every table that hangs off `submissions` (fingerprints, signals, flags, scores, cluster members, decisions) cascades when a submission is deleted.

## 4. Migrations and seed data

| File | Change |
|---|---|
| `001_initial_schema.sql` | Core tables: users, submissions, fingerprints, commit_signals, provenance_flags, risk_scores, clusters, originality_decisions |
| `003_subjects_and_enrollments.sql` | `subjects`, `enrollments`, `submissions.subject_id` |
| `004_subject_self_check_limit.sql` | `subjects.self_check_limit` |
| `005_user_id_number.sql` | `users.id_number` (not null, unique, not blank) |
| `006_commit_history_metrics.sql` | Metric columns on `commit_signals` |
| `007_orphan_provenance_flag.sql` | Wider `flag_type` list |
| `008_history_metrics_signal.sql` | `history_metrics` signal type |
| `009_provenance_flag_level.sql` | `provenance_flags.flag_level` (safe to re-run) |
| `010_decision_note.sql` | `originality_decisions.note` |
| `011_assignments.sql` | `assignments`, `submissions.assignment_id` |

Rules:

- Never edit a migration that has already run anywhere. Add the next number instead.
- Docker runs migrations only when the volume is empty. To apply a new one to a running database without losing data: `Get-Content db\migrations\0NN_name.sql | docker compose exec -T db psql -U origintrace -d origintrace`.
- Migrations do not create accounts. After `docker compose down -v`, load `db/seeds/001_dev_users.sql` the same way.
- Development accounts (password `Passw0rd!`, development only): `2023018091` admin, `2023018092` instructor, `2023018093` student.

## 5. Express API (port 8000)

All routes except health and login require `Authorization: Bearer <token>`. Errors are JSON `{ error }`.

| Method and path | Role | Behaviour |
|---|---|---|
| `GET /api/health` | public | Liveness check |
| `POST /api/auth/login` | public | See section 2 |
| `GET /api/me` | any | Current user's public fields |
| `GET /api/student/subjects` | student | Subjects the student is enrolled in **and** that are published |
| `GET /api/student/subjects/:id/assignments` | student | Assignments in that subject with the student's own `self_checks`, `attempts`, `last_self_check_band` (uppercase); empty if not enrolled or unpublished |
| `GET /api/student/self-checks?subject_id=` | student | The student's own self-checks: subject, language, status, date, `risk_band` (uppercase) only |
| `GET /api/student/self-checks/quota?subject_id=` | student | `{ limit, used, remaining, window: 'daily' }` |
| `GET /api/instructor/subjects` | instructor | Own subjects with `enrolled_count`, `is_published`, `is_open`, `self_check_limit` |
| `POST /api/instructor/subjects` | instructor | Create an own subject (`subject_code`, `subject_title`, optional `self_check_limit`) |
| `PATCH /api/instructor/subjects/:id` | instructor | Set `is_published` and/or `is_open` on an own subject |
| `POST /api/instructor/subjects/:id/assignments` | instructor | Create an assignment (`title`, `instructions`, `due_at`) in an own subject; 404 otherwise |
| `GET /api/instructor/subjects/:id/assignments` | instructor | Assignments with `submission_count` (final submissions) |
| `GET /api/instructor/submissions?subject_id=&assignment_id=` | instructor | Final submissions in own subjects: student, subject, assignment title, language, status, date, `risk_band` (uppercase), `similarity_score`, `decision` |
| `GET /api/instructor/submissions/:id` | instructor | Full detail: `risk`, `peers` (matched students), `commit_signals`, `provenance_flags`, `decision`; 404 if not in an own subject |
| `POST /api/instructor/submissions/:id/decision` | instructor | Upsert `{ decision, note? }`; 404 if not in an own subject |
| `GET /api/admin/students`, `GET /api/admin/instructors` | admin | User lists for the enrollment screens |
| `GET /api/admin/subjects`, `POST /api/admin/subjects` | admin | List subjects; create one for an instructor (`subject_code`, `subject_title`, `instructor_id`) |
| `POST /api/admin/subjects/:id/enrollments` | admin | Enroll `{ student_id }`; 409 if already enrolled |
| `GET /api/admin/enrollments`, `GET /api/admin/subjects/:id/enrollments` | admin | Enrollment lists |
| `DELETE /api/admin/enrollments/:id` | admin | Remove an enrollment (204) |

A malformed UUID anywhere in a path or query returns 400 instead of 500.

## 6. Analysis service (port 8100)

`POST /api/analyze` (multipart form), role student or instructor. Errors are JSON `{ detail }`.

| Field | Rule |
|---|---|
| `source_url` or `upload` | Exactly one. Git URLs must be public (no credentials); the clone times out after 60 seconds. Uploads over 25 MB → 413. |
| `language` | `python`, `c`, `php` work end to end. `java` passes validation but the database rejects it (see gaps). |
| `is_self_check` | Students only. Requires `subject_id`. |
| `subject_id` | Required for self-checks and with `assignment_id`. |
| `assignment_id` | Optional. Must belong to `subject_id`. |

Checks, in order: 400 (bad input) → 404 (subject missing or unpublished, or assignment not in subject) → 403 (student not enrolled) → 409 (subject closed) → 429 (daily self-check limit reached).

Response: a **student** receives only `{ submission_id, risk_band, guidance }`. An **instructor** receives the full result: files analysed, boilerplate lines excluded, similarity score, matches, commit metrics, provenance flags, and cluster members.

## 7. Business rules

1. **Subject lifecycle.** An admin (or the instructor) creates a subject. It starts unpublished and closed. Publishing makes it visible to enrolled students; opening lets them submit. Closed subjects reject submissions (409).
2. **Two kinds of submission.** A *self-check* is private to the student: limited per day, never listed for instructors, never used as a similarity peer, and never clustered. A *final submission* is visible to the subject's instructor and can belong to an assignment.
3. **Self-check limit.** `subjects.self_check_limit` (default 3) per student, per subject, per calendar day. The day follows the database clock (UTC), so the count resets at 08:00 Philippine time.
4. **Similarity.** Source is parsed with tree-sitter, identifiers are normalised, and fingerprints come from k-grams (k = 5) winnowed with a window of 4 (Schleimer, Wilkerson and Aiken, 2003). Overlap = distinct shared fingerprints ÷ distinct fingerprints of the new submission (0 to 1). Comparison is only against **other students' final submissions**, across all subjects. A cluster is recorded when a final submission has matches.
5. **Risk band.** Overlap ≥ 0.60 → high, ≥ 0.35 → medium, otherwise low. Soft signals (a big-bang commit or any high-severity provenance flag) raise the band by one step at most; on their own they can lift low to medium but never to high.
6. **Commit history.** Full clone. Metrics stored per submission: commit count, timespan in days, big-bang commit, low-entropy messages, author–committer match percentage.
7. **Aggregate-only results for students.** The server returns only the band (plus the guidance sentence; see gaps) to a student. Instructors see the full detail.
8. **Originality decision.** Only the subject's instructor can decide. One decision per submission; a new one replaces the old one.
9. **Ownership.** Instructor queries always filter on `subjects.instructor_id = token.sub`; students only ever read their own rows.

## 8. Screen → data map

| Screen | Calls | Shows |
|---|---|---|
| Login | `POST /auth/login` | Role-based redirect |
| Student dashboard and History | `/student/self-checks`, `/student/self-checks/quota` | Own self-checks with band only; checks left today |
| Student Courses | `/student/subjects`, `/student/subjects/:id/assignments` | Assignments with deadline, status, own counts |
| Student self-check / submit | `POST :8100/api/analyze` with `subject_id` and `assignment_id` | Band only |
| Instructor dashboard | `/instructor/submissions`, `/instructor/submissions/:id`, `POST …/decision` | Final submissions, full detail, decision |
| Instructor Courses | `/instructor/subjects`, `/instructor/subjects/:id/assignments`, `/instructor/submissions?assignment_id=` | Assignments, create assignment, who submitted |
| Instructor subject settings | `PATCH /instructor/subjects/:id` | Publish/unpublish, open/close |
| Admin panel | `/admin/*` | Create subjects, enroll students |

## 9. Known gaps (outside the 50% build)

- **Assignment settings not stored:** points, attempt limit, per-assignment self-check limit, allowed languages, and "accept late" exist in the form only. `due_at` is stored but late submissions are still accepted.
- **Collaborator requests:** UI only; no table or route.
- **Zip uploads:** accepted but not extracted, so 0 files are analysed. Single-file uploads work.
- **Language list mismatch:** the analysis service accepts `java`, the database allows `javascript`. A Java submission fails when saved (500); JavaScript is rejected (400). The frontend currently sends `python` only.
- **Student guidance text:** the `guidance` sentence can reveal whether flags or matches exist, which conflicts with the team's no-hints decision for students.
- **Private repositories:** not supported; cloning needs internet access.
- **`docs/0.5_api_contract.yaml`:** still documents login by email; outdated.
- **Tests:** `npm test` passes 38/38 once `auth.db.test.js` expects `'Angeline Instructor'`. `pytest`: `test_storage_db.py` fixtures lack `id_number` (7 errors), and `test_the_same_repository_twice_is_clustered` still assumes a student's resubmission matches their own earlier work (1 failure).
