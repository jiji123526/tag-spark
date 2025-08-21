import Header from "@/components/Header";
import WorkCard from "@/components/WorkCard";
import { Button } from "@/components/ui/button";
import { works as allWorks } from "@/data/works";
import { tags as allTags, Tag } from "@/data/tags";
import { workTags as mappings } from "@/data/workTags";
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { computeRecommendations } from "@/lib/reco";
import { Check } from "lucide-react";

const PAGE_SIZE = 10;

// 아주 간단한 셔플(선택 없음일 때 무작위 10개)
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isKoreanName(name: string): boolean {
  if (!name) return false;
  const ch = name.trim()[0];
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3; // Hangul syllables
}

function compareAuthor(a: { author: string }, b: { author: string }): number {
  const aKo = isKoreanName(a.author);
  const bKo = isKoreanName(b.author);
  if (aKo && !bKo) return -1;
  if (!aKo && bKo) return 1;
  // both Korean or both not: locale-aware compare
  return a.author.localeCompare(b.author, aKo ? "ko" : "en", {
    sensitivity: "base",
    numeric: true,
  });
}

const Recommendations = () => {
  const [searchParams] = useSearchParams();

  // 페이지 번호 (?p=2 같은)
  const page = useMemo(() => {
    const p = parseInt((searchParams.get("p") || "1").trim(), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }, [searchParams]);

  // 쿼리에서 선택 태그 id 추출
  const selected = useMemo(() => {
    const raw = (searchParams.get("tags") || "").trim();
    if (!raw) return [] as number[];
    return raw
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n));
  }, [searchParams]);

  const excluded = useMemo(() => {
    const raw = (searchParams.get("exclude") || "").trim();
    if (!raw) return [] as number[];
    return raw
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n));
  }, [searchParams]);

  const selectedEffective = useMemo(() => {
    if (excluded.length === 0) return selected;
    const ex = new Set(excluded);
    return selected.filter((id) => !ex.has(id));
  }, [selected, excluded]);

  // 선택한 태그 객체 (상단 칩 표시용)
  const selectedTags = useMemo(
    () =>
      selectedEffective
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t),
    [selectedEffective]
  );

  // 작품별 태그 목록 (WorkCard에 전달)
  const tagsByWorkId = useMemo(() => {
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    const map = new Map<number, { tag: Tag; weight: 1.0 | 2.0 }[]>();

    for (const m of mappings) {
      const t = tagById.get(m.tag_id);
      if (!t) continue;
      const list = map.get(m.work_id) ?? [];
      list.push({ tag: t, weight: m.weight >= 2 ? 2.0 : 1.0 });
      map.set(m.work_id, list);
    }

    const out = new Map<number, Tag[]>();
    const categoryOrder: Record<string, number> = {
      "세계관": 1,
      "장르": 2,
      "설정": 3,
      "관계": 4,
      "분위기": 5,
      "분량": 6,
      "완결여부": 7,
    };
    for (const [workId, list] of map) {
      // 코어(2.0) 우선 정렬 + 카테고리 지정 순서 + 이름순
      list.sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        const aCat = categoryOrder[a.tag.category] ?? 999;
        const bCat = categoryOrder[b.tag.category] ?? 999;
        if (aCat !== bCat) return aCat - bCat;
        return a.tag.name.localeCompare(b.tag.name, "ko");
      });
      out.set(workId, list.map((x) => x.tag));
    }
    return out;
  }, []);

  const workHasExcluded = useMemo(() => {
    const ex = new Set(excluded);
    if (ex.size === 0) return (id: number) => false;
    const byWork = new Map<number, number[]>();
    for (const m of mappings) {
      const list = byWork.get(m.work_id) ?? [];
      list.push(m.tag_id);
      byWork.set(m.work_id, list);
    }
    return (id: number) => {
      const tags = byWork.get(id) || [];
      return tags.some((tid) => ex.has(tid));
    };
  }, [excluded]);

  const filteredWorks = useMemo(() => allWorks.filter((w) => !workHasExcluded(w.id)), [workHasExcluded]);

  // 정확 일치: 선택한 모든 태그 포함 작품 (→ “전부” 보여줌)
  const exactMatches = useMemo(() => {
    if (selectedEffective.length === 0) return [] as typeof allWorks;
    // work_id -> {tag_id: weight} 맵
    const byWork: Record<number, Record<number, number>> = mappings.reduce(
      (acc, m) => {
        (acc[m.work_id] ??= {});
        acc[m.work_id][m.tag_id] = m.weight;
        return acc;
      },
      {} as Record<number, Record<number, number>>
    );

    const hits = filteredWorks.filter((w) => {
      // workHasExcluded already applied by filteredWorks
      const tagWeights = byWork[w.id] || {};
      return selectedEffective.every((id) => id in tagWeights);
    });

    // 선택 태그들의 weight 합산으로 정렬
    return shuffle(hits);
  }, [selectedEffective, filteredWorks]);

  // 유사 추천: “완벽 매치 전부 표시 + 유사 추천은 페이지당 10개만”
  const similar = useMemo(() => {
    // 선택한 태그가 하나도 없으면 “무작위 10개”
    if (selectedEffective.length === 0) {
      return shuffle(filteredWorks).slice(0, PAGE_SIZE);
    }

    const recos = computeRecommendations(selectedEffective, {
      works: filteredWorks,
      tags: allTags,
      excludeTagIds: excluded,
    });

    // computeRecommendations는 [exact..., similar...] 순이므로
    // 완벽 매치(위에 이미 전부 표시)는 제외하고 유사분만 페이지닝
    const exactIds = new Set(exactMatches.map((w) => w.id));
    const onlySimilar = recos.filter((w) => !exactIds.has(w.id));

    const sorted = onlySimilar.sort((a, b) => b.similarity - a.similarity);
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sorted.slice(start, end);
  }, [selectedEffective, page, exactMatches, filteredWorks]);

  useEffect(() => {
    document.title = "키워드 추천 결과";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container pt-20 pb-16">
        <section aria-labelledby="results">
          {/* 헤더 + 액션 */}
          <div className="mb-3 flex items-center justify-between">
            <h1 id="results" className="text-xl font-semibold tracking-tight">
              추천작
            </h1>
            <div className="flex items-center gap-2">
              <Link to="/">
                <Button variant="outline" size="sm" aria-label="Back to filters">
                  다시 선택하기
                </Button>
              </Link>
            </div>
          </div>

          {/* 선택한 태그 칩 표시 */}
          {selectedTags.length > 0 && (
            <div className={excluded.length > 0 ? "mb-1" : "mb-6"}>
              <h2 className="sr-only">선택한 키워드</h2>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((t) => (
                  <Button
                    key={t.id}
                    variant="chipActive"
                    size="pill"
                    disabled
                    aria-pressed
                    aria-label={`Selected ${t.name}`}
                    title={
                      t.aliases && t.aliases.length > 0
                        ? `별칭: ${t.aliases.join(", ")}`
                        : undefined
                    }
                  >
                    <Check className="mr-1 size-4" />
                    {t.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {excluded.length > 0 && (
            <div className="mt-0 mb-6 flex flex-wrap gap-0">
              {excluded.map((id) => {
                const t = allTags.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <Button key={`ex-${id}`} variant="outline" size="pill" disabled aria-pressed>
                    {/* simple minus icon using a hyphen for consistency with disabled state */}
                    − {t.name}
                  </Button>
                );
              })}
            </div>
          )}

          {/* 완벽 매치: 항상 “모두” 표시 */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium tracking-wide text-muted-foreground">
                완벽 매치 추천작 ({exactMatches.length})
              </h3>
            </div>

            {exactMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                완벽 매치 작품이 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {exactMatches.map((w) => (
                  <WorkCard
                    key={w.id}
                    work={w}
                    tagList={tagsByWorkId.get(w.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 유사 추천: 페이지당 10개 (버튼 제거) */}
          {similar.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium tracking-wide text-muted-foreground">
                  이런 포타는 어떠세요? ({similar.length})
                </h3>
                {/* 페이지 이동 버튼 제거됨 */}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {similar.map((w) => (
                  <WorkCard
                    key={w.id}
                    work={w}
                    tagList={tagsByWorkId.get(w.id)}
                  />
                ))}
              </div>
            </div>
          ) : selectedEffective.length > 0 && exactMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              선택한 태그와 유사한 작품을 찾지 못했어요.
            </p>
          ) : null}
        </section>

        {/* 🔹 태그 수정 요청 버튼 */}
        <div className="mt-8 flex justify-center">
          <Button asChild variant="secondary" size="sm">
            <a
              href="https://forms.gle/pBuhYS7b4aUmU5Uo8"
              target="_blank"
              rel="noopener noreferrer"
            >
              키워드 수정 요청
            </a>
          </Button>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © 2025 @cxwdxggy <br /> 문의는 메뉴 탭의 요청 폼 또는 트위터(X) 디엠 주세요.
      </footer>
    </div>
  );
};

export default Recommendations;