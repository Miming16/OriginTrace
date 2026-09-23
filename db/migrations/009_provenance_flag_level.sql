ALTER TABLE provenance_flags
    ADD COLUMN flag_level VARCHAR(10);

UPDATE provenance_flags
SET flag_level = CASE WHEN severity = 'high' THEN 'HARD' ELSE 'SOFT' END;

ALTER TABLE provenance_flags
    ALTER COLUMN flag_level SET NOT NULL,
    ADD CONSTRAINT provenance_flags_flag_level_check
    CHECK (flag_level IN ('SOFT', 'HARD'));