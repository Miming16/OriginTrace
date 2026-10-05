ALTER TABLE subjects
    ADD COLUMN school_year VARCHAR(7);

ALTER TABLE subjects
    ADD CONSTRAINT subjects_school_year_format
    CHECK (school_year IS NULL OR school_year ~ '^[0-9]{4}-[0-9]{2}$');
