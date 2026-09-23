// src/lib/reco.ts
import type { Tag, TagSimilarity, Work, WorkTag } from "./types.ts";
import { buildAliasSet, aliasOverlap } from "./utils.ts";

type Category = Tag["category"];
type WorkWithTags = Work & { tagIds: number[] };
type TagId = number;

// -------------------------------------------------------------
// 카테고리 가중치 (필요 시 조절)
const CAT_WEIGHT: Record<Category, number> = {
  설정: 1.0,
  관계: 0.9,
  분위기: 0.8,
  장르: 0.9,
  세계관: 1.0,
  분량: 0.5,
  완결여부: 0.4,
  씨피고정: 0.7, // Added missing property with a default weight
};

// 점수 파라미터
const EXACT = 1.0;       // 동일 태그(같은 id)
const ALIAS = 0.9;       // 별칭/부분일치(같은 카테고리)
const SAME_CAT = 0.35;   // 같은 카테고리(다른 태그)
const CORE_BONUS = 0.25; // workTags.weight=2.0 보너스
const NORMALIZE = true;  // 태그 수 정규화

type SimRow = Record<TagId, number>;

export function buildSimilarityGraphFromRows(
  rows: Pick<TagSimilarity, "tag_a_id" | "tag_b_id" | "weight">[]
): Record<TagId, SimRow> {
  const graph: Record<TagId, SimRow> = {};

  const add = (a: TagId, b: TagId, value: number) => {
    if (a === b || !Number.isFinite(value) || value <= 0) return;
    (graph[a] ??= {})[b] = Math.max(graph[a]?.[b] ?? 0, value);
    (graph[b] ??= {})[a] = Math.max(graph[b]?.[a] ?? 0, value);
  };

  for (const row of rows) add(row.tag_a_id, row.tag_b_id, row.weight);
  return graph;
}

// 그래프 조회(helper)
function makeSimLookup(graph: Record<TagId, SimRow>) {
  return (a: TagId, b: TagId) => {
    if (a === b) return 0;
    return graph[a]?.[b] ?? graph[b]?.[a] ?? 0;
  };
}

// -------------------------------------------------------------
// works + workTags → tagIds 부여
function buildWorkIndex(
  works: Work[],
  workTags: WorkTag[]
): WorkWithTags[] {
  const map = new Map<number, number[]>();
  for (const wt of workTags) {
    if (!map.has(wt.work_id)) map.set(wt.work_id, []);
    map.get(wt.work_id)!.push(wt.tag_id);
  }
  return works.map((w) => ({ ...w, tagIds: map.get(w.id) ?? [] }));
}

// 선택 태그 모두 포함(완벽 매칭) 목록 + weight 합으로 정렬
function getExactMatches(
  selectedTagIds: number[],
  works: Work[],
  workTags: WorkTag[]
): Work[] {
  if (selectedTagIds.length === 0) return [];

  // work_id -> { tag_id: weight }
  const byWork: Record<number, Record<number, number>> = workTags.reduce(
    (acc, m) => {
      (acc[m.work_id] ??= {});
      acc[m.work_id][m.tag_id] = m.weight;
      return acc;
    },
    {} as Record<number, Record<number, number>>
  );

  const hits = works.filter((w) => {
    const tagWeights = byWork[w.id] || {};
    return selectedTagIds.every((id) => id in tagWeights);
  });

  return hits
    .map((w) => {
      const tagWeights = byWork[w.id] || {};
      const score = selectedTagIds.reduce((sum, id) => sum + (tagWeights[id] || 0), 0);
      return { w, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}

// -------------------------------------------------------------
// 별칭/부분/카테고리 + “태그↔태그 유사도(튜플 기반)”까지 포함한 유사도 점수
function buildSimilarityScorer(
  allTags: Tag[],
  workTags: WorkTag[],
  tagSimilarity: TagSimilarity[]
) {
  const tagById = new Map(allTags.map((t) => [t.id, t]));
  const aliasSetById = new Map<number, Set<string>>();
  for (const t of allTags) {
    aliasSetById.set(t.id, buildAliasSet(t.name, t.aliases));
  }

  const simGraph = buildSimilarityGraphFromRows(tagSimilarity);
  const sim = makeSimLookup(simGraph);

  // work_id -> [{ tag_id, weight }]
  const tagsOfWork = new Map<number, { tag_id: number; weight: 1.0 | 2.0 }[]>();
  for (const wt of workTags) {
    const list = tagsOfWork.get(wt.work_id) ?? [];
    list.push({ tag_id: wt.tag_id, weight: wt.weight >= 2 ? 2.0 : 1.0 });
    tagsOfWork.set(wt.work_id, list);
  }

  return function scoreWork(
    w: WorkWithTags,
    selectedTagIds: number[]
  ): number {
    const entries = tagsOfWork.get(w.id) ?? [];
    if (entries.length === 0 || selectedTagIds.length === 0) return 0;

    const selectedTags = selectedTagIds
      .map((id) => tagById.get(id))
      .filter((t): t is Tag => !!t);

    const selectedByCat = new Map<Category, Set<number>>();
    const selectedAliasByCat = new Map<Category, Set<string>>();
    for (const t of selectedTags) {
      (selectedByCat.get(t.category) ?? selectedByCat.set(t.category, new Set()).get(t.category))!.add(t.id);
      const selAlias = selectedAliasByCat.get(t.category) ?? new Set<string>();
      for (const tok of (aliasSetById.get(t.id) ?? [])) selAlias.add(tok);
      selectedAliasByCat.set(t.category, selAlias);
    }

    let raw = 0;

    for (const { tag_id, weight } of entries) {
      const wt = tagById.get(tag_id);
      if (!wt) continue;

      const cat = wt.category;
      const cw = CAT_WEIGHT[cat] ?? 1.0;

      // 1) 동일 태그
      if (selectedByCat.get(cat)?.has(tag_id)) {
        raw += (EXACT + (weight === 2.0 ? CORE_BONUS : 0)) * cw;
        continue;
      }

      // 2) 같은 카테고리 내 별칭/부분일치
      const selAlias = selectedAliasByCat.get(cat);
      if (selAlias && selAlias.size > 0) {
        const workAlias = aliasSetById.get(tag_id) ?? new Set<string>();
        if (aliasOverlap(workAlias, selAlias)) {
          raw += (ALIAS + (weight === 2.0 ? CORE_BONUS / 2 : 0)) * cw;
          continue;
        }
      }

      // 3) 같은 카테고리(다른 태그)
      if (selectedByCat.has(cat)) {
        raw += (SAME_CAT + (weight === 2.0 ? CORE_BONUS / 4 : 0)) * cw;
      }

      // 4) 태그↔태그 유사도(튜플 기반, 카테고리 무관)
      for (const s of selectedTagIds) {
        const k = sim(s, tag_id);
        if (k > 0) {
          const weightBoost = 1 + (weight === 2.0 ? CORE_BONUS / 2 : 0);
          raw += k * cw * weightBoost;
        }
      }
    }

    const denom = NORMALIZE ? Math.sqrt(entries.length) : 1;
    return raw / denom;
  };
}

// -------------------------------------------------------------
// 유틸: Fisher–Yates 셔플
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -------------------------------------------------------------
// helper: exclude 태그가 붙은 작품 필터링
function filterOutExcludedWorks(
  works: Work[],
  workTags: WorkTag[],
  excludeTagIds: number[] = []
): Work[] {
  if (!excludeTagIds || excludeTagIds.length === 0) return works;
  const exclude = new Set(excludeTagIds);
  const byWork: Record<number, number[]> = {};
  for (const wt of workTags) {
    (byWork[wt.work_id] ??= []).push(wt.tag_id);
  }
  return works.filter((w) => {
    const tags = byWork[w.id] || [];
    return !tags.some((tid) => exclude.has(tid));
  });
}

// 분리형: 완벽 매칭은 전부, 유사 추천은 최대 N개
export function computeExactAndSimilar(
  selectedTagIds: number[],
  opts: {
    works: Work[];
    tags: Tag[];
    workTags: WorkTag[];
    tagSimilarity: TagSimilarity[];
    similarMax?: number;
    excludeTagIds?: number[];
  }
) {
  const works = opts.works;
  const tags = opts.tags;
  const wt = opts.workTags;
  const similarMax = opts.similarMax ?? 10;
  const tagSimilarity = opts.tagSimilarity;

  const excludeTagIds = opts?.excludeTagIds ?? [];
  const worksFiltered = filterOutExcludedWorks(works, wt, [...excludeTagIds, 900]);

  // ✅ 선택 키워드가 없으면: 가중치 없이 랜덤 추천
  if (!selectedTagIds || selectedTagIds.length === 0) {
    const pool = [...worksFiltered];
    shuffleInPlace(pool);
    return { exact: [] as Work[], similar: pool.slice(0, similarMax) };
  }

  const indexed = buildWorkIndex(worksFiltered, wt);
  const exact = getExactMatches(selectedTagIds, worksFiltered, wt);

  const exactIds = new Set(exact.map((w) => w.id));
  const scoreWork = buildSimilarityScorer(tags, wt, tagSimilarity);

  // “선택 태그와 동일하게 겹친 개수”를 우선순위 키로 사용
  type Item = { w: WorkWithTags; s: number; overlap: number };

  const buckets = new Map<number, Item[]>(); // overlapCount -> items
  const zeroOverlap: Item[] = [];

  for (const w of indexed) {
    if (exactIds.has(w.id)) continue; // 완벽매치는 제외
    const s = scoreWork(w, selectedTagIds);
    if (s <= 0) continue;

    const overlap = selectedTagIds.reduce(
      (cnt, id) => cnt + (w.tagIds.includes(id) ? 1 : 0),
      0
    );

    if (overlap > 0) {
      const arr = buckets.get(overlap) ?? [];
      arr.push({ w, s, overlap });
      buckets.set(overlap, arr);
    } else {
      zeroOverlap.push({ w, s, overlap: 0 });
    }
  }

  // overlap 개수 큰 그룹부터, 그룹 내부는 유사도 점수로 정렬
  const overlapsDesc = Array.from(buckets.keys()).sort((a, b) => b - a);
  const ordered: Item[] = [];
  for (const k of overlapsDesc) {
    const group = buckets.get(k)!;
    group.sort((a, b) => b.s - a.s);
    ordered.push(...group);
  }
  zeroOverlap.sort((a, b) => b.s - a.s);
  ordered.push(...zeroOverlap);

  const similar = ordered.slice(0, similarMax).map((x) => x.w);

  return { exact, similar };
}

// 원샷: exact 전부 + similar 최대 10개를 이어 붙여 반환
export function computeRecommendations(
  selectedTagIds: number[],
  opts: {
    works: Work[];
    tags: Tag[];
    workTags: WorkTag[];
    tagSimilarity: TagSimilarity[];
    similarMax?: number;
    excludeTagIds?: number[];
  }
) {
  const { exact, similar } = computeExactAndSimilar(selectedTagIds, opts);
  return [...exact, ...similar];
}
