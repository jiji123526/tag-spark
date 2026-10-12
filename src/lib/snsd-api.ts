export type SnsdWork = {
  id: number;
  title: string;
  author: string;
  pairing: string;
  reason: string;
  original_filename: string;
  file_size: number;
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
};

const configuredBaseUrl = import.meta.env.VITE_SNSD_API_URL?.trim();
export const SNSD_API_URL = configuredBaseUrl?.replace(/\/$/, "") ?? "http://localhost:8787";
export const SNSD_READ_HISTORY_KEY = "snsd-read-history";

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

export async function readApiError(response: Response) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다.";
  }
}
