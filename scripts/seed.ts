import { neon } from "@neondatabase/serverless";
import { works } from "../src/data/works.ts";
import { tags } from "../src/data/tags.ts";
import { workTags } from "../src/data/workTags.ts";

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  // Create tables
  await sql`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      aliases TEXT[]
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS works (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      source_url TEXT NOT NULL,
      aliases TEXT[],
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS work_tags (
      work_id INTEGER REFERENCES works(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      weight INTEGER DEFAULT 1,
      PRIMARY KEY (work_id, tag_id)
    )
  `;

  // Seed tags
  for (const t of tags) {
    await sql`
      INSERT INTO tags (id, name, category, aliases)
      VALUES (${t.id}, ${t.name}, ${t.category}, ${t.aliases ?? []})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, aliases = EXCLUDED.aliases
    `;
  }
  console.log(`Seeded ${tags.length} tags`);

  // Seed works
  for (const w of works) {
    const aliases = (w as any).aliases ?? [];
    await sql`
      INSERT INTO works (id, title, author, source_url, aliases, views, likes, comments)
      VALUES (${w.id}, ${w.title}, ${w.author}, ${w.source_url}, ${aliases}, ${w.views}, ${w.likes}, ${w.comments})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, source_url = EXCLUDED.source_url, aliases = EXCLUDED.aliases, views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments
    `;
  }
  console.log(`Seeded ${works.length} works`);

  // Reset sequence
  await sql`SELECT setval('works_id_seq', (SELECT MAX(id) FROM works))`;

  // Seed work_tags
  for (const wt of workTags) {
    await sql`
      INSERT INTO work_tags (work_id, tag_id, weight)
      VALUES (${wt.work_id}, ${wt.tag_id}, ${wt.weight})
      ON CONFLICT (work_id, tag_id) DO UPDATE SET weight = EXCLUDED.weight
    `;
  }
  console.log(`Seeded ${workTags.length} work_tags`);

  console.log("Done!");
}

seed().catch(console.error);
