import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { computeRecommendations } from "../src/lib/reco.ts";
import type { Tag, TagSimilarity, Work, WorkTag } from "../src/lib/types.ts";
import {
  LEGACY_SIMILARITY_WEIGHT,
  LEGACY_TAG_CLUSTERS,
} from "./legacy-tag-clusters.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const sql = neon(connectionString);
const [works, tags, workTags, dbRows] = await Promise.all([
  sql`SELECT id, title, author, source_url, aliases, author_aliases, views, likes, comments, posted_at FROM works ORDER BY id`,
  sql`SELECT id, name, category, aliases FROM tags ORDER BY id`,
  sql`SELECT work_id, tag_id, weight FROM work_tags`,
  sql`
    SELECT tag_a_id, tag_b_id, weight, source
    FROM tag_similarity
    WHERE source = 'curated'
    ORDER BY tag_a_id, tag_b_id
  `,
]) as [Work[], Tag[], WorkTag[], TagSimilarity[]];

const nameToId = new Map<string, number>();
for (const tag of tags) {
  nameToId.set(tag.name, tag.id);
  for (const alias of tag.aliases ?? []) nameToId.set(alias, tag.id);
}

const legacyPairMap = new Map<string, TagSimilarity>();
for (const cluster of LEGACY_TAG_CLUSTERS) {
  const ids = cluster
    .map((name) => nameToId.get(name))
    .filter((id): id is number => Number.isInteger(id))
    .sort((a, b) => a - b);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (ids[i] === ids[j]) continue;
      legacyPairMap.set(`${ids[i]}:${ids[j]}`, {
        tag_a_id: ids[i],
        tag_b_id: ids[j],
        weight: LEGACY_SIMILARITY_WEIGHT,
        source: "curated",
      });
    }
  }
}

const legacyRows = [...legacyPairMap.values()].sort(
  (a, b) => a.tag_a_id - b.tag_a_id || a.tag_b_id - b.tag_b_id,
);

assert.deepEqual(dbRows, legacyRows, "DB edges differ from the legacy runtime graph");

const tagIds = tags.filter((tag) => tag.id !== 900).map((tag) => tag.id);
const cases: number[][] = tagIds.map((id) => [id]);
for (let i = 0; i < tagIds.length; i++) {
  for (let j = i + 1; j < tagIds.length; j++) cases.push([tagIds[i], tagIds[j]]);
}

for (const selectedTagIds of cases) {
  const common = { works, tags, workTags, similarMax: 20 };
  const legacyResult = computeRecommendations(selectedTagIds, {
    ...common,
    tagSimilarity: legacyRows,
  }).map((work) => work.id);
  const dbResult = computeRecommendations(selectedTagIds, {
    ...common,
    tagSimilarity: dbRows,
  }).map((work) => work.id);

  assert.deepEqual(
    dbResult,
    legacyResult,
    `Recommendation parity failed for tags ${selectedTagIds.join(",")}`,
  );
}

console.log(
  `PARITY_OK edges=${dbRows.length} recommendation_cases=${cases.length} works=${works.length}`,
);
