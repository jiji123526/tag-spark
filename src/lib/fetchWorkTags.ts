// 공용 fetch 유틸 (no-cache)
export type WorkTag = { work_id: number; tag_id: number; weight: number };

export async function fetchWorkTags(): Promise<WorkTag[]> {
  const res = await fetch("/api/work-tags", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load /api/work-tags: ${res.status}`);
  return res.json();
}