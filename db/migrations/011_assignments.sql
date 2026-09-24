CREATE TABLE assignments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title        VARCHAR(150) NOT NULL,
    instructions TEXT,
    due_at       TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assignments_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX idx_assignments_subject ON assignments(subject_id);

ALTER TABLE submissions
    ADD COLUMN assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL;

CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);