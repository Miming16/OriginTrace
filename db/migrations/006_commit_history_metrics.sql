ALTER TABLE commit_signals
    ADD COLUMN commit_count INTEGER NOT NULL DEFAULT 0 CHECK (commit_count >= 0),
    ADD COLUMN timespan_days REAL NOT NULL DEFAULT 0 CHECK (timespan_days >= 0),
    ADD COLUMN has_big_bang BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN low_entropy_count INTEGER NOT NULL DEFAULT 0 CHECK (low_entropy_count >= 0),
    ADD COLUMN author_committer_match_pct REAL NOT NULL DEFAULT 100 CHECK (author_committer_match_pct >= 0 AND author_committer_match_pct <= 100);
