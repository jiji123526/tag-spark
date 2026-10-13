export type SnsdWork = {
  id: number;
  title: string;
  author: string;
  pairing: string;
  reason: string;
  original_filename: string;
  file_size: number;
  chapter_count?: number | null;
  created_at: string;
  score: number;
  comment_count: number;
  preview_comment?: string | null;
  is_owner?: number | boolean;
};

export type SnsdComment = {
  id: number;
  work_id: number;
  author: string;
  content: string;
  created_at: string;
  is_owner?: number | boolean;
};

export type SnsdManualChapter = {
  id: number;
  work_id: number;
  title: string;
  paragraph_index: number;
  char_offset: number;
  anchor_text: string;
  created_by?: string;
  created_at: string;
  is_owner?: number | boolean;
  can_manage?: number | boolean;
  replaces_paragraph_index?: number | null;
  replaces_char_offset?: number | null;
};

export type SnsdReadProgress = {
  lastReadAt: number;
  progress: number;
  scrollY: number;
};

const configuredBaseUrl = import.meta.env.VITE_SNSD_API_URL?.trim();
export const SNSD_API_URL = configuredBaseUrl?.replace(/\/$/, "") ?? "http://localhost:8787";
export const SNSD_READ_HISTORY_KEY = "snsd-read-history";
export const SNSD_READ_PROGRESS_PREFIX = "snsd-read-progress-";
const SNSD_CONTENT_CACHE_NAME = "snsd-content-v3";
const SNSD_VIEWER_WORK_CACHE_PREFIX = "snsd-viewer-work-";
const SNSD_VIEWER_WORK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const viewerContentRequests = new Map<number, {
  request: Promise<Response>;
  controller: AbortController;
}>();

export function snsdApiUrl(path: string) {
  return `${SNSD_API_URL}${path}`;
}

export async function fetchSnsdManualChapters(workId: string | number, signal?: AbortSignal) {
  const response = await fetch(snsdApiUrl(`/api/works/${workId}/chapters?viewer=${encodeURIComponent(getSnsdUserId())}`), { signal });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<SnsdManualChapter[]>;
}

export async function createSnsdManualChapter(workId: string | number, chapter: Pick<SnsdManualChapter, "title" | "paragraph_index" | "char_offset" | "anchor_text"> & Partial<Pick<SnsdManualChapter, "replaces_paragraph_index" | "replaces_char_offset">>) {
  const response = await fetch(snsdApiUrl(`/api/works/${workId}/chapters`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: chapter.title,
      paragraphIndex: chapter.paragraph_index,
      charOffset: chapter.char_offset,
      anchorText: chapter.anchor_text,
      replacesParagraphIndex: chapter.replaces_paragraph_index,
      replacesCharOffset: chapter.replaces_char_offset,
      createdBy: getSnsdUserId(),
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<SnsdManualChapter>;
}

export async function updateSnsdManualChapter(workId: string | number, chapterId: number, chapter: Pick<SnsdManualChapter, "title" | "paragraph_index" | "char_offset" | "anchor_text"> & Partial<Pick<SnsdManualChapter, "replaces_paragraph_index" | "replaces_char_offset">>): Promise<void> {
  const response = await fetch(snsdApiUrl(`/api/works/${workId}/chapters/${chapterId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: chapter.title,
      paragraphIndex: chapter.paragraph_index,
      charOffset: chapter.char_offset,
      anchorText: chapter.anchor_text,
      replacesParagraphIndex: chapter.replaces_paragraph_index,
      replacesCharOffset: chapter.replaces_char_offset,
      createdBy: getSnsdUserId(),
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

export async function deleteSnsdManualChapter(workId: string | number, chapterId: number) {
  const response = await fetch(snsdApiUrl(`/api/works/${workId}/chapters/${chapterId}`), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ createdBy: getSnsdUserId() }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

export function getSnsdUserId() {
  const key = "snsd-user-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export function getSnsdReadHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNSD_READ_HISTORY_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {} as Record<string, number>;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value))) as Record<string, number>;
  } catch {
    return {} as Record<string, number>;
  }
}

export function markSnsdWorkRead(workId: string | number) {
  const history = getSnsdReadHistory();
  history[String(workId)] = Date.now();
  window.localStorage.setItem(SNSD_READ_HISTORY_KEY, JSON.stringify(history));
}

export function getSnsdReadProgress(workId: string | number) {
  try {
    const stored = window.localStorage.getItem(`${SNSD_READ_PROGRESS_PREFIX}${workId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SnsdReadProgress>;
    if (typeof parsed.lastReadAt !== "number" || typeof parsed.progress !== "number" || typeof parsed.scrollY !== "number") return null;
    return {
      lastReadAt: parsed.lastReadAt,
      progress: Math.min(1, Math.max(0, parsed.progress)),
      scrollY: Math.max(0, parsed.scrollY),
    };
  } catch {
    return null;
  }
}

export function getSnsdReadProgressMap() {
  const progress: Record<string, SnsdReadProgress> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(SNSD_READ_PROGRESS_PREFIX)) continue;
    const workId = key.slice(SNSD_READ_PROGRESS_PREFIX.length);
    const value = getSnsdReadProgress(workId);
    if (value) progress[workId] = value;
  }
  return progress;
}

export function saveSnsdReadProgress(workId: string | number, value: Omit<SnsdReadProgress, "lastReadAt"> & { lastReadAt?: number }) {
  const progress: SnsdReadProgress = {
    lastReadAt: value.lastReadAt ?? Date.now(),
    progress: Math.min(1, Math.max(0, value.progress)),
    scrollY: Math.max(0, value.scrollY),
  };
  window.localStorage.setItem(`${SNSD_READ_PROGRESS_PREFIX}${workId}`, JSON.stringify(progress));
  markSnsdWorkRead(workId);
}

export function cacheSnsdViewerWork(work: SnsdWork) {
  try {
    window.localStorage.setItem(`${SNSD_VIEWER_WORK_CACHE_PREFIX}${work.id}`, JSON.stringify({
      work,
      cachedAt: Date.now(),
    }));
  } catch {
    // The viewer still works through the API when storage is unavailable.
  }
}

export function getCachedSnsdViewerWork(workId: string | number) {
  try {
    const stored = window.localStorage.getItem(`${SNSD_VIEWER_WORK_CACHE_PREFIX}${workId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { work?: SnsdWork; cachedAt?: number };
    if (!parsed.work || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > SNSD_VIEWER_WORK_CACHE_TTL_MS) return null;
    return String(parsed.work.id) === String(workId) ? parsed.work : null;
  } catch {
    return null;
  }
}

export function prefetchSnsdViewer(work: SnsdWork) {
  const existing = viewerContentRequests.get(work.id);
  if (existing) return existing.request.catch(() => undefined);
  const controller = new AbortController();
  const request = fetch(snsdApiUrl(`/api/works/${work.id}/content`), {
    signal: controller.signal,
    cache: "no-store",
  }).finally(() => {
    if (viewerContentRequests.get(work.id)?.request === request) viewerContentRequests.delete(work.id);
  });
  viewerContentRequests.set(work.id, { request, controller });
  return request.catch(() => undefined);
}

export function cancelPrefetchSnsdViewer(workId: number) {
  viewerContentRequests.get(workId)?.controller.abort();
}

export async function getCachedSnsdViewerContent(workId: string | number) {
  try {
    if (!("caches" in window)) return null;
    const cache = await window.caches.open(SNSD_CONTENT_CACHE_NAME);
    return cache.match(snsdApiUrl(`/api/works/${workId}/content`));
  } catch {
    return null;
  }
}

async function fetchAndCacheSnsdViewerContent(
  workId: string | number,
  signal?: AbortSignal,
  options: { cacheForOffline?: boolean } = {},
) {
  const url = snsdApiUrl(`/api/works/${workId}/content`);
  const cached = await getCachedSnsdViewerContent(workId);
  if (cached) return cached;

  try {
    const prefetchedRequest = viewerContentRequests.get(Number(workId))?.request;
    let response: Response;
    let reusedPrefetch = false;
    if (prefetchedRequest) {
      try {
        response = await prefetchedRequest;
        reusedPrefetch = true;
      } catch {
        response = await fetch(url, { signal, cache: "no-store" });
      }
    } else {
      response = await fetch(url, { signal, cache: "no-store" });
    }
    if (options.cacheForOffline && response.ok && "caches" in window) {
      try {
        const cache = await window.caches.open(SNSD_CONTENT_CACHE_NAME);
        await cache.put(url, response.clone());
      } catch {
        // Reading should still succeed if Cache Storage is unavailable or full.
      }
    }
    return reusedPrefetch ? response.clone() : response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const fallbackCached = await getCachedSnsdViewerContent(workId);
    if (fallbackCached) return fallbackCached;
    throw error;
  }
}

export function fetchSnsdViewerContent(
  workId: string | number,
  signal?: AbortSignal,
  options?: { cacheForOffline?: boolean },
) {
  return fetchAndCacheSnsdViewerContent(workId, signal, options);
}

export async function getCachedSnsdViewerWorkIds(workIds: number[]) {
  if (!("caches" in window) || workIds.length === 0) return new Set<number>();
  try {
    const cache = await window.caches.open(SNSD_CONTENT_CACHE_NAME);
    const cachedIds = await Promise.all(workIds.map(async workId => (
      (await cache.match(snsdApiUrl(`/api/works/${workId}/content`))) ? workId : null
    )));
    return new Set(cachedIds.filter((workId): workId is number => workId !== null));
  } catch {
    return new Set<number>();
  }
}

export async function removeCachedSnsdViewerContent(workId: string | number) {
  if (!("caches" in window)) return false;
  const cache = await window.caches.open(SNSD_CONTENT_CACHE_NAME);
  return cache.delete(snsdApiUrl(`/api/works/${workId}/content`));
}

export async function hasCachedSnsdViewerContent(workId: string | number) {
  return Boolean(await getCachedSnsdViewerContent(workId));
}

export async function readApiError(response: Response) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다.";
  }
}
