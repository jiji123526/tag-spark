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

export async function readApiError(response: Response) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다.";
  }
}
