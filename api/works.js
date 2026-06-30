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

  if (req.method === "PATCH") {
    const workId = Number(req.body?.work_id);
    const requestedTags = Array.isArray(req.body?.tags) ? req.body.tags : null;
    const tagIds = requestedTags
      ? [...new Set(requestedTags.map(Number))].filter(Number.isInteger)
      : [];

    if (!Number.isInteger(workId) || !requestedTags || tagIds.length !== requestedTags.length) {
      return res.status(400).json({ error: "유효한 작품과 키워드를 선택해주세요." });
    }

    const [work] = await sql`SELECT id FROM works WHERE id = ${workId}`;
    if (!work) {
      return res.status(404).json({ error: "작품을 찾을 수 없습니다." });
    }

    const selectedTags = await sql`
      SELECT id, category
      FROM tags
      WHERE id IN (
        SELECT value::int
        FROM jsonb_array_elements_text(${JSON.stringify(tagIds)}::jsonb)
      )
    `;

    if (selectedTags.length !== tagIds.length) {
      return res.status(400).json({ error: "존재하지 않는 키워드가 포함되어 있습니다." });
    }

    const categories = new Set(selectedTags.map((tag) => tag.category));
    if (!categories.has("분량") || !categories.has("완결여부")) {
      return res.status(400).json({ error: "분량과 완결여부 키워드를 각각 하나 이상 선택해주세요." });
    }

    await sql`
      WITH desired AS (
        SELECT value::int AS tag_id
        FROM jsonb_array_elements_text(${JSON.stringify(tagIds)}::jsonb)
      ), deleted AS (
        DELETE FROM work_tags
        WHERE work_id = ${workId}
          AND tag_id NOT IN (SELECT tag_id FROM desired)
      )
      INSERT INTO work_tags (work_id, tag_id, weight)
      SELECT ${workId}, tag_id, 1
      FROM desired
      ON CONFLICT DO NOTHING
    `;

    return res.status(200).json({ work_id: workId, tags: tagIds });
  }

  res.status(405).json({ error: "Method not allowed" });
}
