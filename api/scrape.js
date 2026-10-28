import { neon } from "@neondatabase/serverless";
import { scrapeWork } from "../server/scrape.js";

const BATCH_SIZE = 20;

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // Prioritize new works and rows that still need a publication date.
  const newWorks = await sql`
    SELECT id, source_url, posted_at
    FROM works
    WHERE (posted_at IS NULL OR views = 0 OR views IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM work_tags
        WHERE work_id = works.id AND tag_id = 900
      )
    ORDER BY id DESC
    LIMIT ${BATCH_SIZE}
  `;

  let works = newWorks;
  const remaining = BATCH_SIZE - works.length;

  if (remaining > 0) {
    const [meta] = await sql`
      SELECT value FROM work_meta WHERE key = 'scrape_offset' LIMIT 1
    `.catch(() => [null]);
    let offset = meta ? parseInt(meta.value, 10) : 0;

    const oldWorks = await sql`
      SELECT id, source_url, posted_at
      FROM works
      WHERE posted_at IS NOT NULL AND views > 0
      ORDER BY id
      LIMIT ${remaining}
      OFFSET ${offset}
    `;
    if (oldWorks.length === 0) offset = 0;
    works = [...works, ...oldWorks];

    const nextOffset = offset + remaining;
    await sql`
      INSERT INTO work_meta (key, value) VALUES ('scrape_offset', ${String(nextOffset)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }

  let updated = 0;
  let failed = 0;
  let deleted = 0;
  for (const work of works) {
    const result = await scrapeWork({ work, sql });
    if (result.status === "updated") updated++;
    if (result.status === "failed") failed++;
    if (result.status === "deleted") deleted++;
  }

  res.status(200).json({ updated, deleted, failed, batch: works.length });
}
