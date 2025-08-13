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

  // 선택한 태그 객체 (상단 칩 표시용)
  const selectedTags = useMemo(
    () =>
      selected
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t),
    [selected]
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
    for (const [workId, list] of map) {
      // 코어(2.0) 우선 정렬
      list.sort((a, b) => b.weight - a.weight);
      out.set(workId, list.map((x) => x.tag));
    }
    return out;
  }, []);

  // 정확 일치: 선택한 모든 태그 포함 작품 (→ “전부” 보여줌)
  const exactMatches = useMemo(() => {
    if (selected.length === 0) return [] as typeof allWorks;
    // work_id -> {tag_id: weight} 맵
    const byWork: Record<number, Record<number, number>> = mappings.reduce(
      (acc, m) => {
        (acc[m.work_id] ??= {});
        acc[m.work_id][m.tag_id] = m.weight;
        return acc;
      },
      {} as Record<number, Record<number, number>>
    );

    const hits = allWorks.filter((w) => {
      const tagWeights = byWork[w.id] || {};
      return selected.every((id) => id in tagWeights);
    });

    // 선택 태그들의 weight 합산으로 정렬
    return hits
      .map((w) => {
        const tagWeights = byWork[w.id] || {};
        const score = selected.reduce(
          (sum, id) => sum + (tagWeights[id] || 0),
          0
        );
        return { w, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.w);
  }, [selected]);

  // 유사 추천: “완벽 매치 전부 표시 + 유사 추천은 페이지당 10개만”
  const similar = useMemo(() => {
    // 선택한 태그가 하나도 없으면 “무작위 10개”
    if (selected.length === 0) {
      return shuffle(allWorks).slice(0, PAGE_SIZE);
    }

    const recos = computeRecommendations(selected, {
      works: allWorks,
      tags: allTags,
    });

    // computeRecommendations는 [exact..., similar...] 순이므로
    // 완벽 매치(위에 이미 전부 표시)는 제외하고 유사분만 페이지닝
    const exactIds = new Set(exactMatches.map((w) => w.id));
    const onlySimilar = recos.filter((w) => !exactIds.has(w.id));

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    return onlySimilar.slice(start, end);
  }, [selected, page, exactMatches]);

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
            <div className="mb-4">
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
          ) : selected.length > 0 && exactMatches.length === 0 ? (
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
        © 모든 문의는 트위터(X) @cxwdxggy 로 디엠 주세요.
      </footer>
    </div>
  );
};

export default Recommendations;