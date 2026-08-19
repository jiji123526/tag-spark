import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPostPublishedAt,
  extractSeriesMetrics,
  fetchLatestSeriesPublishedAt,
  getSeriesId,
} from "./postype.js";

test("extracts a standalone post date from JSON-LD", () => {
  const html = `
    <script type="application/ld+json">
      {"@type":"BlogPosting","datePublished":"2024-06-01T12:30:00Z"}
    </script>
  `;

  assert.equal(extractPostPublishedAt(html), "2024-06-01T12:30:00.000Z");
});

test("falls back to Postype embedded firstPublishedAt data", () => {
  const html = String.raw`{\"firstPublishedAt\":1717245000}`;
  assert.equal(extractPostPublishedAt(html), "2024-06-01T12:30:00.000Z");
});

test("finds a series id in a Postype URL", () => {
  assert.equal(
    getSeriesId("https://www.postype.com/@writer/series/667544"),
    667544,
  );
  assert.equal(getSeriesId("https://www.postype.com/@writer/post/123"), null);
});

test("treats a series with zero total views as deleted", () => {
  const html = String.raw`
    {\"viewCount\":1000,\"likeCount\":100,\"commentCount\":10,\"postCount\":50}
    {\"viewCount\":0,\"likeCount\":0,\"commentCount\":0,\"postCount\":0}
  `;

  assert.deepEqual(extractSeriesMetrics(html), {
    views: 0,
    likes: 0,
    comments: 0,
    deleted: true,
  });
});

test("averages metrics for an active series", () => {
  const html = String.raw`
    {\"viewCount\":1000,\"likeCount\":100,\"commentCount\":10,\"postCount\":50}
    {\"viewCount\":120,\"likeCount\":24,\"commentCount\":6,\"postCount\":3}
  `;

  assert.deepEqual(extractSeriesMetrics(html), {
    views: 40,
    likes: 8,
    comments: 2,
    deleted: false,
  });
});

test("requests the newest series episode", async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        content: [{ feedItem: { publishedAt: 1667476814 } }],
      }),
    };
  };

  const publishedAt = await fetchLatestSeriesPublishedAt(667544, fetchImpl);

  assert.equal(publishedAt, "2022-11-03T12:00:14.000Z");
  assert.equal(requestedUrl.hostname, "api.postype.com");
  assert.deepEqual(requestedUrl.searchParams.getAll("sort"), [
    "publishedAt,desc",
    "createdAt,desc",
  ]);
  assert.equal(requestedUrl.searchParams.get("size"), "1");
});
