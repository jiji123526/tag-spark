# TagSpark — Moving the Cluster Thesaurus from Hardcoded to Data (design)

> Problem: src/lib/reco.ts hardcodes `TAG_CLUSTERS_BY_NAME` (~15 clusters) with a single global
> `SIMILARITY_INTRA = 0.6`. Every new tag relationship requires a code edit + redeploy, weights can't
> vary per relationship, and the similarity graph is invisible to the rest of the system.
>
> Goal: make the thesaurus DATA (Neon Postgres), keep the exact same scoring behavior as a baseline,
> and open a path to per-edge weights and later learned embeddings.
> Grounded in the real stack: Neon serverless Postgres, db/migrations, types.ts, reco.ts.

---

## 1. Current state (what the code actually does)

```ts
// reco.ts (today)
const SIMILARITY_INTRA = 0.6;
const TAG_CLUSTERS_BY_NAME: string[][] = [
  ["청레", "챔퍼스", "선후배"],
  ["부부", "육아", "이혼", "정략결혼"],
  // ~15 clusters, by NAME
];
// names -> ids via buildNameToIdMap, then every intra-cluster pair gets SIMILARITY_INTRA
```

Limitations:
- clusters are keyed by **name** (breaks if a tag is renamed; aliases not first-class here)
- one global weight (can't say "부부↔이혼" is closer than "부부↔육아")
- graph lives in code, so it can't be edited, inspected, or reused by other features/analytics

## 2. Target data model (additive migration)

A single, directed-or-undirected edge table is enough. Keep it minimal and typed.

```sql
-- db/migrations/00XX_tag_similarity.sql
CREATE TABLE tag_similarity (
  tag_a_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tag_b_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  weight     REAL    NOT NULL DEFAULT 0.6,        -- was SIMILARITY_INTRA
  source     TEXT    NOT NULL DEFAULT 'curated',  -- 'curated' | 'derived' | 'embedding'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- store each undirected pair once with a canonical order (a < b)
  CONSTRAINT tag_similarity_order CHECK (tag_a_id < tag_b_id),
  PRIMARY KEY (tag_a_id, tag_b_id)
);

CREATE INDEX tag_similarity_a_idx ON tag_similarity (tag_a_id);
CREATE INDEX tag_similarity_b_idx ON tag_similarity (tag_b_id);
```

Design choices:
- **id-based**, not name-based -> rename-safe; aliases stay a concern of buildAliasSet only.
- **canonical (a < b) ordering** stores each undirected pair once; the lookup checks both directions
  (mirrors the current `graph[a]?.[b] ?? graph[b]?.[a]`).
- **per-edge `weight`** replaces the single constant (default 0.6 preserves today's behavior exactly).
- **`source`** lets curated, derived, and future embedding edges coexist and be filtered.

Optional (only if clusters must stay first-class, e.g. for an admin UI):
```sql
CREATE TABLE tag_cluster (id SERIAL PRIMARY KEY, label TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE tag_cluster_member (
  cluster_id INTEGER REFERENCES tag_cluster(id) ON DELETE CASCADE,
  tag_id     INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, tag_id)
);
-- edges are then derived from co-membership; simpler to start with tag_similarity only.
```

## 3. One-time migration of the existing clusters

Write a small script (scripts/) that reads the current `TAG_CLUSTERS_BY_NAME`, resolves names -> ids
using the same name/alias map as `buildNameToIdMap`, expands each cluster into unordered pairs, and
upserts them at weight 0.6, source 'curated'. This preserves today's graph exactly.

```ts
// scripts/seed-tag-similarity.ts (sketch)
for (const cluster of TAG_CLUSTERS_BY_NAME) {
  const ids = cluster.map(nameToId).filter(Number.isFinite).sort((a, b) => a - b);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      upsert(tag_similarity, { tag_a_id: ids[i], tag_b_id: ids[j], weight: 0.6, source: 'curated' });
}
```

Add an npm script (the repo already uses this pattern, e.g. `backfill:posted-at`):
`"seed:tag-similarity": "tsx scripts/seed-tag-similarity.ts"`.

## 4. API + reco.ts changes (keep scoring identical)

- Extend the `/api/reco-data` response with `tagSimilarity: {tag_a_id, tag_b_id, weight}[]`
  (loaded alongside works/tags/workTags, same as today).
- In `reco.ts`, replace `buildSimilarityGraphFromClusters(allTags)` with
  `buildSimilarityGraphFromRows(rows)` that fills the same `Record<TagId, SimRow>` shape:

```ts
function buildSimilarityGraphFromRows(rows: {tag_a_id:number; tag_b_id:number; weight:number}[]) {
  const graph: Record<number, Record<number, number>> = {};
  const add = (a:number,b:number,v:number) => {
    (graph[a] ??= {})[b] = Math.max(graph[a]?.[b] ?? 0, v);
    (graph[b] ??= {})[a] = Math.max(graph[b]?.[a] ?? 0, v);
  };
  for (const r of rows) add(r.tag_a_id, r.tag_b_id, r.weight);
  return graph;
}
```

Everything downstream (`makeSimLookup`, the layer-4 similarity term in `scoreWork`) stays unchanged.
Because the seed uses weight 0.6, output is identical to today — a safe, behavior-preserving swap.

## 5. Rollout (safe, reversible)

1. Ship the migration + seed script; run seed. (data added, no behavior change yet)
2. Add `tagSimilarity` to `/api/reco-data`.
3. Switch `reco.ts` to `buildSimilarityGraphFromRows`; keep the hardcoded array behind a fallback flag.
4. Verify identical recommendations on a fixed set of selections (regression parity check).
5. Remove the hardcoded `TAG_CLUSTERS_BY_NAME` once parity holds.

## 6. What this unlocks (the roadmap narrative)

- **Editable thesaurus:** curate relationships as data (later, a small admin UI) instead of code edits.
- **Per-edge weights:** "부부↔이혼" can be stronger than "부부↔육아" — richer than one global constant.
- **Provenance via `source`:** curated / derived / embedding edges coexist; you can A/B or blend them.
- **Path to embeddings:** compute tag co-occurrence or embedding cosine offline, write high-confidence
  pairs as `source='embedding'`, and keep curated edges as an interpretable backbone.
- **Analytics/reuse:** other features (search, related tags) can read the same graph.

## 7. Language Engineer framing

This is a textbook "interpretable baseline -> data-driven -> learned" progression:
- Start: hand-curated thesaurus (interpretable, correct, but static).
- Now: same relationships as data with per-edge weights and provenance.
- Next: embedding-derived edges layered on top, curated edges as a trusted backbone.
In a case study or interview: "I kept the rule-based thesaurus as a controllable baseline and moved it
to data so it can grow and, eventually, be augmented by learned similarity — without losing
interpretability." That is exactly the bootstrapping-in-a-changing-environment skill the role asks for.

## 8. Honesty / scope notes
- Seeding at weight 0.6 keeps behavior identical; do not claim quality improvements until measured.
- I have not read db/migrations or api/reco-data.js directly (the migrations listing wasn't crawlable),
  so match the exact column/style conventions in the repo when writing the real migration.
- Keep the hardcoded array as a fallback until regression parity is confirmed.
