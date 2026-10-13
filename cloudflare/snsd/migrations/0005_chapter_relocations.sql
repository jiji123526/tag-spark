ALTER TABLE work_chapters ADD COLUMN replaces_paragraph_index INTEGER;
ALTER TABLE work_chapters ADD COLUMN replaces_char_offset INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_chapters_unique_replacement
  ON work_chapters(work_id, replaces_paragraph_index, replaces_char_offset)
  WHERE replaces_paragraph_index IS NOT NULL AND replaces_char_offset IS NOT NULL;
