CREATE TABLE IF NOT EXISTS tag_similarity (
  tag_a_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tag_b_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0.6 CHECK (weight >= 0 AND weight <= 1),
  source TEXT NOT NULL DEFAULT 'curated'
    CHECK (source IN ('curated', 'derived', 'embedding')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tag_similarity_order CHECK (tag_a_id < tag_b_id),
  PRIMARY KEY (tag_a_id, tag_b_id, source)
);

CREATE INDEX IF NOT EXISTS tag_similarity_a_idx
  ON tag_similarity (tag_a_id);

CREATE INDEX IF NOT EXISTS tag_similarity_b_idx
  ON tag_similarity (tag_b_id);
