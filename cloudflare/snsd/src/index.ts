interface Env {
  tagspark_snsd: D1Database;
  FILES: R2Bucket;
  ALLOWED_ORIGIN: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGIN.split(",").map(value => value.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] ?? "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(request: Request, env: Env, body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request, env) });
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function listWorks(request: Request, env: Env, url: URL) {
  const order = url.searchParams.get("sort") === "new"
    ? "w.created_at DESC"
    : "score DESC, w.created_at DESC";
  const result = await env.tagspark_snsd.prepare(`
    SELECT w.id, w.title, w.author, w.pairing, w.reason, w.original_filename,
      w.file_size, w.created_at,
      COUNT(DISTINCT l.voter) AS score,
      COUNT(DISTINCT c.id) AS comment_count
    FROM works w
    LEFT JOIN likes l ON l.work_id = w.id
    LEFT JOIN comments c ON c.work_id = w.id
    GROUP BY w.id
    ORDER BY ${order}
  `).all();
  return json(request, env, result.results);
}

async function createWork(request: Request, env: Env) {
  const form = await request.formData();
  const title = cleanText(form.get("title"), 120);
  const author = cleanText(form.get("author"), 80);
  const pairing = cleanText(form.get("pairing"), 80);
  const reason = cleanText(form.get("reason"), 1000);
  const createdBy = cleanText(form.get("createdBy"), 100);
  const file = form.get("file");

  if (!title || !author || !pairing || !reason || !createdBy || !(file instanceof File)) {
    return json(request, env, { error: "모든 항목을 입력해주세요." }, 400);
  }
  if (!file.name.toLowerCase().endsWith(".txt") || (file.type && !file.type.startsWith("text/plain"))) {
    return json(request, env, { error: "TXT 파일만 업로드할 수 있습니다." }, 400);
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return json(request, env, { error: "파일 크기는 1바이트 이상 5MB 이하여야 합니다." }, 400);
  }

  const bytes = await file.arrayBuffer();
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return json(request, env, { error: "UTF-8로 저장된 TXT 파일만 업로드할 수 있습니다." }, 400);
  }

  const objectKey = `works/${crypto.randomUUID()}.txt`;
  await env.FILES.put(objectKey, bytes, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { originalFilename: file.name },
  });

  try {
    const result = await env.tagspark_snsd.prepare(`
      INSERT INTO works (title, author, pairing, reason, object_key, original_filename, file_size, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(title, author, pairing, reason, objectKey, file.name.slice(0, 255), file.size, createdBy).run();
    return json(request, env, { id: result.meta.last_row_id }, 201);
  } catch (error) {
    await env.FILES.delete(objectKey);
    throw error;
  }
}

async function getWork(request: Request, env: Env, workId: number) {
  const work = await env.tagspark_snsd.prepare(`
    SELECT w.id, w.title, w.author, w.pairing, w.reason, w.original_filename,
      w.file_size, w.created_at,
      COUNT(DISTINCT l.voter) AS score,
      COUNT(DISTINCT c.id) AS comment_count
    FROM works w
    LEFT JOIN likes l ON l.work_id = w.id
    LEFT JOIN comments c ON c.work_id = w.id
    WHERE w.id = ?
    GROUP BY w.id
  `).bind(workId).first();
  return work ? json(request, env, work) : json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
}

async function getContent(request: Request, env: Env, workId: number) {
  const work = await env.tagspark_snsd.prepare("SELECT object_key FROM works WHERE id = ?").bind(workId).first<{ object_key: string }>();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const object = await env.FILES.get(work.object_key);
  if (!object) return json(request, env, { error: "파일을 찾을 수 없습니다." }, 404);
  const headers = new Headers(corsHeaders(request, env));
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function toggleVote(request: Request, env: Env, workId: number) {
  const body = await request.json<{ voter?: string }>();
  const voter = body.voter?.trim().slice(0, 100);
  if (!voter) return json(request, env, { error: "사용자 식별자가 필요합니다." }, 400);
  const work = await env.tagspark_snsd.prepare("SELECT id FROM works WHERE id = ?").bind(workId).first();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const existing = await env.tagspark_snsd.prepare("SELECT 1 AS found FROM likes WHERE work_id = ? AND voter = ?").bind(workId, voter).first();
  if (existing) {
    await env.tagspark_snsd.prepare("DELETE FROM likes WHERE work_id = ? AND voter = ?").bind(workId, voter).run();
  } else {
    await env.tagspark_snsd.prepare("INSERT INTO likes (work_id, voter) VALUES (?, ?)").bind(workId, voter).run();
  }
  const count = await env.tagspark_snsd.prepare("SELECT COUNT(*) AS score FROM likes WHERE work_id = ?").bind(workId).first<{ score: number }>();
  return json(request, env, { voted: !existing, score: Number(count?.score ?? 0) });
}

async function listComments(request: Request, env: Env, workId: number) {
  const result = await env.tagspark_snsd.prepare("SELECT id, work_id, author, content, created_at FROM comments WHERE work_id = ? ORDER BY created_at ASC").bind(workId).all();
  return json(request, env, result.results);
}

async function createComment(request: Request, env: Env, workId: number) {
  const body = await request.json<{ author?: string; content?: string }>();
  const author = body.author?.trim().slice(0, 40) || "익명";
  const content = body.content?.trim().slice(0, 1000);
  if (!content) return json(request, env, { error: "댓글을 입력해주세요." }, 400);
  const work = await env.tagspark_snsd.prepare("SELECT id FROM works WHERE id = ?").bind(workId).first();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const result = await env.tagspark_snsd.prepare("INSERT INTO comments (work_id, author, content) VALUES (?, ?, ?)").bind(workId, author, content).run();
  const comment = await env.tagspark_snsd.prepare("SELECT id, work_id, author, content, created_at FROM comments WHERE id = ?").bind(result.meta.last_row_id).first();
  return json(request, env, comment, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      if (parts[0] !== "api" || parts[1] !== "works") return json(request, env, { error: "Not found" }, 404);
      if (parts.length === 2 && request.method === "GET") return listWorks(request, env, url);
      if (parts.length === 2 && request.method === "POST") return createWork(request, env);

      const workId = parseId(parts[2]);
      if (!workId) return json(request, env, { error: "잘못된 작품 ID입니다." }, 400);
      if (parts.length === 3 && request.method === "GET") return getWork(request, env, workId);
      if (parts[3] === "content" && request.method === "GET") return getContent(request, env, workId);
      if (parts[3] === "vote" && request.method === "POST") return toggleVote(request, env, workId);
      if (parts[3] === "comments" && request.method === "GET") return listComments(request, env, workId);
      if (parts[3] === "comments" && request.method === "POST") return createComment(request, env, workId);
      return json(request, env, { error: "Not found" }, 404);
    } catch (error) {
      console.error(error);
      return json(request, env, { error: "서버 요청을 처리하지 못했습니다." }, 500);
    }
  },
};
