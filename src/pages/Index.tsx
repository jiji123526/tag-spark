import { useMemo, useState } from "react";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { tags as allTags, Tag } from "@/data/tags";
import { Check, Search, XCircle, MinusCircle, PlusCircle } from "lucide-react"; // 🔹 XCircle 아이콘 추가, MinusCircle, PlusCircle 추가
import { Link, useNavigate } from "react-router-dom";

const CATEGORIES: Tag["category"][] = [
  "설정",
  "관계",
  "분위기",
  "장르",
  "세계관",
  "분량",
  "완결여부"
];

const LABELS: Record<Tag["category"], string> = {
  설정: "설정",
  관계: "관계",
  분위기: "분위기",
  장르: "장르",
  세계관: "세계관",
  분량: "분량",
  완결여부: "완결여부",
};

const formatCategory = (c: Tag["category"]) => LABELS[c];

const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [excludeMode, setExcludeMode] = useState(false);

  const goToResults = () => {
    const includeSet = new Set(selected);
    const uniqueSelected = Array.from(includeSet);
    const uniqueExcluded = excluded.filter((id) => !includeSet.has(id));
    const qs = uniqueSelected.join(",");
    const ex = uniqueExcluded.join(",");
    const params = new URLSearchParams();
    if (qs) params.set("tags", qs);
    if (ex) params.set("exclude", ex);
    navigate(`/recommendations?${params.toString()}`);
  };

  // 🔹 선택 초기화 함수
  const resetSelection = () => {
    setSelected([]);
    setExcluded([]);
    setExcludeMode(false);
    setQuery("");
  };

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => {
      const hitName = t.name.toLowerCase().includes(q);
      const hitAlias = (t.aliases ?? []).some((a) => a.toLowerCase().includes(q));
      return hitName || hitAlias;
    });
  }, [query]);

  const groupedTags = useMemo(() => {
    return filteredTags.reduce<Record<Tag["category"], Tag[]>>(
      (acc, tag) => {
        (acc[tag.category] ||= []).push(tag);
        return acc;
      },
      {
        설정: [],
        관계: [],
        분위기: [],
        장르: [],
        세계관: [],
        분량: [],
        완결여부: [],
      }
    );
  }, [filteredTags]);

  const toggleTag = (id: number) => {
    if (excludeMode) {
      setExcluded((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((t) => t !== id) : [...prev, id];
        if (!exists) {
          // 방금 제외에 추가했으므로 포함 목록에서 제거
          setSelected((sel) => sel.filter((t) => t !== id));
        }
        return next;
      });
    } else {
      setSelected((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((t) => t !== id) : [...prev, id];
        if (!exists) {
          // 방금 포함에 추가했으므로 제외 목록에서 제거
          setExcluded((ex) => ex.filter((t) => t !== id));
        }
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container pt-20 pb-16">
        <section aria-labelledby="hero">
          <h1 id="hero" className="text-2xl font-semibold tracking-tight">
            오늘은 뭘 읽을까?
          </h1>
          <p className="mt-2 text-muted-foreground">
            * 키워드를 골라 취향에 맞는 포타를 추천받으세요. <br />
            * 선택한 키워드와 가장 유사한 작품이 우선 순위로 추천됩니다.<br />
            * 단편: 1 - 4편 / 중편: 5 - 9편 / 장편: 10편 이상으로 분류됩니다.<br />
            * 하단의 모드 버튼을 사용하여 포함/제외 태그 선택이 가능합니다.<br />
            * 키워드 미선택시 무작위로 10개의 포타가 추천됩니다.<br />
          </p>
        </section>

        <section aria-labelledby="tags" className="mt-6">
          <h2 id="tags" className="sr-only">키워드 선택</h2>

          {/* 🔹 검색창 + 초기화 버튼 */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="키워드 검색..."
                aria-label="키워드 검색"
                className="pl-9"
              />
            </div>
            {(selected.length > 0 || excluded.length > 0) && (
              <Button
                variant="outline"
                size="icon"
                title="선택 초기화"
                onClick={resetSelection}
              >
                <XCircle className="size-5" />
              </Button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={excludeMode ? "destructive" : "secondary"}
              size="sm"
              onClick={() => setExcludeMode((v) => !v)}
              title="태그 선택 모드 전환 (포함/제외)"
              aria-pressed={excludeMode}
            >
              {excludeMode ? <MinusCircle className="mr-1 size-4" /> : <PlusCircle className="mr-1 size-4" />}
              {excludeMode ? "제외 모드" : "포함 모드"}
            </Button>

            <div className="flex flex-wrap items-center gap-1">
              {selected.map((id) => {
                const t = allTags.find((x) => x.id === id)!;
                return (
                  <Button
                    key={`sel-${id}`}
                    size="pill"
                    className="bg-blue-500/80 text-white hover:bg-blue-600"
                    onClick={() => setSelected((p) => p.filter((x) => x !== id))}
                  >
                    <Check className="mr-1 size-4" />{t.name}
                  </Button>
                );
              })}
              {excluded.map((id) => {
                const t = allTags.find((x) => x.id === id)!;
                return (
                  <Button
                    key={`ex-${id}`}
                    size="pill"
                    className="bg-red-300 text-white hover:bg-red-400"
                    onClick={() => setExcluded((p) => p.filter((x) => x !== id))}
                  >
                    <MinusCircle className="mr-1 size-4" />{t.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-5">
            {CATEGORIES.map((cat) => {
              const tags = groupedTags[cat];
              if (!tags || tags.length === 0) return null;

              return (
                <article key={cat} aria-labelledby={`cat-${cat}`}>
                  <h3
                    id={`cat-${cat}`}
                    className="mb-2 text-sm font-medium tracking-wide text-muted-foreground"
                  >
                    {formatCategory(cat)}
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const activeInclude = selected.includes(t.id);
                      const activeExclude = excluded.includes(t.id);
                      // ✅ Always show selection state, independent of mode
                      const showingAsActive = activeInclude || activeExclude;
                      const variant = activeExclude ? "destructive" : activeInclude ? "chipActive" : "chip";
                      const ariaLabel = excludeMode ? `Exclude ${t.name}` : `Include ${t.name}`;
                      return (
                        <Button
                          key={t.id}
                          variant={variant as any}
                          size="pill"
                          onClick={() => toggleTag(t.id)}
                          aria-pressed={showingAsActive}
                          aria-label={ariaLabel}
                          className={activeExclude
                            ? "bg-red-300 text-white hover:bg-red-400"
                            : activeInclude
                            ? "bg-blue-500/80 text-white hover:bg-blue-600"
                            : undefined}
                          title={
                            t.aliases && t.aliases.length > 0
                              ? `별칭: ${t.aliases.join(", ")}`
                              : undefined
                          }
                        >
                          {activeExclude ? (
                            <MinusCircle className="mr-1 size-4" />
                          ) : activeInclude ? (
                            <Check className="mr-1 size-4" />
                          ) : null}
                          {t.name}
                        </Button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="proceed" className="mt-8">
          <div className="flex items-center justify-end">
            <Button onClick={goToResults} aria-label="See recommendations">
              추천작 보기
            </Button>
          </div>
        </section>

        <section aria-labelledby="external-links" className="mt-8 border-t pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Button asChild variant="outline" size="lg">
              <Link to="/catalog-sheet">현재 등록된 추천작 보기</Link>
            </Button>
            <Button asChild size="lg">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSf_SdK01Mas2ZVMeXG3-AOTdFsIMyjLRAyCMWFvpg3YZaFnkw/viewform?usp=sharing&ouid=103167940717310868379"
                target="_blank"
                rel="noopener noreferrer"
              >
                내 추천작 등록하기
              </a>
            </Button>
          </div>
        </section>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © 2025 @cxwdxggy <br /> 문의는 메뉴 탭의 요청 폼 또는 트위터(X) 디엠 주세요.
      </footer>
    </div>
  );
};

export default Index;