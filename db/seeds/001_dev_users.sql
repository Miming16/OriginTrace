-- OriginTrace development seed users
-- WBS 1.3 -- support data for verifying 1.4 (auth) and 2.x/3.x (ingestion).
--
-- Three accounts, one per role in the users.role CHECK constraint.
-- Password for all three: Passw0rd!
-- Hashes are bcrypt, cost 10, generated with the backend's own bcryptjs:
--   cd backend && node -e "console.log(require('bcryptjs').hashSync('Passw0rd!',10))"
--
-- Development and test use only. Never load this into a deployed database.
--
-- Idempotent: re-running inserts nothing new. Apply with
--   docker compose exec -T db psql -U origintrace -d origintrace < db/seeds/001_dev_users.sql

INSERT INTO users (id, email, password_hash, role, full_name) VALUES
    ('11111111-1111-4111-8111-111111111111',
     'student@origintrace.test',
     '$2a$10$IVXqvh07CQ3rzx..HtCMBOAAec0wyEs/UKriMvVuNQrvhP2SYXMNS',
     'student',
     'Sam Student'),
    ('22222222-2222-4222-8222-222222222222',
     'instructor@origintrace.test',
     '$2a$10$Tcx8.AyR/sguFM/jnwHWee1Ju7t1fBmO4JFRucNy0Y1PVUAw2n6L.',
     'instructor',
     'Ingrid Instructor'),
    ('33333333-3333-4333-8333-333333333333',
     'admin@origintrace.test',
     '$2a$10$gl/y59bfO1tWUk.p1u1rEuetf6wqMRI8904/wGQx1nZymSyqWoAkG',
     'admin',
     'Ada Admin')
ON CONFLICT DO NOTHING;
