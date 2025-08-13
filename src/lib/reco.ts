// src/lib/reco.ts
import { tags as ALL_TAGS, Tag } from "@/data/tags";
import { works as ALL_WORKS, Work } from "@/data/works";
import { workTags as WORK_TAGS } from "@/data/workTags";
import { buildAliasSet, aliasOverlap } from "@/lib/utils";

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
};

// 점수 파라미터
const EXACT = 1.0;          // 동일 태그(같은 id)
const ALIAS = 0.9;          // 별칭/부분일치(같은 카테고리)
const SAME_CAT = 0.35;      // 같은 카테고리(다른 태그)
const CORE_BONUS = 0.25;    // workTags.weight=2.0 보너스
const BASE_HIT_BOOST = 0.25;// 정확 매칭은 유사도보다 항상 살짝 유리하게
const NORMALIZE = true;     // 태그 수 정규화

// -------------------------------------------------------------
// 선택 태그의 중요도(지정된 키워드는 2배 반영)
const SELECTED_TAG_IMPORTANCE: Record<TagId, number> = {
  101: 2, // 청레
  102: 2, // 캠퍼스
  107: 2, // 스포츠
  111: 2, // 육아
  117: 2, // 연반
  214: 2, // 칼짝윈
  215: 2, // 윈짝칼
  312: 2, // 리얼물
  313: 2, // 노란장판
  503: 2, // 오메가버스
  505: 2, // 센티넬버스
  504: 2, // 수인
  502: 2, // 아포칼립스
  501: 2, // 좀아포
};
const importanceOf = (tagId: TagId) => SELECTED_TAG_IMPORTANCE[tagId] ?? 1;

// -------------------------------------------------------------
// 유사 키워드 튜플(이름으로 정의 → ID로 해석해 그래프 생성)
const SIMILARITY_INTRA = 0.6; // 같은 튜플 내 기본 유사도
const TAG_CLUSTERS_BY_NAME: string[][] = [
  ["청레", "캠퍼스", "선후배"],
  ["여행", "힐링"],
  ["인외물", "아포칼립스", "좀아포", "수인", "오메가버스", "센티넬버스"],
  ["동갑", "소꿉친구", "친구"],
  ["부부", "육아", "이혼", "정략결혼"],
  ["오피스", "직장동료"],
  ["키잡", "역키잡", "근친", "쌍둥이"],
  ["후회", "쓰공/수", "찌통"],
  ["쌍방삽질", "청레", "친구", "윈짝칼", "칼짝윈"],
  ["배틀레즈", "쓰공/수", "애새끼"],
  ["노란장판", "피폐", "찌통"],
  ["로판", "판타지", "SF"],
  ["누아르", "조직물"],
  ["종교", "구원"],
];

// 이름→ID 사전
function buildNameToIdMap(allTags: Tag[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of allTags) {
    m.set(t.name, t.id);
    for (const a of t.aliases ?? []) m.set(a, t.id);
  }
  return m;
}

// 튜플(이름) → 유사도 그래프(아이디)
type SimRow = Record<TagId, number>;
function buildSimilarityGraphFromClusters(allTags: Tag[]): Record<TagId, SimRow> {
  const nameToId = buildNameToIdMap(allTags);
  const graph: Record<TagId, SimRow> = {};

  const add = (a: TagId, b: TagId, v: number) => {
    if (a === b) return;
    (graph[a] ??= {})[b] = Math.max(graph[a]?.[b] ?? 0, v);
    (graph[b] ??= {})[a] = Math.max(graph[b]?.[a] ?? 0, v);
  };

  for (const cluster of TAG_CLUSTERS_BY_NAME) {
    const ids = cluster
      .map((name) => nameToId.get(name))
      .filter((x): x is number => Number.isFinite(x));
    // 완전 그래프로 연결
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        add(ids[i], ids[j], SIMILARITY_INTRA);
      }
    }
  }

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
function buildWorkIndex(works = ALL_WORKS, workTags = WORK_TAGS): WorkWithTags[] {
  const map = new Map<number, number[]>();
  for (const wt of workTags) {
    if (!map.has(wt.work_id)) map.set(wt.work_id, []);
    map.get(wt.work_id)!.push(wt.tag_id);
  }
  return works.map((w) => ({ ...w, tagIds: map.get(w.id) ?? [] }));
}

// 선택 태그 모두 포함(완벽 매칭) 목록 + “중요도 반영 weight 합”으로 정렬
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

  // 선택 태그의 (workTags.weight * 선택태그 중요도) 합으로 정렬
  return hits
    .map((w) => {
      const tagWeights = byWork[w.id] || {};
      const score = selectedTagIds.reduce(
        (sum, id) => sum + (tagWeights[id] || 0) * importanceOf(id),
        0
      );
      return { w, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}

// -------------------------------------------------------------
// 별칭/부분/카테고리 + “태그↔태그 유사도(튜플 기반)”까지 포함한 유사도 점수
function buildSimilarityScorer(allTags: Tag[], workTags = WORK_TAGS) {
  const tagById = new Map(allTags.map((t) => [t.id, t]));
  const aliasSetById = new Map<number, Set<string>>();
  for (const t of allTags) {
    aliasSetById.set(t.id, buildAliasSet(t.name, t.aliases));
  }

  // 유사도 그래프 생성(튜플 → 완전그래프)
  const simGraph = buildSimilarityGraphFromClusters(allTags);
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

      // 1) 동일 태그(선택 태그 중요도 + 고정 부스터)
      if (selectedByCat.get(cat)?.has(tag_id)) {
        const imp = importanceOf(tag_id);
        raw += ((EXACT + BASE_HIT_BOOST) + (weight === 2.0 ? CORE_BONUS : 0)) * imp * cw;
        continue;
      }

      // 2) 같은 카테고리 내 별칭/부분일치
      const selAlias = selectedAliasByCat.get(cat);
      if (selAlias && selAlias.size > 0) {
        const workAlias = aliasSetById.get(tag_id) ?? new Set<string>();
        if (aliasOverlap(workAlias, selAlias)) {
          const avgImp = averageImportance([...selectedByCat.get(cat)!] || []);
          raw += (ALIAS + (weight === 2.0 ? CORE_BONUS / 2 : 0)) * avgImp * cw;
          continue;
        }
      }

      // 3) 같은 카테고리(다른 태그)
      if (selectedByCat.has(cat)) {
        const avgImp = averageImportance([...selectedByCat.get(cat)!] || []);
        raw += (SAME_CAT + (weight === 2.0 ? CORE_BONUS / 4 : 0)) * avgImp * cw;
      }

      // 4) 태그↔태그 유사도(튜플 기반, 카테고리 무관)
      for (const s of selectedTagIds) {
        const k = sim(s, tag_id);
        if (k > 0) {
          const imp = importanceOf(s);
          const weightBoost = 1 + (weight === 2.0 ? CORE_BONUS / 2 : 0);
          raw += imp * k * cw * weightBoost;
        }
      }
    }

    const denom = NORMALIZE ? Math.sqrt(entries.length) : 1;
    return raw / denom;
  };
}

function averageImportance(ids: number[]): number {
  if (ids.length === 0) return 1;
  let sum = 0;
  for (const id of ids) sum += importanceOf(id);
  return sum / ids.length;
}

// -------------------------------------------------------------
// 분리형: 완벽 매칭은 전부, 유사 추천은 최대 N개
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
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, similarMax)
    .map((x) => x.w);

  return { exact, similar };
}

// 원샷: exact 전부 + similar 최대 10개를 이어 붙여 반환
export function computeRecommendations(
  selectedTagIds: number[],
  opts?: { works?: Work[]; tags?: Tag[]; similarMax?: number }
) {
  const { exact, similar } = computeExactAndSimilar(selectedTagIds, opts);
  return [...exact, ...similar];
}