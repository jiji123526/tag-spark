CREATE TABLE IF NOT EXISTS work_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  paragraph_index INTEGER NOT NULL,
  char_offset INTEGER NOT NULL DEFAULT 0,
  anchor_text TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_chapters_unique_location
  ON work_chapters(work_id, paragraph_index, char_offset);
