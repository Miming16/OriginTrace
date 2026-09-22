ALTER TABLE users ADD COLUMN id_number VARCHAR(20);

-- Backfill the dev accounts. No-ops on a fresh volume, where migrations run
-- before the seeds; populates the rows on a database that already has them.
UPDATE users SET id_number = '2023018093' WHERE email = 'student@origintrace.test';
UPDATE users SET id_number = '2023018092' WHERE email = 'instructor@origintrace.test';
UPDATE users SET id_number = '2023018091' WHERE email = 'admin@origintrace.test';

ALTER TABLE users
    ALTER COLUMN id_number SET NOT NULL,
    ADD CONSTRAINT users_id_number_unique UNIQUE (id_number),
    ADD CONSTRAINT users_id_number_not_blank CHECK (length(trim(id_number)) > 0);