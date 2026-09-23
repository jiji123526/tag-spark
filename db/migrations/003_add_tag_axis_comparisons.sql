CREATE TABLE IF NOT EXISTS embedding_axis (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  prompt TEXT NOT NULL,
  high_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS embedding_axis_tag (
  axis_id INTEGER NOT NULL REFERENCES embedding_axis(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (axis_id, tag_id)
);

CREATE TABLE IF NOT EXISTS tag_axis_comparison (
  id BIGSERIAL PRIMARY KEY,
  axis_id INTEGER NOT NULL REFERENCES embedding_axis(id) ON DELETE CASCADE,
  tag_a_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tag_b_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  winner_tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('win', 'tie', 'skip')),
  annotator_key TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tag_axis_comparison_order CHECK (tag_a_id < tag_b_id),
  CONSTRAINT tag_axis_comparison_winner CHECK (
    (decision = 'win' AND winner_tag_id IN (tag_a_id, tag_b_id))
    OR (decision IN ('tie', 'skip') AND winner_tag_id IS NULL)
  ),
  UNIQUE (axis_id, tag_a_id, tag_b_id, annotator_key)
);

INSERT INTO embedding_axis (key, label, prompt, high_label)
VALUES
  ('darkness', '어두움 ↔ 밝음', '둘 중 어느 태그가 더 어두운 작품을 뜻하나요?', '더 어두움'),
  ('tension', '사이좋음 ↔ 개싸움', '둘 중 어느 태그가 더 개싸움에 가까운 관계를 뜻하나요?', '더 개싸움')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  prompt = EXCLUDED.prompt,
  high_label = EXCLUDED.high_label;

INSERT INTO embedding_axis_tag (axis_id, tag_id)
SELECT axis.id, tags.id
FROM embedding_axis AS axis
JOIN tags ON tags.category NOT IN ('분량', '완결여부')
WHERE axis.key IN ('darkness', 'tension')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS tag_axis_comparison_axis_idx
  ON tag_axis_comparison (axis_id, annotator_key);
