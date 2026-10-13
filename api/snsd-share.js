const SNSD_API_URL = process.env.SNSD_API_URL || "https://tagspark-snsd-api.letmetellu.workers.dev";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function handler(req, res) {
  const id = Number(req.query?.id);
  if (req.method !== "GET") return res.status(405).send("Method not allowed");
  if (!Number.isInteger(id) || id <= 0) return res.status(400).send("Invalid work id");

  const origin = `https://${req.headers.host || "kwkrecom.vercel.app"}`;
  const shareUrl = `${origin}/snsd/view/${id}`;
  const readerUrl = `${origin}/snsd/read/${id}${req.query?.from === "list" ? "?from=list" : ""}`;
  let work;

  try {
    const response = await fetch(`${SNSD_API_URL}/api/works/${id}`);
    if (!response.ok) return res.redirect(302, readerUrl);
    work = await response.json();
  } catch {
    return res.redirect(302, readerUrl);
  }

  const title = escapeHtml(`${work.title} · SNSDFF`);
  const description = escapeHtml(`${work.author} · ${work.pairing}`);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeReaderUrl = escapeHtml(readerUrl);
  const imageUrl = `${origin}/snsd-share-placeholder.png`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="SNSDFF">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${safeShareUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="SNSDFF 작품 썸네일">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <link rel="canonical" href="${safeShareUrl}">
    <script>location.replace(${JSON.stringify(readerUrl)})</script>
  </head>
  <body><a href="${safeReaderUrl}">${title} 읽기</a></body>
</html>`);
}
