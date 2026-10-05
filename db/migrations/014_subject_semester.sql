ALTER TABLE subjects
    ADD COLUMN semester VARCHAR(7);

ALTER TABLE subjects
    ADD CONSTRAINT subjects_semester_valid
    CHECK (semester IS NULL OR semester IN ('1st sem', '2nd sem'));
