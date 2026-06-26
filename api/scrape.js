import { neon } from "@neondatabase/serverless";

const BATCH_SIZE = 20;

function parseKoreanNumber(str) {
  if (!str) return 0;
  str = str.replace(/,/g, "").trim();
  if (str.includes("만")) {
    return Math.round(parseFloat(str.replace("만", "")) * 10000);
  }
  if (str.includes("천")) {
    return Math.round(parseFloat(str.replace("천", "")) * 1000);
  }
  return parseInt(str, 10) || 0;
}

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // Prioritize works with no stats (newly added), then rotate the rest
  const newWorks = await sql`
    SELECT id, source_url FROM works WHERE views = 0 OR views IS NULL ORDER BY id DESC LIMIT ${BATCH_SIZE}
  `;

  let works = newWorks;
  const remaining = BATCH_SIZE - works.length;

  if (remaining > 0) {
    const [meta] = await sql`
      SELECT value FROM work_meta WHERE key = 'scrape_offset' LIMIT 1
    `.catch(() => [null]);
    let offset = meta ? parseInt(meta.value, 10) : 0;

    const oldWorks = await sql`
      SELECT id, source_url FROM works WHERE views > 0 ORDER BY id LIMIT ${remaining} OFFSET ${offset}
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
  for (const work of works) {
    try {
      const resp = await fetch(work.source_url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" },
        redirect: "follow",
      });
      if (!resp.ok) {
        // Post is unavailable/deleted — tag it as '터짐'
        await sql`INSERT INTO work_tags (work_id, tag_id, weight) VALUES (${work.id}, 900, 1) ON CONFLICT DO NOTHING`;
        continue;
      }
      const html = await resp.text();
      const finalUrl = resp.url || work.source_url;

      let views = null, likes = null, comments = null;

      if (finalUrl.includes("/series/")) {
        // Series: use JSON data, divide by postCount
        const viewMatches = [...html.matchAll(/viewCount\\":\s*(\d+)/g)];
        const likeMatches = [...html.matchAll(/likeCount\\":\s*(\d+)/g)];
        const commentMatches = [...html.matchAll(/commentCount\\":\s*(\d+)/g)];
        const postCountMatches = [...html.matchAll(/postCount\\":\s*(\d+)/g)];
        // Second occurrence is the series stats
        const rawViews = viewMatches.length >= 2 ? parseInt(viewMatches[1][1], 10) : null;
        const rawLikes = likeMatches.length >= 2 ? parseInt(likeMatches[1][1], 10) : null;
        const rawComments = commentMatches.length >= 2 ? parseInt(commentMatches[1][1], 10) : null;
        const postCount = postCountMatches.length >= 2 ? parseInt(postCountMatches[1][1], 10) : 1;
        const divisor = postCount || 1;
        views = rawViews !== null ? Math.round(rawViews / divisor) : null;
        likes = rawLikes !== null ? Math.round(rawLikes / divisor) : null;
        comments = rawComments !== null ? Math.round(rawComments / divisor) : null;
      } else {
        // Single post: use JSON data (second occurrence = post stats)
        const viewMatches = [...html.matchAll(/viewCount\\":\s*(\d+)/g)];
        const likeMatches = [...html.matchAll(/likeCount\\":\s*(\d+)/g)];
        const commentMatches = [...html.matchAll(/commentCount\\":\s*(\d+)/g)];
        // Second occurrence is the post's own stats (first is channel total)
        views = viewMatches.length >= 2 ? parseInt(viewMatches[viewMatches.length - 1][1], 10) : (viewMatches[0] ? parseInt(viewMatches[0][1], 10) : null);
        likes = likeMatches.length >= 2 ? parseInt(likeMatches[1][1], 10) : (likeMatches[0] ? parseInt(likeMatches[0][1], 10) : null);
        comments = commentMatches.length >= 2 ? parseInt(commentMatches[1][1], 10) : (commentMatches[0] ? parseInt(commentMatches[0][1], 10) : null);
      }

      if (views !== null || likes !== null || comments !== null) {
        await sql`
          UPDATE works SET
            views = COALESCE(${views}, views),
            likes = COALESCE(${likes}, likes),
            comments = COALESCE(${comments}, comments)
          WHERE id = ${work.id}
        `;
        updated++;
      }
    } catch (e) {
      // skip failures silently
    }
  }

  res.status(200).json({ updated, batch: works.length });
}
