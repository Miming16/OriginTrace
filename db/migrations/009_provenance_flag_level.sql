ALTER TABLE provenance_flags
    ADD COLUMN IF NOT EXISTS flag_level VARCHAR(10);

UPDATE provenance_flags
SET flag_level = CASE WHEN severity = 'high' THEN 'HARD' ELSE 'SOFT' END;

ALTER TABLE provenance_flags
    ALTER COLUMN flag_level SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'provenance_flags_flag_level_check'
    ) THEN
        ALTER TABLE provenance_flags
            ADD CONSTRAINT provenance_flags_flag_level_check
            CHECK (flag_level IN ('SOFT', 'HARD'));
    END IF;
END $$;