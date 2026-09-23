ALTER TABLE users ADD COLUMN id_number VARCHAR(20);

-- Backfill the dev accounts. On a fresh database, these inserts create the
-- seeded login accounts; on an existing database, they update any matching rows.
UPDATE users SET id_number = '2023018093' WHERE email = 'student@origintrace.test';
UPDATE users SET id_number = '2023018092' WHERE email = 'instructor@origintrace.test';
UPDATE users SET id_number = '2023018091' WHERE email = 'admin@origintrace.test';

INSERT INTO users (id, id_number, email, password_hash, role, full_name) VALUES
    ('11111111-1111-4111-8111-111111111111', '2023018093', 'chad.student@origintrace.test', '$2a$10$IVXqvh07CQ3rzx..HtCMBOAAec0wyEs/UKriMvVuNQrvhP2SYXMNS', 'student', 'Chad Student'),
    ('22222222-2222-4222-8222-222222222222', '2023018092', 'angeline.instructor@origintrace.test', '$2a$10$Tcx8.AyR/sguFM/jnwHWee1Ju7t1fBmO4JFRucNy0Y1PVUAw2n6L.', 'instructor', 'Angeline Instructor'),
    ('33333333-3333-4333-8333-333333333333', '2023018091', 'jorge.admin@origintrace.test', '$2a$10$gl/y59bfO1tWUk.p1u1rEuetf6wqMRI8904/wGQx1nZymSyqWoAkG', 'admin', 'Jorge Admin')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    id_number = EXCLUDED.id_number,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash;

ALTER TABLE users
    ALTER COLUMN id_number SET NOT NULL,
    ADD CONSTRAINT users_id_number_unique UNIQUE (id_number),
    ADD CONSTRAINT users_id_number_not_blank CHECK (length(trim(id_number)) > 0);