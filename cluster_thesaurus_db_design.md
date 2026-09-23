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
  weight     DOUBLE PRECISION NOT NULL DEFAULT 0.6, -- preserves JS number precision
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
3. Switch `reco.ts` to `buildSimilarityGraphFromRows`; keep the hardcoded array only until parity passes.
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
- 현재 저장소에는 `db/migrations/001_add_posted_at.sql`만 있으며, `api/reco-data.js`는
  `works`, `tags`, `work_tags`를 병렬 조회한다. 실제 구현은 이 단순 SQL 스타일을 따른다.
- Regression parity passed against the live catalog; the runtime fallback was removed.

---

## 9. 확정 실행 순서: DB 이전 → 태그 비교 → 작품 비교

이 세 단계는 목적과 결과물이 다르다. 한 번에 추천 품질을 바꾸지 않고, 먼저 현재 동작을
데이터로 옮긴 뒤 사람 판단을 두 단계로 수집한다.

```
Phase 1  하드코딩 클러스터를 DB로 이전 (동작 보존)
              ↓
Phase 2  축별 태그 comparison (저비용 초기 순서/가중치)
              ↓
         모든 작품의 pre-map 계산
              ↓
Phase 3  가까운 작품 comparison (미세 조정 + 검증)
```

### 용어를 분리한다

- `tag_similarity`: 현재 추천 엔진의 **태그 간 연관성 그래프**다. 청레↔캠퍼스처럼
  "비슷하거나 함께 추천할 만한가"를 나타낸다.
- `axis_tag_weight`: 어두움·긴장 축에서 태그가 어느 방향으로 얼마나 기여하는지 나타낸다.
  피폐가 어두움 방향으로 강하게 기여하는 식이다.
- `tag_axis_comparison`: 같은 축 안에서 두 태그 중 어느 쪽이 더 강한지 사람이 답한 원자료다.
- `work_axis_comparison`: 같은 축 안에서 두 작품 중 어느 쪽이 더 강한지 사람이 답한 원자료다.

`tag_similarity.weight`와 `axis_tag_weight.weight`는 의미가 다르므로 한 컬럼이나 테이블에
합치지 않는다.

## 10. Phase 1 — 현재 하드코딩을 DB로 옮긴다

### 10.1 범위

마이그레이션 전 코드를 기준으로 한 변경 지점은 다음과 같다.

- `src/lib/reco.ts`: `TAG_CLUSTERS_BY_NAME`, `SIMILARITY_INTRA`,
  `buildSimilarityGraphFromClusters`가 하드코딩 원본이었다. live parity 확인 후 제거했다.
- `api/reco-data.js`: 현재 `works`, `tags`, `workTags`만 반환한다.
- `src/lib/types.ts`, `src/lib/queries.ts`: `TagSimilarity` 타입과 응답 필드를 추가해야 한다.
- `expandExcludedTagIds`는 클러스터 그래프를 만들지만 실제 추천 경로에서 호출되지 않는
  dead helper였다. migration에서 제거하고, 현재의 제외 동작(선택 ID만 제외)은 그대로 둔다.

### 10.2 스키마

2장의 `tag_similarity` 기본안을 사용하되 운영을 위해 수정 시각과 source 제약을 추가한다.

```sql
CREATE TABLE tag_similarity (
  tag_a_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tag_b_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  weight     REAL NOT NULL DEFAULT 0.6 CHECK (weight >= 0 AND weight <= 1),
  source     TEXT NOT NULL DEFAULT 'curated'
             CHECK (source IN ('curated', 'derived', 'embedding')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tag_similarity_order CHECK (tag_a_id < tag_b_id),
  PRIMARY KEY (tag_a_id, tag_b_id, source)
);
```

`source`별 결과를 나중에 병렬로 보존하기 위해 PK에 `source`를 포함한다. 실제 추천 lookup은
활성 source를 고른 뒤 동일 쌍의 최대값을 사용한다. Phase 1에서는 `curated`만 읽는다.

### 10.3 시드와 parity

1. 기존 15개 클러스터를 이름→ID로 해석한다.
2. 클러스터 내부 조합을 canonical pair `(min_id, max_id)`로 확장한다.
3. 중복 쌍은 하나로 합쳐 `weight=0.6`, `source='curated'`로 upsert한다.
4. 시드 전후 다음 fixture에서 추천 결과의 작품 ID와 순서를 비교한다.
   - 단일 태그 선택
   - 같은 클러스터의 복수 태그 선택
   - 클러스터 밖 복수 태그 선택
   - 제외 태그 포함
   - 선택 태그 없음
5. parity가 확인된 뒤에만 DB 경로를 기본값으로 바꾼다.
6. 한 배포 동안 하드코딩 fallback을 유지한 뒤 제거한다.

### Phase 1 완료 조건

- 시드 스크립트를 여러 번 실행해도 행 수와 값이 동일하다.
- API가 canonical pair만 반환한다.
- 고정 fixture에서 기존/DB 추천 결과가 동일하다.
- 제외 태그는 기존처럼 선택한 ID만 필터링한다.
- 코드에서 하드코딩 클러스터를 제거해도 테스트가 통과한다.

## 11. Phase 2 — 태그 comparison으로 축 초기값을 만든다

태그 comparison은 추상적인 "두 태그가 비슷한가"를 묻는 것이 아니다. 이미 확정한 축을
한 번에 하나씩 제시하고, **그 축에서 어느 태그가 더 강한가**만 묻는다. 따라서 질문 문구는
반드시 축을 포함한다.

- 어두움: “둘 중 어느 태그가 더 어두운 작품을 뜻하나요?”
- 긴장: “둘 중 어느 태그가 더 관계 갈등이 큰 작품을 뜻하나요?”
- 응답: 왼쪽 / 비슷함 / 오른쪽 / 판단 불가

### 11.1 비교 대상

사용자 결정에 따라 `분량`, `완결여부` 카테고리만 제외하고 나머지 70개 태그를 두 축에서
모두 비교한다. 축별 2,415쌍, 총 4,830쌍이다. 설정·세계관·시스템처럼 특정 축과 무관할 수
있는 태그도 사전에 제거하지 않고 `판단 불가` 응답으로 관측한다. 학습에서는 `skip`을
제외하며, skip 비율 자체는 태그의 축 적합성을 판단하는 데이터로 남긴다.

### 11.2 데이터 모델

```sql
CREATE TABLE embedding_axis (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,       -- darkness | tension
  label       TEXT NOT NULL,
  direction   TEXT NOT NULL,              -- 높은 값의 사용자 의미
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tag_axis_comparison (
  id              BIGSERIAL PRIMARY KEY,
  axis_id         INTEGER NOT NULL REFERENCES embedding_axis(id),
  left_tag_id     INTEGER NOT NULL REFERENCES tags(id),
  right_tag_id    INTEGER NOT NULL REFERENCES tags(id),
  winner_tag_id   INTEGER REFERENCES tags(id), -- NULL이면 tie/skip
  decision        TEXT NOT NULL CHECK (decision IN ('left','tie','right','skip')),
  annotator_key   TEXT NOT NULL DEFAULT 'owner',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (left_tag_id <> right_tag_id),
  CHECK (winner_tag_id IS NULL OR winner_tag_id IN (left_tag_id, right_tag_id))
);

CREATE TABLE axis_tag_weight (
  axis_id       INTEGER NOT NULL REFERENCES embedding_axis(id),
  tag_id        INTEGER NOT NULL REFERENCES tags(id),
  weight        REAL NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('manual','tag_comparison','work_comparison')),
  model_version INTEGER NOT NULL DEFAULT 1,
  sample_count  INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (axis_id, tag_id, source, model_version)
);
```

원자료와 산출 가중치를 분리한다. 비교 응답을 덮어쓰지 않고 모델 버전별 결과를 재현할 수
있어야 한다.

### 11.3 가중치 산출

1. `skip`은 학습에서 제외한다.
2. `tie`는 각 방향 0.5승으로 처리한다.
3. 축별 Bradley–Terry 점수를 계산한다.
4. 식별 가능성을 위해 축별 평균을 0으로 맞춘다.
5. 화면·추천에서 다루기 쉽도록 최대 절댓값이 1이 되게 정규화한다.
6. 결과를 `source='tag_comparison'`, 새 `model_version`으로 저장한다.

제작자 한 명의 1회 비교는 IAA를 제공하지 않는다. 이 단계의 결과는 **pre-map용 초기값**이며
gold standard라고 부르지 않는다. 가능하면 랜덤 순서로 10~20%를 다시 보여 intra-rater
일관성을 기록한다.

### Phase 2 완료 조건

- 모든 대상 쌍에 응답 또는 skip이 있다.
- 좌우 위치를 랜덤화해 위치 편향을 줄인다.
- 반복 문항 일치율과 skip 비율을 보고한다.
- 각 축의 양 끝 태그가 의미적으로 납득 가능하다.
- `axis_tag_weight`만으로 229개 작품의 pre-map 좌표를 재현 가능하다.

## 12. Phase 3 — 작품 comparison으로 미세 조정한다

작품 comparison은 태그 comparison을 대체하지 않는다. 태그 순위로 만든 pre-map에서 모델이
구분하기 어려운 작품 쌍을 골라, 같은 태그를 공유해도 실제 체감 강도가 다른 경우를 잡는다.

### 12.1 샘플링

각 축에서 다음 우선순위로 쌍을 만든다.

1. pre-map 점수 차이가 작은 인접 작품 쌍
2. 점수는 비슷하지만 태그 조합이 다른 쌍
3. 좌표 양 끝의 sanity-check 쌍
4. 전체 범위에서 무작위로 뽑은 held-out 검증 쌍

동일 작품 쌍을 두 축에 재사용할 수는 있지만 질문은 한 화면에서 한 축만 묻는다. 어두움과
긴장을 동시에 물으면 판단 기준이 섞인다.

### 12.2 데이터 모델

```sql
CREATE TABLE work_axis_comparison (
  id              BIGSERIAL PRIMARY KEY,
  axis_id         INTEGER NOT NULL REFERENCES embedding_axis(id),
  left_work_id    INTEGER NOT NULL REFERENCES works(id),
  right_work_id   INTEGER NOT NULL REFERENCES works(id),
  winner_work_id  INTEGER REFERENCES works(id),
  decision        TEXT NOT NULL CHECK (decision IN ('left','tie','right','skip')),
  annotator_key   TEXT NOT NULL DEFAULT 'owner',
  sampling_reason TEXT NOT NULL CHECK (sampling_reason IN ('near','tag_diverse','anchor','held_out')),
  model_version   INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (left_work_id <> right_work_id),
  CHECK (winner_work_id IS NULL OR winner_work_id IN (left_work_id, right_work_id))
);
```

### 12.3 학습과 검증

작품의 축 점수를 태그 가중치의 합으로 둔다.

```
score(work, axis) = sum(axis_tag_weight[tag] * work_tag.weight)
P(A > B) = logistic(score(A) - score(B))
```

Phase 2 가중치를 초기값 또는 regularization target으로 두고, `anchor/near/tag_diverse` 비교로
태그 계수를 보정한다. `held_out`은 학습에 넣지 않는다.

초기 수집 목표는 축별 100쌍이다. 100쌍 후 held-out 정확도와 순위 안정성을 보고, 성능이
계속 개선될 때만 200~300쌍으로 늘린다. 처음부터 모든 작품 쌍을 만들지 않는다.

### Phase 3 완료 조건

- held-out pair accuracy가 단순 수기 가중치 baseline보다 높다.
- Phase 2와 Phase 3 순위의 Kendall's tau를 기록한다.
- 계수가 크게 뒤집힌 태그를 사람이 검토한다.
- 새 비교를 추가했을 때 상위/하위 작품 순위가 과도하게 흔들리지 않는다.
- 결과를 새 `model_version`, `source='work_comparison'`으로 저장해 이전 버전으로 복귀 가능하다.

## 13. 이 순서에서 콜드스타트 온보딩의 위치

콜드스타트 UI는 Phase 1~3의 결과를 소비하는 기능이다. 지금 먼저 만들면 초기 수기 가중치에
제품 UX가 결합되어 검증과 교체가 어려워진다.

1. Phase 1 완료 후: 기존 추천과 동일한 DB 기반 baseline 확보
2. Phase 2 완료 후: 태그 가중치 기반 pre-map과 내부 검토 화면 가능
3. Phase 3 완료 후: 검증된 `taste_vector`/축 좌표로 콜드스타트 온보딩 구현

온보딩 화면 설계는 병렬로 할 수 있지만, 추천 결과를 확정하는 구현은 Phase 3 이후로 둔다.
