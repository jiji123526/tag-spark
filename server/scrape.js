import { extractPostedAt, extractSeriesMetrics } from "./postype.js";

const SCRAPER_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/json",
  "User-Agent": "Mozilla/5.0 (compatible; tag-spark-metrics-bot)",
};

function extractSinglePostMetrics(html) {
  const viewMatches = [...html.matchAll(/viewCount\\":\s*(\d+)/g)];
  const likeMatches = [...html.matchAll(/likeCount\\":\s*(\d+)/g)];
  const commentMatches = [...html.matchAll(/commentCount\\":\s*(\d+)/g)];

  return {
    views: viewMatches.length >= 2
      ? Number(viewMatches[viewMatches.length - 1][1])
      : viewMatches[0]
        ? Number(viewMatches[0][1])
        : null,
    likes: likeMatches.length >= 2
      ? Number(likeMatches[1][1])
      : likeMatches[0]
        ? Number(likeMatches[0][1])
        : null,
    comments: commentMatches.length >= 2
      ? Number(commentMatches[1][1])
      : commentMatches[0]
        ? Number(commentMatches[0][1])
        : null,
  };
}

async function markAsDeleted(sql, workId) {
  await sql`
    INSERT INTO work_tags (work_id, tag_id, weight)
    VALUES (${workId}, 900, 1)
    ON CONFLICT DO NOTHING
  `;
}

export async function scrapeWork({ work, sql, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(work.source_url, {
      headers: SCRAPER_HEADERS,
      redirect: "follow",
    });

    if (!response.ok && (response.status === 404 || response.status === 410)) {
      await markAsDeleted(sql, work.id);
      return { status: "deleted", workId: work.id };
    }
    if (!response.ok) {
      return {
        status: "failed",
        workId: work.id,
        error: `Postype returned HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const finalUrl = response.url || work.source_url;
    const isSeries =
      finalUrl.includes("/series/") || work.source_url.includes("/series/");

    let views = null;
    let likes = null;
    let comments = null;

    if (isSeries) {
      const metrics = extractSeriesMetrics(html);
      if (metrics.deleted) {
        await markAsDeleted(sql, work.id);
        return { status: "deleted", workId: work.id };
      }
      ({ views, likes, comments } = metrics);
    } else {
      ({ views, likes, comments } = extractSinglePostMetrics(html));
    }

    const postedAt = isSeries || !work.posted_at
      ? await extractPostedAt({
        sourceUrl: work.source_url,
        finalUrl,
        html,
        fetchImpl,
      }).catch(() => null)
      : null;

    if (views === null && likes === null && comments === null && postedAt === null) {
      return { status: "unchanged", workId: work.id };
    }

    await sql`
      UPDATE works SET
        views = COALESCE(${views}, views),
        likes = COALESCE(${likes}, likes),
        comments = COALESCE(${comments}, comments),
        posted_at = COALESCE(${postedAt}::timestamptz, posted_at)
      WHERE id = ${work.id}
    `;

    return { status: "updated", workId: work.id };
  } catch (error) {
    return {
      status: "failed",
      workId: work.id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runScrapeAll({
  sql,
  concurrency = 6,
  fetchImpl = fetch,
  logger = console,
}) {
  const works = await sql`
    SELECT w.id, w.source_url, w.posted_at
    FROM works w
    WHERE w.source_url IS NOT NULL
      AND TRIM(w.source_url) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM work_tags wt
        WHERE wt.work_id = w.id
          AND wt.tag_id = 900
      )
    ORDER BY w.id
  `;

  const results = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), works.length);

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= works.length) return;

      const work = works[index];
      const result = await scrapeWork({ work, sql, fetchImpl });
      results[index] = result;

      logger.log(
        `[${index + 1}/${works.length}] work=${work.id} ${result.status}`,
      );
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    total: works.length,
    updated: results.filter((result) => result?.status === "updated").length,
    unchanged: results.filter((result) => result?.status === "unchanged").length,
    deleted: results.filter((result) => result?.status === "deleted").length,
    failed: results.filter((result) => result?.status === "failed").length,
    failures: results.filter((result) => result?.status === "failed"),
  };
}
