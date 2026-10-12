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

export type SnsdReadProgress = {
  lastReadAt: number;
  progress: number;
  scrollY: number;
};

const configuredBaseUrl = import.meta.env.VITE_SNSD_API_URL?.trim();
export const SNSD_API_URL = configuredBaseUrl?.replace(/\/$/, "") ?? "http://localhost:8787";
export const SNSD_READ_HISTORY_KEY = "snsd-read-history";
export const SNSD_READ_PROGRESS_PREFIX = "snsd-read-progress-";
const SNSD_CONTENT_CACHE_NAME = "snsd-content-v2";
const SNSD_VIEWER_WORK_CACHE_PREFIX = "snsd-viewer-work-";
const SNSD_VIEWER_WORK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const viewerContentRequests = new Map<number, Promise<void>>();

export function snsdApiUrl(path: string) {
  return `${SNSD_API_URL}${path}`;
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
  cacheSnsdViewerWork(work);
  const existing = viewerContentRequests.get(work.id);
  if (existing) return existing;
  const request = fetch(snsdApiUrl(`/api/works/${work.id}/content`), { cache: "force-cache" })
    .then(async response => {
      if (response.ok) await response.arrayBuffer();
    })
    .catch(() => undefined)
    .finally(() => viewerContentRequests.delete(work.id));
  viewerContentRequests.set(work.id, request);
  return request;
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

async function fetchAndCacheSnsdViewerContent(workId: string | number, signal?: AbortSignal) {
  const url = snsdApiUrl(`/api/works/${workId}/content`);
  try {
    const response = await fetch(url, { signal, cache: "force-cache" });
    if (response.ok && "caches" in window) {
      try {
        const cache = await window.caches.open(SNSD_CONTENT_CACHE_NAME);
        await cache.put(url, response.clone());
      } catch {
        // Reading should still succeed if Cache Storage is unavailable or full.
      }
    }
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const cached = await getCachedSnsdViewerContent(workId);
    if (cached) return cached;
    throw error;
  }
}

export function fetchSnsdViewerContent(workId: string | number, signal?: AbortSignal) {
  return fetchAndCacheSnsdViewerContent(workId, signal);
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
