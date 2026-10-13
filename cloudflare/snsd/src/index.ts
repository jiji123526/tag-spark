import iconv from "iconv-lite";
import { countSnsdChapters } from "../../../src/lib/snsd-chapters";

interface Env {
  tagspark_snsd: D1Database;
  FILES: R2Bucket;
  ALLOWED_ORIGIN: string;
  SNSD_MAINTENANCE_TOKEN?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

function decodeUploadedText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: iconv.decode(bytes, "utf16-le"), encoding: "utf-16le" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: iconv.decode(bytes, "utf16-be"), encoding: "utf-16be" };
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    const text = iconv.decode(bytes, "cp949");
    const roundTrip = new Uint8Array(iconv.encode(text, "cp949"));
    if (bytesEqual(bytes, roundTrip)) return { text, encoding: "cp949" };
    throw new Error("unsupported-encoding");
  }
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGIN.split(",").map(value => value.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] ?? "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

function downloadFilename(work: { title: string; author: string; pairing: string }) {
  const safePart = (value: string, maxLength: number) => value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  const pairing = safePart(work.pairing, 60) || "커플링 미상";
  const title = safePart(work.title.replace(/\.txt$/i, ""), 120) || "제목 없음";
  const author = safePart(work.author, 80) || "작가 미상";
  return `[${pairing}] ${title} w.${author}.txt`;
}

async function listWorks(request: Request, env: Env, url: URL) {
  const viewer = url.searchParams.get("viewer")?.trim().slice(0, 100) ?? "";
  const order = url.searchParams.get("sort") === "new"
    ? "w.created_at DESC"
    : "score DESC, w.created_at DESC";
  const result = await env.tagspark_snsd.prepare(`
    WITH like_counts AS (
      SELECT work_id, COUNT(*) AS score
      FROM likes
      GROUP BY work_id
    ),
    comment_counts AS (
      SELECT work_id, COUNT(*) AS comment_count
      FROM comments
      GROUP BY work_id
    )
    SELECT w.id, w.title, w.author, w.pairing, w.reason, w.original_filename,
      w.file_size, w.chapter_count, w.created_at,
      COALESCE(lc.score, 0) AS score,
      COALESCE(cc.comment_count, 0) AS comment_count,
      (SELECT preview.content FROM comments preview WHERE preview.work_id = w.id ORDER BY preview.created_at ASC, preview.id ASC LIMIT 1) AS preview_comment,
      CASE WHEN w.created_by = ? THEN 1 ELSE 0 END AS is_owner
    FROM works w
    LEFT JOIN like_counts lc ON lc.work_id = w.id
    LEFT JOIN comment_counts cc ON cc.work_id = w.id
    ORDER BY ${order}
  `).bind(viewer).all();
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

  if (!title || !author || !pairing || !createdBy || !(file instanceof File)) {
    return json(request, env, { error: "모든 필수 항목을 입력해주세요." }, 400);
  }
  if (!file.name.toLowerCase().endsWith(".txt") || (file.type && !file.type.startsWith("text/plain"))) {
    return json(request, env, { error: "TXT 파일만 업로드할 수 있습니다." }, 400);
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return json(request, env, { error: "파일 크기는 1바이트 이상 5MB 이하여야 합니다." }, 400);
  }

  const bytes = await file.arrayBuffer();
  let decoded: ReturnType<typeof decodeUploadedText>;
  try {
    decoded = decodeUploadedText(bytes);
  } catch {
    return json(request, env, { error: "지원하지 않는 문자 인코딩입니다. UTF-8, UTF-16, CP949/EUC-KR TXT 파일을 사용해주세요." }, 400);
  }

  const utf8Bytes = new TextEncoder().encode(decoded.text);
  const chapterCount = countSnsdChapters(decoded.text);

  const objectKey = `works/${crypto.randomUUID()}.txt`;
  await env.FILES.put(objectKey, utf8Bytes, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { originalFilename: file.name, sourceEncoding: decoded.encoding },
  });

  try {
    const result = await env.tagspark_snsd.prepare(`
      INSERT INTO works (title, author, pairing, reason, object_key, original_filename, file_size, chapter_count, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(title, author, pairing, reason, objectKey, file.name.slice(0, 255), utf8Bytes.byteLength, chapterCount || null, createdBy).run();
    return json(request, env, { id: result.meta.last_row_id }, 201);
  } catch (error) {
    await env.FILES.delete(objectKey);
    throw error;
  }
}

async function recalculateChapterCounts(request: Request, env: Env, url: URL) {
  const expectedToken = env.SNSD_MAINTENANCE_TOKEN?.trim();
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expectedToken) return json(request, env, { error: "유지보수 토큰이 설정되지 않았습니다." }, 503);
  if (!token || token !== expectedToken) return json(request, env, { error: "인증이 필요합니다." }, 401);

  const requestedId = url.searchParams.get("workId");
  const workId = requestedId ? parseId(requestedId) : null;
  if (requestedId && !workId) return json(request, env, { error: "잘못된 작품 ID입니다." }, 400);

  const query = workId
    ? env.tagspark_snsd.prepare("SELECT id, object_key FROM works WHERE id = ?").bind(workId)
    : env.tagspark_snsd.prepare("SELECT id, object_key FROM works ORDER BY id");
  const result = await query.all<{ id: number; object_key: string }>();
  const updated: Array<{ id: number; chapterCount: number | null }> = [];
  const failed: Array<{ id: number; reason: string }> = [];

  for (const work of result.results) {
    try {
      const object = await env.FILES.get(work.object_key);
      if (!object) throw new Error("파일을 찾을 수 없습니다.");
      const decoded = decodeUploadedText(await object.arrayBuffer());
      const count = countSnsdChapters(decoded.text);
      await env.tagspark_snsd.prepare("UPDATE works SET chapter_count = ? WHERE id = ?")
        .bind(count || null, work.id)
        .run();
      updated.push({ id: work.id, chapterCount: count || null });
    } catch (error) {
      failed.push({
        id: work.id,
        reason: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  return json(request, env, {
    processed: result.results.length,
    updated,
    failed,
  });
}

async function getWork(request: Request, env: Env, workId: number) {
  const work = await env.tagspark_snsd.prepare(`
    WITH like_counts AS (
      SELECT work_id, COUNT(*) AS score
      FROM likes
      WHERE work_id = ?
      GROUP BY work_id
    ),
    comment_counts AS (
      SELECT work_id, COUNT(*) AS comment_count
      FROM comments
      WHERE work_id = ?
      GROUP BY work_id
    )
    SELECT w.id, w.title, w.author, w.pairing, w.reason, w.original_filename,
      w.file_size, w.chapter_count, w.created_at,
      COALESCE(lc.score, 0) AS score,
      COALESCE(cc.comment_count, 0) AS comment_count,
      (SELECT preview.content FROM comments preview WHERE preview.work_id = w.id ORDER BY preview.created_at ASC, preview.id ASC LIMIT 1) AS preview_comment
    FROM works w
    LEFT JOIN like_counts lc ON lc.work_id = w.id
    LEFT JOIN comment_counts cc ON cc.work_id = w.id
    WHERE w.id = ?
  `).bind(workId, workId, workId).first();
  return work ? json(request, env, work) : json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
}

async function getContent(request: Request, env: Env, workId: number) {
  const work = await env.tagspark_snsd.prepare("SELECT object_key, title, author, pairing FROM works WHERE id = ?").bind(workId).first<{ object_key: string; title: string; author: string; pairing: string }>();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const object = await env.FILES.get(work.object_key);
  if (!object) return json(request, env, { error: "파일을 찾을 수 없습니다." }, 404);
  const headers = new Headers(corsHeaders(request, env));
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = downloadFilename(work);
  headers.set("Content-Disposition", download
    ? `attachment; filename="work-${workId}.txt"; filename*=UTF-8''${encodeURIComponent(filename)}`
    : "inline");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function listWorkChapters(request: Request, env: Env, workId: number) {
  const viewer = new URL(request.url).searchParams.get("viewer")?.trim().slice(0, 100) ?? "";
  const work = await env.tagspark_snsd.prepare("SELECT created_by FROM works WHERE id = ?").bind(workId).first<{ created_by: string }>();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const result = await env.tagspark_snsd.prepare(`
    SELECT id, work_id, title, paragraph_index, char_offset, anchor_text, created_at,
      replaces_paragraph_index, replaces_char_offset,
      CASE WHEN created_by = ? THEN 1 ELSE 0 END AS is_owner,
      CASE WHEN created_by = ? OR ? = ? THEN 1 ELSE 0 END AS can_manage
    FROM work_chapters
    WHERE work_id = ?
    ORDER BY paragraph_index, char_offset, id
  `).bind(viewer, viewer, work.created_by, viewer, workId).all();
  return json(request, env, result.results);
}

async function createWorkChapter(request: Request, env: Env, workId: number) {
  const body = await request.json<{ title?: string; paragraphIndex?: number; charOffset?: number; anchorText?: string; replacesParagraphIndex?: number; replacesCharOffset?: number; createdBy?: string }>();
  const title = body.title?.trim().slice(0, 120) ?? "";
  const paragraphIndex = body.paragraphIndex;
  const charOffset = body.charOffset;
  const anchorText = body.anchorText?.trim().slice(0, 160) ?? "";
  const replacesParagraphIndex = body.replacesParagraphIndex;
  const replacesCharOffset = body.replacesCharOffset;
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!title || !createdBy || !Number.isInteger(paragraphIndex) || paragraphIndex! < 0 || !Number.isInteger(charOffset) || charOffset! < 0) {
    return json(request, env, { error: "목차 제목과 위치 정보가 필요합니다." }, 400);
  }
  if ((replacesParagraphIndex === undefined) !== (replacesCharOffset === undefined)
    || (replacesParagraphIndex !== undefined && (!Number.isInteger(replacesParagraphIndex) || replacesParagraphIndex < 0 || !Number.isInteger(replacesCharOffset) || replacesCharOffset! < 0))) {
    return json(request, env, { error: "수정할 기존 목차 위치가 올바르지 않습니다." }, 400);
  }
  const work = await env.tagspark_snsd.prepare("SELECT id FROM works WHERE id = ?").bind(workId).first();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const duplicate = await env.tagspark_snsd.prepare("SELECT id FROM work_chapters WHERE work_id = ? AND paragraph_index = ? AND char_offset = ?")
    .bind(workId, paragraphIndex, charOffset).first();
  if (duplicate) return json(request, env, { error: "이미 이 위치에 목차가 있습니다." }, 409);
  let result;
  try {
    result = await env.tagspark_snsd.prepare(`
      INSERT INTO work_chapters (work_id, title, paragraph_index, char_offset, anchor_text, created_by, replaces_paragraph_index, replaces_char_offset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(workId, title, paragraphIndex, charOffset, anchorText, createdBy, replacesParagraphIndex ?? null, replacesCharOffset ?? null).run();
  } catch {
    return json(request, env, { error: "이미 이 위치에 목차가 있습니다." }, 409);
  }
  const chapter = await env.tagspark_snsd.prepare(`
    SELECT id, work_id, title, paragraph_index, char_offset, anchor_text, created_at,
      replaces_paragraph_index, replaces_char_offset,
      1 AS is_owner, 1 AS can_manage
    FROM work_chapters WHERE id = ?
  `).bind(result.meta.last_row_id).first();
  return json(request, env, chapter, 201);
}

async function updateWorkChapter(request: Request, env: Env, workId: number, chapterId: number) {
  const body = await request.json<{ title?: string; paragraphIndex?: number; charOffset?: number; anchorText?: string; replacesParagraphIndex?: number | null; replacesCharOffset?: number | null; createdBy?: string }>();
  const title = body.title?.trim().slice(0, 120) ?? "";
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!title || !createdBy) return json(request, env, { error: "목차 제목을 입력해주세요." }, 400);
  const chapter = await env.tagspark_snsd.prepare(`
    SELECT c.id, w.created_by AS work_creator FROM work_chapters c
    JOIN works w ON w.id = c.work_id
    WHERE c.id = ? AND c.work_id = ?
  `).bind(chapterId, workId).first<{ id: number; work_creator: string }>();
  if (!chapter) return json(request, env, { error: "목차를 찾을 수 없습니다." }, 404);
  if (chapter.work_creator !== createdBy) {
    const ownChapter = await env.tagspark_snsd.prepare("SELECT id FROM work_chapters WHERE id = ? AND created_by = ?").bind(chapterId, createdBy).first();
    if (!ownChapter) return json(request, env, { error: "목차 작성자 또는 작품 작성자만 수정할 수 있습니다." }, 403);
  }
  const paragraphIndex = body.paragraphIndex;
  const charOffset = body.charOffset;
  const anchorText = body.anchorText?.trim().slice(0, 160) ?? "";
  const replacesParagraphIndex = body.replacesParagraphIndex ?? null;
  const replacesCharOffset = body.replacesCharOffset ?? null;
  if (!Number.isInteger(paragraphIndex) || paragraphIndex! < 0 || !Number.isInteger(charOffset) || charOffset! < 0) {
    return json(request, env, { error: "새 목차 위치가 올바르지 않습니다." }, 400);
  }
  if ((replacesParagraphIndex === null) !== (replacesCharOffset === null)
    || (replacesParagraphIndex !== null && (!Number.isInteger(replacesParagraphIndex) || replacesParagraphIndex < 0 || !Number.isInteger(replacesCharOffset) || replacesCharOffset! < 0))) {
    return json(request, env, { error: "기존 목차 위치가 올바르지 않습니다." }, 400);
  }
  const duplicate = await env.tagspark_snsd.prepare("SELECT id FROM work_chapters WHERE work_id = ? AND paragraph_index = ? AND char_offset = ? AND id <> ?")
    .bind(workId, paragraphIndex, charOffset, chapterId).first();
  if (duplicate) return json(request, env, { error: "이미 이 위치에 목차가 있습니다." }, 409);
  try {
    await env.tagspark_snsd.prepare("UPDATE work_chapters SET title = ?, paragraph_index = ?, char_offset = ?, anchor_text = ?, replaces_paragraph_index = ?, replaces_char_offset = ? WHERE id = ? AND work_id = ?")
      .bind(title, paragraphIndex, charOffset, anchorText, replacesParagraphIndex, replacesCharOffset, chapterId, workId).run();
  } catch {
    return json(request, env, { error: "이미 이 위치에 목차가 있습니다." }, 409);
  }
  return json(request, env, { success: true });
}

async function deleteWorkChapter(request: Request, env: Env, workId: number, chapterId: number) {
  const body = await request.json<{ createdBy?: string }>();
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!createdBy) return json(request, env, { error: "사용자 식별자가 필요합니다." }, 400);
  const chapter = await env.tagspark_snsd.prepare(`
    SELECT c.id, c.created_by AS chapter_creator, w.created_by AS work_creator
    FROM work_chapters c JOIN works w ON w.id = c.work_id
    WHERE c.id = ? AND c.work_id = ?
  `).bind(chapterId, workId).first<{ id: number; chapter_creator: string; work_creator: string }>();
  if (!chapter) return json(request, env, { error: "목차를 찾을 수 없습니다." }, 404);
  if (chapter.chapter_creator !== createdBy && chapter.work_creator !== createdBy) {
    return json(request, env, { error: "목차 작성자 또는 작품 작성자만 삭제할 수 있습니다." }, 403);
  }
  await env.tagspark_snsd.prepare("DELETE FROM work_chapters WHERE id = ? AND work_id = ?").bind(chapterId, workId).run();
  return json(request, env, { success: true });
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
  const viewer = new URL(request.url).searchParams.get("viewer")?.trim().slice(0, 100) ?? "";
  const result = await env.tagspark_snsd.prepare(`
    SELECT id, work_id, author, content, created_at,
      CASE WHEN created_by = ? THEN 1 ELSE 0 END AS is_owner
    FROM comments
    WHERE work_id = ?
    ORDER BY created_at ASC
  `).bind(viewer, workId).all();
  return new Response(JSON.stringify(result.results), {
    headers: {
      ...corsHeaders(request, env),
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
    },
  });
}

async function createComment(request: Request, env: Env, workId: number) {
  const body = await request.json<{ author?: string; content?: string; createdBy?: string }>();
  const author = body.author?.trim().slice(0, 40) || "익명";
  const content = body.content?.trim().slice(0, 1000);
  const createdBy = body.createdBy?.trim().slice(0, 100) || "";
  if (!content) return json(request, env, { error: "댓글을 입력해주세요." }, 400);
  if (!createdBy) return json(request, env, { error: "사용자 식별자가 필요합니다." }, 400);
  const work = await env.tagspark_snsd.prepare("SELECT id FROM works WHERE id = ?").bind(workId).first();
  if (!work) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  const result = await env.tagspark_snsd.prepare("INSERT INTO comments (work_id, author, content, created_by) VALUES (?, ?, ?, ?)").bind(workId, author, content, createdBy).run();
  const comment = await env.tagspark_snsd.prepare("SELECT id, work_id, author, content, created_at, 1 AS is_owner FROM comments WHERE id = ?").bind(result.meta.last_row_id).first();
  return json(request, env, comment, 201);
}

async function updateComment(request: Request, env: Env, workId: number, commentId: number) {
  const body = await request.json<{ content?: string; createdBy?: string }>();
  const content = body.content?.trim().slice(0, 1000) ?? "";
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!content) return json(request, env, { error: "댓글을 입력해주세요." }, 400);
  if (!createdBy) return json(request, env, { error: "사용자 식별자가 필요합니다." }, 400);
  const existing = await env.tagspark_snsd.prepare("SELECT id FROM comments WHERE id = ? AND work_id = ? AND created_by = ?").bind(commentId, workId, createdBy).first();
  if (!existing) return json(request, env, { error: "댓글 작성자만 수정할 수 있습니다." }, 403);
  await env.tagspark_snsd.prepare("UPDATE comments SET content = ? WHERE id = ? AND work_id = ?").bind(content, commentId, workId).run();
  const comment = await env.tagspark_snsd.prepare("SELECT id, work_id, author, content, created_at, 1 AS is_owner FROM comments WHERE id = ?").bind(commentId).first();
  return json(request, env, comment);
}

async function deleteComment(request: Request, env: Env, workId: number, commentId: number) {
  const body = await request.json<{ createdBy?: string }>();
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!createdBy) return json(request, env, { error: "사용자 식별자가 필요합니다." }, 400);
  const existing = await env.tagspark_snsd.prepare("SELECT id FROM comments WHERE id = ? AND work_id = ? AND created_by = ?").bind(commentId, workId, createdBy).first();
  if (!existing) return json(request, env, { error: "댓글 작성자만 삭제할 수 있습니다." }, 403);
  await env.tagspark_snsd.prepare("DELETE FROM comments WHERE id = ? AND work_id = ?").bind(commentId, workId).run();
  return json(request, env, { success: true });
}

async function updateWork(request: Request, env: Env, workId: number) {
  const body = await request.json<{ title?: string; author?: string; pairing?: string; reason?: string; createdBy?: string }>();
  const title = body.title?.trim().slice(0, 120) ?? "";
  const author = body.author?.trim().slice(0, 80) ?? "";
  const pairing = body.pairing?.trim().slice(0, 80) ?? "";
  const reason = body.reason?.trim().slice(0, 1000) ?? "";
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!title || !author || !pairing || !createdBy) {
    return json(request, env, { error: "모든 필수 항목을 입력해주세요." }, 400);
  }
  const existing = await env.tagspark_snsd.prepare("SELECT created_by FROM works WHERE id = ?").bind(workId).first<{ created_by: string }>();
  if (!existing) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  if (existing.created_by !== createdBy) return json(request, env, { error: "작성자만 수정할 수 있습니다." }, 403);
  await env.tagspark_snsd.prepare("UPDATE works SET title = ?, author = ?, pairing = ?, reason = ? WHERE id = ?")
    .bind(title, author, pairing, reason, workId).run();
  return json(request, env, { success: true });
}

async function deleteWork(request: Request, env: Env, workId: number) {
  const body = await request.json<{ createdBy?: string }>();
  const createdBy = body.createdBy?.trim().slice(0, 100) ?? "";
  if (!createdBy) return json(request, env, { error: "사용자 식별자가 필요합니다." }, 400);
  const existing = await env.tagspark_snsd.prepare("SELECT created_by, object_key FROM works WHERE id = ?").bind(workId).first<{ created_by: string; object_key: string }>();
  if (!existing) return json(request, env, { error: "작품을 찾을 수 없습니다." }, 404);
  if (existing.created_by !== createdBy) return json(request, env, { error: "작성자만 삭제할 수 있습니다." }, 403);
  await env.tagspark_snsd.prepare("DELETE FROM works WHERE id = ?").bind(workId).run();
  await env.FILES.delete(existing.object_key);
  return json(request, env, { success: true });
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
      if (parts.length === 3 && parts[2] === "recalculate-chapters" && request.method === "POST") {
        return recalculateChapterCounts(request, env, url);
      }

      const workId = parseId(parts[2]);
      if (!workId) return json(request, env, { error: "잘못된 작품 ID입니다." }, 400);
      if (parts.length === 3 && request.method === "GET") return getWork(request, env, workId);
      if (parts.length === 3 && request.method === "PUT") return updateWork(request, env, workId);
      if (parts.length === 3 && request.method === "DELETE") return deleteWork(request, env, workId);
      if (parts[3] === "content" && request.method === "GET") return getContent(request, env, workId);
      if (parts[3] === "chapters" && parts.length === 4 && request.method === "GET") return listWorkChapters(request, env, workId);
      if (parts[3] === "chapters" && parts.length === 4 && request.method === "POST") return createWorkChapter(request, env, workId);
      const chapterId = parseId(parts[4] ?? "");
      if (parts[3] === "chapters" && chapterId && request.method === "PUT") return updateWorkChapter(request, env, workId, chapterId);
      if (parts[3] === "chapters" && chapterId && request.method === "DELETE") return deleteWorkChapter(request, env, workId, chapterId);
      if (parts[3] === "vote" && request.method === "POST") return toggleVote(request, env, workId);
      if (parts[3] === "comments" && request.method === "GET") return listComments(request, env, workId);
      if (parts[3] === "comments" && request.method === "POST") return createComment(request, env, workId);
      const commentId = parseId(parts[4] ?? "");
      if (parts[3] === "comments" && commentId && request.method === "PUT") return updateComment(request, env, workId, commentId);
      if (parts[3] === "comments" && commentId && request.method === "DELETE") return deleteComment(request, env, workId, commentId);
      return json(request, env, { error: "Not found" }, 404);
    } catch (error) {
      console.error(error);
      return json(request, env, { error: "서버 요청을 처리하지 못했습니다." }, 500);
    }
  },
};
