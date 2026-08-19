const POSTYPE_API_ORIGIN = "https://api.postype.com";
const SCRAPER_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/json",
  "User-Agent": "Mozilla/5.0 (compatible; bot)",
};

function normalizePublishedAt(value) {
  if (value === null || value === undefined || value === "") return null;

  const numericValue = typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value;
  const date = typeof numericValue === "number"
    ? new Date(numericValue < 1e12 ? numericValue * 1000 : numericValue)
    : new Date(numericValue);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getSeriesId(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/\/series\/(\d+)(?:\/|$)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export function extractPostPublishedAt(html) {
  const jsonLdScripts = html.matchAll(
    /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const match of jsonLdScripts) {
    try {
      const entries = JSON.parse(match[1]);
      const items = Array.isArray(entries) ? entries : [entries];
      const publishedAt = items.find((item) => item?.datePublished)?.datePublished;
      const normalized = normalizePublishedAt(publishedAt);
      if (normalized) return normalized;
    } catch {
      // Continue to Postype's embedded page data fallback.
    }
  }

  const embeddedTimestamp = html.match(/firstPublishedAt\\?":\s*(\d+)/)?.[1];
  return normalizePublishedAt(embeddedTimestamp);
}

export function extractSeriesMetrics(html) {
  const viewMatches = [...html.matchAll(/viewCount\\":\s*(\d+)/g)];
  const likeMatches = [...html.matchAll(/likeCount\\":\s*(\d+)/g)];
  const commentMatches = [...html.matchAll(/commentCount\\":\s*(\d+)/g)];
  const postCountMatches = [...html.matchAll(/postCount\\":\s*(\d+)/g)];
  const rawViews = viewMatches.length >= 2 ? Number(viewMatches[1][1]) : null;
  const rawLikes = likeMatches.length >= 2 ? Number(likeMatches[1][1]) : null;
  const rawComments = commentMatches.length >= 2 ? Number(commentMatches[1][1]) : null;
  const postCount = postCountMatches.length >= 2 ? Number(postCountMatches[1][1]) : 1;
  const divisor = postCount || 1;

  return {
    views: rawViews === null ? null : Math.round(rawViews / divisor),
    likes: rawLikes === null ? null : Math.round(rawLikes / divisor),
    comments: rawComments === null ? null : Math.round(rawComments / divisor),
    deleted: rawViews === 0,
  };
}

export async function fetchLatestSeriesPublishedAt(seriesId, fetchImpl = fetch) {
  const url = new URL(`/api/v1/series/${seriesId}/posts`, POSTYPE_API_ORIGIN);
  url.searchParams.append("sort", "publishedAt,desc");
  url.searchParams.append("sort", "createdAt,desc");
  url.searchParams.set("page", "0");
  url.searchParams.set("size", "1");

  const response = await fetchImpl(url, {
    headers: { ...SCRAPER_HEADERS, "postype-lang": "ko" },
  });
  if (!response.ok) {
    const error = new Error(`Postype series API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return normalizePublishedAt(data.content?.[0]?.feedItem?.publishedAt);
}

export async function extractPostedAt({
  sourceUrl,
  finalUrl = sourceUrl,
  html,
  fetchImpl = fetch,
}) {
  const seriesId = getSeriesId(finalUrl) ?? getSeriesId(sourceUrl);
  if (seriesId) {
    return fetchLatestSeriesPublishedAt(seriesId, fetchImpl);
  }

  return extractPostPublishedAt(html);
}

export async function fetchPostedAt(sourceUrl, fetchImpl = fetch) {
  const seriesId = getSeriesId(sourceUrl);
  if (seriesId) {
    return fetchLatestSeriesPublishedAt(seriesId, fetchImpl);
  }

  const response = await fetchImpl(sourceUrl, {
    headers: SCRAPER_HEADERS,
    redirect: "follow",
  });
  if (!response.ok) {
    const error = new Error(`Postype page returned ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const html = await response.text();
  return extractPostedAt({
    sourceUrl,
    finalUrl: response.url || sourceUrl,
    html,
    fetchImpl,
  });
}
