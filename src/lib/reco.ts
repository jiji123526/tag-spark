// src/lib/reco.ts
import { tags as ALL_TAGS, Tag } from "@/data/tags";
import { works as ALL_WORKS, Work } from "@/data/works";
import { workTags as WORK_TAGS } from "@/data/workTags";
import { buildAliasSet, aliasOverlap } from "@/lib/utils";

type Category = Tag["category"];
type WorkWithTags = Work & { tagIds: number[] };

// 카테고리 가중치 (필요 시 조절)
const CAT_WEIGHT: Record<Category, number> = {
  설정: 1.0,
  관계: 0.9,
  분위기: 0.8,
  장르: 0.9,
  세계관: 1.0,
  길이: 0.5,
};

// 점수 파라미터
const EXACT = 1.0;       // 동일 태그(같은 id)
const ALIAS = 0.9;       // 별칭/부분일치(같은 카테고리)
const SAME_CAT = 0.35;   // 같은 카테고리(다른 태그)
const CORE_BONUS = 0.25; // workTags.weight=2.0 보너스
const NORMALIZE = true;  // 태그 수 정규화

// works + workTags → tagIds 부여
function buildWorkIndex(works = ALL_WORKS, workTags = WORK_TAGS): WorkWithTags[] {
  const map = new Map<number, number[]>();
  for (const wt of workTags) {
    if (!map.has(wt.work_id)) map.set(wt.work_id, []);
    map.get(wt.work_id)!.push(wt.tag_id);
  }
  return works.map((w) => ({ ...w, tagIds: map.get(w.id) ?? [] }));
}

// 선택 태그 모두 포함(완벽 매칭) 목록 + 가중치 합으로 정렬
function getExactMatches(
  selectedTagIds: number[],
  works = ALL_WORKS,
  workTags = WORK_TAGS
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

  // 선택 태그의 weight 합으로 내림차순 정렬
  return hits
    .map((w) => {
      const tagWeights = byWork[w.id] || {};
      const score = selectedTagIds.reduce((sum, id) => sum + (tagWeights[id] || 0), 0);
      return { w, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}

// 별칭/부분/카테고리 유사도 점수
function buildSimilarityScorer(allTags: Tag[], workTags = WORK_TAGS) {
  const tagById = new Map(allTags.map((t) => [t.id, t]));
  const aliasSetById = new Map<number, Set<string>>();
  for (const t of allTags) {
    aliasSetById.set(t.id, buildAliasSet(t.name, t.aliases));
  }

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
    }

    const denom = NORMALIZE ? Math.sqrt(entries.length) : 1;
    return raw / denom;
  };
}

/** 분리형: 완벽 매칭은 전부, 유사 추천은 최대 10개 */
export function computeExactAndSimilar(
  selectedTagIds: number[],
  opts?: { works?: Work[]; tags?: Tag[]; similarMax?: number }
) {
  const works = opts?.works ?? ALL_WORKS;
  const tags = opts?.tags ?? ALL_TAGS;
  const similarMax = opts?.similarMax ?? 10;

  const indexed = buildWorkIndex(works, WORK_TAGS);
  const exact = getExactMatches(selectedTagIds, works, WORK_TAGS);

  // 유사 추천: exact 제외 후 점수순 정렬 → 최대 similarMax
  const exactIds = new Set(exact.map((w) => w.id));
  const scoreWork = buildSimilarityScorer(tags, WORK_TAGS);

  const similar = indexed
    .filter((w) => !exactIds.has(w.id))
    .map((w) => ({ w, s: scoreWork(w, selectedTagIds) }))
    .filter((x) => x.s > 0) // 유사도 0은 제외
    .sort((a, b) => b.s - a.s)
    .slice(0, similarMax)
    .map((x) => x.w);

  return { exact, similar };
}

/** 원샷: exact 전부 + similar 최대 10개를 이어 붙여 반환 */
export function computeRecommendations(
  selectedTagIds: number[],
  opts?: { works?: Work[]; tags?: Tag[]; similarMax?: number }
) {
  const { exact, similar } = computeExactAndSimilar(selectedTagIds, opts);
  return [...exact, ...similar];
}