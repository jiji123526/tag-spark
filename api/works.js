import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "GET") {
    const works = await sql`
      SELECT w.*, 
        COALESCE(
          json_agg(
            json_build_object('tag_id', wt.tag_id, 'weight', wt.weight)
          ) FILTER (WHERE wt.tag_id IS NOT NULL), '[]'
        ) as tags
      FROM works w
      LEFT JOIN work_tags wt ON w.id = wt.work_id
      GROUP BY w.id
      ORDER BY w.id
    `;
    return res.status(200).json(works);
  }

  if (req.method === "POST") {
    const { title, author, source_url, aliases, tags } = req.body;
    if (!title || !author || !source_url) {
      return res.status(400).json({ error: "title, author, source_url required" });
    }

    // Check for duplicates
    const [dupByUrl] = await sql`SELECT id, title, author FROM works WHERE LOWER(source_url) = LOWER(${source_url.trim()}) LIMIT 1`;
    if (dupByUrl) {
      return res.status(409).json({ error: `이미 등록된 작품입니다: ${dupByUrl.title} - ${dupByUrl.author}` });
    }
    const [dupByTitleAuthor] = await sql`SELECT id, title, author FROM works WHERE LOWER(title) = LOWER(${title.trim()}) AND LOWER(author) = LOWER(${author.trim()}) LIMIT 1`;
    if (dupByTitleAuthor) {
      return res.status(409).json({ error: `이미 등록된 작품입니다: ${dupByTitleAuthor.title} - ${dupByTitleAuthor.author}` });
    }

    const [work] = await sql`
      INSERT INTO works (title, author, source_url, aliases)
      VALUES (${title}, ${author}, ${source_url}, ${aliases ?? []})
      RETURNING *
    `;

    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await sql`
          INSERT INTO work_tags (work_id, tag_id, weight)
          VALUES (${work.id}, ${tagId}, 1)
          ON CONFLICT DO NOTHING
        `;
      }
    }

    return res.status(201).json(work);
  }

  res.status(405).json({ error: "Method not allowed" });
}
