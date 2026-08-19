import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const tags = await sql`SELECT id, name, category, aliases FROM tags ORDER BY id`;
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).json(tags);
}
