import { queryOptions } from "@tanstack/react-query";
import { Tag, Work, WorkTag } from "@/lib/types";

const TAGS_STALE_TIME_MS = 5 * 60 * 1000;
const RECO_DATA_STALE_TIME_MS = 5 * 60 * 1000;

export type RecoData = {
  works: Work[];
  tags: Tag[];
  workTags: WorkTag[];
};

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

async function fetchRecoData(): Promise<RecoData> {
  const response = await fetch("/api/reco-data");
  if (!response.ok) throw new Error("Failed to load recommendation data");
  return response.json();
}

export const recoDataQueryOptions = queryOptions({
  queryKey: ["reco-data"],
  queryFn: fetchRecoData,
  staleTime: RECO_DATA_STALE_TIME_MS,
  gcTime: 30 * 60 * 1000,
});
