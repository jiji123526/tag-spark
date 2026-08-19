import { neon } from "@neondatabase/serverless";
import { fetchPostedAt } from "../server/postype.js";

const CONCURRENCY = 5;
const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE works
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ
`;

const works = await sql`
  SELECT id, source_url
  FROM works
  WHERE posted_at IS NULL
  ORDER BY id
`;

let nextIndex = 0;
let updated = 0;
let failed = 0;
let unavailable = 0;

async function worker() {
  while (nextIndex < works.length) {
    const index = nextIndex++;
    const work = works[index];

    try {
      const postedAt = await fetchPostedAt(work.source_url);
      if (!postedAt) throw new Error("No publication date found");

      await sql`
        UPDATE works
        SET posted_at = ${postedAt}::timestamptz
        WHERE id = ${work.id}
      `;
      updated++;
      console.log(`[${index + 1}/${works.length}] updated work ${work.id}`);
    } catch (error) {
      failed++;
      if (error.status === 404) {
        await sql`
          INSERT INTO work_tags (work_id, tag_id, weight)
          VALUES (${work.id}, 900, 1)
          ON CONFLICT DO NOTHING
        `;
        unavailable++;
      }
      console.error(
        `[${index + 1}/${works.length}] failed work ${work.id}: ${error.message}`,
      );
    }
  }
}

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, works.length) }, () => worker()),
);

console.log(
  `Backfill complete: ${updated} updated, ${failed} failed, ${unavailable} unavailable`,
);
if (failed > 0) process.exitCode = 1;
