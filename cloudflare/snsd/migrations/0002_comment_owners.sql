ALTER TABLE comments ADD COLUMN created_by TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_comments_created_by ON comments(work_id, created_by);
