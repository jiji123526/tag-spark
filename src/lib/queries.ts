import { queryOptions } from "@tanstack/react-query";
import { Tag } from "@/lib/types";

const TAGS_STALE_TIME_MS = 5 * 60 * 1000;

async function fetchTags(): Promise<Tag[]> {
  const response = await fetch("/api/tags");
  if (!response.ok) throw new Error("Failed to load tags");
  return response.json();
}

export const tagsQueryOptions = queryOptions({
  queryKey: ["tags"],
  queryFn: fetchTags,
  staleTime: TAGS_STALE_TIME_MS,
  gcTime: 30 * 60 * 1000,
});
