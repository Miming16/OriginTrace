# Phase 1 verification — environment of record

This file documents **where** the Phase 1 verification run was executed and, more
importantly, **which checks the environment could not perform**. Every "NOT
VERIFIED" row in `PHASE1_VERIFICATION.md` traces back to a limitation listed here.

## Execution environment

| | |
|---|---|
| Repository | `OriginTrace`, branch `staging` (created from `ducut` @ `990f9ec`) |
| Shell | Isolated Linux VM (Ubuntu 22.04, x86_64) with the Windows repo folder mounted |
| Node.js | v22.23.2 (`backend/Dockerfile` pins `node:22-alpine` — same major) |
| npm | 10.9.8 |
| Python | 3.10.12 (`analysis/Dockerfile` pins `python:3.12-slim` — **differs**) |
| PostgreSQL | 16.2, from the `pgserver` wheel (`docker-compose.yml` uses `postgres:16-alpine` — same major/minor family) |
| git | 2.34.1 |

## Substitutions made, and why

**1. No Docker.** The verification shell has no Docker socket, so
`docker compose up --build` could not be run and the three containers never
existed. Instead:

- **Database** — a real PostgreSQL 16.2 was started on `127.0.0.1:55432` and
  `db/migrations/001_initial_schema.sql` was applied to it **verbatim**. All
  schema, constraint, seed and fingerprint-storage checks ran against that real
  server, not a mock.
- **API service** — the Express app is imported in-process
  (`backend/test/*.test.js` via `supertest`), exactly as the five pre-existing
  tests already do. `DATABASE_URL` points at the PostgreSQL above.
- **Analysis service** — the FastAPI app is imported in-process
  (`fastapi.testclient.TestClient`, backed by `httpx`). `DATABASE_URL` points at
  the same PostgreSQL.

This exercises the same application code the containers would run. What it does
**not** exercise is anything that only exists once containers exist.

**2. `pgcrypto` is not shipped with the `pgserver` PostgreSQL build.** It bundles
only `plpgsql` and `vector`. To let `001_initial_schema.sql` apply **without
editing it**, an empty `pgcrypto` extension control file was placed in the
verification VM's PostgreSQL extension directory (outside the repository).
`gen_random_uuid()` still resolves, because it has been a core builtin since
PostgreSQL 13 — the stub adds no functions. The `postgres:16-alpine` image does
ship the real `pgcrypto`, so this is a limitation of the substitute server only.
See defect **D-11**: the migration's dependency on `pgcrypto` is unnecessary on
PostgreSQL 13+.

**3. No git credentials.** `git fetch` and `git push` both fail with
`could not read Username for 'https://github.com'`. Consequences:

- `git fetch --all --prune` could not be run. Branch positions were read from the
  remote-tracking refs already in the clone; `git branch -vv` showed
  `ducut` level with `origin/ducut` at `990f9ec` and no ahead/behind marker.
- No branch created by this run has been pushed. They exist locally only, and
  the push commands are listed in `PHASE1_VERIFICATION.md`.

## Checks the environment could not perform

| Claim | Why not verified |
|---|---|
| Image build time, image sizes, build-log warnings | No Docker |
| `db` / `api` / `analysis` reach `healthy` via their compose healthchecks | No Docker |
| Named volume `postgres-data` survives `docker compose restart db` | No Docker; a stop/start of the substitute server was used as a weaker substitute |
| Containers resolve each other by service name (`http://analysis:8100`) | No Docker network |
| Published ports 5432 / 8000 / 8100 on the host | No Docker |
| `docs/verification/smoke.ps1` executed against live services | No Docker; the script is delivered unexecuted, and every assertion in it is covered in-process instead |
| Python 3.12 behaviour of the analysis service | VM has 3.10; no syntax in `analysis/app/` requires 3.11+ (`X | None` unions are quoted by `from __future__ import annotations`) |
| `origin/chadDev` frontend work | Out of scope for this run |
