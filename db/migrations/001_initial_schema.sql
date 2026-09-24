-- OriginTrace initial schema migration
-- WBS 0.3 / 1.3 -- Database Schema Design & Migration
-- Scope: the 6 tables named in 0.3's description only.
-- Subjects, enrollments, similarity clusters, originality decisions,
-- and self-check rate-limiting are tracked as a separate follow-up task.
-- Target: PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('instructor', 'student', 'admin')),
    full_name       VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT users_full_name_not_blank CHECK (length(trim(full_name)) > 0)
);

CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type     VARCHAR(10) NOT NULL CHECK (source_type IN ('git', 'upload')),
    source_url      TEXT NOT NULL,
    language        VARCHAR(20) NOT NULL CHECK (language IN ('c', 'javascript', 'python', 'php')),
    is_self_check   BOOLEAN NOT NULL DEFAULT false,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT submissions_source_url_not_blank CHECK (length(trim(source_url)) > 0)
);

CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX idx_submissions_self_check ON submissions(student_id, submitted_at)
    WHERE is_self_check = true;

-- ============================================================
-- FINGERPRINTS  (AST winnowing output)
-- ============================================================
CREATE TABLE fingerprints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    hash_value      BIGINT NOT NULL,
    window_position INTEGER NOT NULL CHECK (window_position >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fingerprints_submission ON fingerprints(submission_id);
CREATE INDEX idx_fingerprints_hash ON fingerprints(hash_value);

-- ============================================================
-- COMMIT_SIGNALS  (git commit-pattern analysis -- soft flags)
-- ============================================================
CREATE TABLE commit_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    signal_type     VARCHAR(50) NOT NULL
                        CHECK (signal_type IN ('big_bang_commit', 'zombie_code', 'low_message_entropy')),
    severity        VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description     TEXT,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commit_signals_submission ON commit_signals(submission_id);

-- ============================================================
-- PROVENANCE_FLAGS  (version-control provenance -- soft flags)
-- ============================================================
CREATE TABLE provenance_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    flag_type       VARCHAR(50) NOT NULL
                        CHECK (flag_type IN ('author_committer_mismatch', 'timestamp_anomaly', 'embedded_authorship_marker', 'orphan_commit')),
    severity        VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description     TEXT,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provenance_flags_submission ON provenance_flags(submission_id);

-- ============================================================
-- RISK_SCORES  (combined Low/Medium/High band)
-- ============================================================
CREATE TABLE risk_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id           UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
    risk_band               VARCHAR(10) NOT NULL CHECK (risk_band IN ('low', 'medium', 'high')),
    similarity_score        REAL NOT NULL,
    commit_flag_count       INTEGER NOT NULL DEFAULT 0,
    provenance_flag_count   INTEGER NOT NULL DEFAULT 0,
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT risk_scores_similarity_nonnegative CHECK (similarity_score >= 0),
    CONSTRAINT risk_scores_commit_flags_nonnegative CHECK (commit_flag_count >= 0),
    CONSTRAINT risk_scores_provenance_flags_nonnegative CHECK (provenance_flag_count >= 0)
);

CREATE INDEX idx_risk_scores_band ON risk_scores(risk_band);

-- ============================================================
-- SIMILARITY CLUSTERS / DECISIONS / SELF-CHECK RATE LIMITING
-- ============================================================
CREATE TABLE similarity_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    similarity_score REAL NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE similarity_cluster_members (
    cluster_id UUID NOT NULL REFERENCES similarity_clusters(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    PRIMARY KEY (cluster_id, submission_id)
);

CREATE TABLE originality_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES users(id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('cleared', 'under_review', 'flagged')),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cluster_members_submission ON similarity_cluster_members(submission_id);
CREATE INDEX idx_decisions_instructor ON originality_decisions(instructor_id);
