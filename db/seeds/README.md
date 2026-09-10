# Development seeds

Seed data for local development and for the DB-backed tests in `backend/test/`
and `analysis/tests/`. **Development and test use only.**

## Loading

The stack must already be up and the migration already applied:

```powershell
docker compose exec -T db psql -U origintrace -d origintrace < db/seeds/001_dev_users.sql
```

Every seed file is idempotent (`ON CONFLICT DO NOTHING`), so re-running one is
safe and is the normal way to top a database back up.

## Why these are not wired into `docker-entrypoint-initdb.d`

`docker-compose.yml` mounts `./db/migrations` into
`/docker-entrypoint-initdb.d`, and the `postgres` image runs everything in that
directory **only when the data directory is empty** — that is, only on a
completely fresh `postgres-data` volume. Two consequences:

- After the first `docker compose up`, editing a migration or adding a file
  there does nothing until the volume is dropped (`docker compose down -v`).
- Seeds mounted there would silently become part of first-boot state, which is
  wrong for data that is deliberately development-only.

Seeds are therefore kept out of that directory and loaded explicitly, by hand or
by a test's setup step.

## Accounts

All three share the password `Passw0rd!`.

| Role | Email | Name | Fixed id |
|---|---|---|---|
| student | `student@origintrace.test` | Sam Student | `1111…1111` |
| instructor | `instructor@origintrace.test` | Ingrid Instructor | `2222…2222` |
| admin | `admin@origintrace.test` | Ada Admin | `3333…3333` |

The ids are fixed rather than `gen_random_uuid()` so that tests and the smoke
script can reference a user without first querying for it.

Hashes are bcrypt cost 10, produced with the backend's own `bcryptjs` so that
`POST /api/auth/login` verifies them with the identical implementation:

```powershell
cd backend
node -e "console.log(require('bcryptjs').hashSync('Passw0rd!',10))"
```
