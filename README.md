# OriginTrace

OriginTrace is a role-based code submission review prototype. The repository contains a Vite/React frontend, an Express authentication API, a Python analysis service, and a PostgreSQL schema for submissions, AST fingerprints, commit/provenance signals, risk scores, similarity clusters, decisions, and rate limiting.

## Requirements

- Windows, macOS, or Linux
- Docker Desktop with Docker Compose v2 and a running Docker engine
- Node.js 18 or newer and npm for the frontend
- Node.js 22 or newer only if running the Express API outside Docker
- Python 3.12 or newer only if running the analysis service outside Docker
- Git, if running the analysis service outside Docker

The recommended Docker setup installs the API and analysis-service dependencies automatically. Git is installed inside the analysis image because repository ingestion uses `git clone`.

## Run With Docker

1. Open Docker Desktop and confirm that the Docker engine is running.

2. Open PowerShell in the repository root:

```powershell
cd "C:\Users\enote\OneDrive\Documents\Capstone"
```

3. On the first run, or after schema changes, recreate the database volume:

```powershell
docker compose down -v
```

This deletes the local PostgreSQL data volume. Do not use `-v` when you need to preserve existing local data.

4. Build and start PostgreSQL, the Node API, and the Python analysis service:

```powershell
docker compose up --build
```

Leave this terminal running.

5. Open a second PowerShell window and start the frontend:

```powershell
cd "C:\Users\enote\OneDrive\Documents\Capstone\frontend"
npm install
npm run dev
```

6. Open the frontend URL printed by Vite, normally `http://localhost:5173`. If port 5173 is already in use, Vite may choose `http://localhost:5174`.

Services:

- Frontend: `http://localhost:5173` or the alternate Vite port shown in the terminal
- Express API: `http://localhost:8000`
- Python analysis service: `http://localhost:8100`
- PostgreSQL: `localhost:5432`

Verify both backend services from PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
Invoke-RestMethod http://localhost:8100/api/health
```

Both commands should return a JSON object with `status` set to `ok`.

The first PostgreSQL startup runs [001_initial_schema.sql](db/migrations/001_initial_schema.sql) automatically. The database uses a named Docker volume so data survives normal container restarts.

## Environment Variables

Copy the examples when running services outside Docker:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Backend variables in [backend/.env.example](backend/.env.example):

| Variable | Purpose | Default/example |
|---|---|---|
| `PORT` | API port | `8000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://origintrace:origintrace@localhost:5432/origintrace` |
| `JWT_SECRET` | JWT signing secret | Replace with a long random value |
| `FRONTEND_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

Frontend variable in [frontend/.env.example](frontend/.env.example):

| Variable | Purpose | Default/example |
|---|---|---|
| `VITE_API_BASE_URL` | API base URL used by Axios | `http://localhost:8000/api` |

Do not commit `.env` files or real secrets.

## Run Services Locally

Use this option when actively developing backend code outside Docker. Start PostgreSQL in Docker:

```powershell
docker compose up db
```

In another terminal, start the Node API:

```powershell
Push-Location backend
npm install
Copy-Item .env.example .env
npm run dev
Pop-Location
```

In a third terminal, install the Python analysis dependencies and start the analysis service:

```powershell
Push-Location analysis
python -m pip install -r requirements-dev.txt
$env:DATABASE_URL = "postgres://origintrace:origintrace@localhost:5432/origintrace"
$env:JWT_SECRET = "replace-with-a-development-secret"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8100
Pop-Location
```

In a fourth terminal, start the frontend:

```powershell
Push-Location frontend
npm install
Copy-Item .env.example .env
npm run dev
Pop-Location
```

The backend test suite can run without PostgreSQL:

```powershell
Push-Location backend
npm test
Pop-Location
```

Run the Python tests with:

```powershell
Push-Location analysis
python -m pytest -q
Pop-Location
```

## Stop Services

Press `Ctrl+C` in the Docker and frontend terminals, then run:

```powershell
docker compose down
```

Use `docker compose down -v` only when you intentionally want to delete the local database volume.

## API Routes

The contract is documented in [0.5_api_contract.yaml](docs/0.5_api_contract.yaml).

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/health` | Public |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/me` | Authenticated |
| `GET` | `/api/instructor/submissions` | Instructor only |
| `GET` | `/api/student/self-checks/quota` | Student only |

The Python analysis service exposes `POST http://localhost:8100/api/analyze`. It accepts exactly one of `source_url` or `upload`, plus a supported `language` (`c`, `java`, `python`, or `php`). Both instructor submissions and student self-checks use the same pipeline; student self-checks are limited to three per day.

The service parses source with tree-sitter, removes configured boilerplate and generated/vendor paths, creates AST fingerprints with winnowing, reads Git commit/provenance signals, computes a risk band, and records matching submissions in similarity clusters.

Protected routes require:

```text
Authorization: Bearer <jwt>
```

## Database Reset

To remove the PostgreSQL data volume and run the migration again from an empty database:

```powershell
docker compose down -v
docker compose up --build
```

`down -v` is destructive: it deletes the local PostgreSQL volume.

## Current Limitations

- The frontend login screen still uses demo role buttons and is not yet connected to `POST /api/auth/login`.
- No seed users are included yet, so real API login requires inserting a user with a bcrypt password hash.
- HTTPS/TLS termination should be provided by the USJR deployment reverse proxy; local Docker runs HTTP for development.
- The admin page is still a placeholder.

## Project Structure

```text
backend/       Express API, JWT middleware, tests, Dockerfile
analysis/      Python FastAPI ingestion and AST/winnowing analysis service
db/migrations/ PostgreSQL schema migration
design/        Low-fidelity wireframes
docs/          Requirements, architecture, topology, and API contract
frontend/      Vite/React application
docker-compose.yml
```