import { neon } from "@neondatabase/serverless";
import { handleTagComparisons } from "../server/tag-comparisons.js";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    const result = await handleTagComparisons(sql, {
      method: req.method,
      body: req.body,
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("tag-comparisons failed", error);
    res.status(500).json({ error: "비교 데이터를 처리하지 못했습니다." });
  }
}
