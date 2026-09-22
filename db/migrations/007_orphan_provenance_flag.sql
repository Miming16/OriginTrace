ALTER TABLE provenance_flags
    DROP CONSTRAINT provenance_flags_flag_type_check;

ALTER TABLE provenance_flags
    ADD CONSTRAINT provenance_flags_flag_type_check
    CHECK (flag_type IN ('author_committer_mismatch', 'timestamp_anomaly', 'embedded_authorship_marker', 'orphan_commit'));