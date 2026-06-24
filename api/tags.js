import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const tags = await sql`SELECT * FROM tags ORDER BY id`;
  return res.status(200).json(tags);
}
