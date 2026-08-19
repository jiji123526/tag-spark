import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  const [works, tags, workTags] = await Promise.all([
    sql`SELECT id, title, author, source_url, aliases, author_aliases, views, likes, comments, posted_at FROM works ORDER BY id`,
    sql`SELECT id, name, category, aliases FROM tags ORDER BY id`,
    sql`SELECT work_id, tag_id, weight FROM work_tags`,
  ]);

  res.status(200).json({ works, tags, workTags });
}
