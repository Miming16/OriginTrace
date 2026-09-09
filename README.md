# OriginTrace

OriginTrace is a role-based code submission review prototype. The repository currently contains a Vite/React frontend, an Express API foundation, and a PostgreSQL schema for users, submissions, fingerprints, commit signals, provenance flags, and risk scores.

## Requirements

- Windows, macOS, or Linux
- Docker Desktop with Docker Compose v2
- Node.js 22 or newer for the backend
- Node.js 18 or newer for the frontend
- npm

Docker Desktop is required for the recommended setup because it runs PostgreSQL and the API services together.

## Recommended Setup

From the repository root:

```powershell
docker compose up --build
```

Services:

- Frontend: run separately at `http://localhost:5173`
- API: `http://localhost:8000`
- API health check: `http://localhost:8000/api/health`
- PostgreSQL: `localhost:5432`

In a second terminal, start the frontend:

```powershell
Push-Location frontend
npm install
npm run dev
Pop-Location
```

Open `http://localhost:5173` in a browser.

The first PostgreSQL startup runs [001_initial_schema.sql](db/migrations/001_initial_schema.sql) automatically. The database uses a named Docker volume so data survives container restarts.

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

## Local Development Without the API Container

Start only PostgreSQL with Docker:

```powershell
docker compose up db
```

In another terminal, start the API:

```powershell
Push-Location backend
npm install
Copy-Item .env.example .env
npm run dev
Pop-Location
```

In a third terminal, start the frontend:

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

## API Routes

The contract is documented in [0.5_api_contract.yaml](docs/0.5_api_contract.yaml).

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/health` | Public |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/me` | Authenticated |
| `GET` | `/api/instructor/submissions` | Instructor only |
| `GET` | `/api/student/self-checks/quota` | Student only |

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
- Submission analysis, risk computation, file processing, quota persistence, and instructor decisions are not implemented yet.
- The admin page is still a placeholder.

## Project Structure

```text
backend/       Express API, JWT middleware, tests, Dockerfile
db/migrations/ PostgreSQL schema migration
design/        Low-fidelity wireframes
docs/          Requirements, architecture, topology, and API contract
frontend/      Vite/React application
docker-compose.yml
```