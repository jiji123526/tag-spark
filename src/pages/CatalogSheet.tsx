import Header from "@/components/Header";
import { works as allWorks } from "@/data/works";
import { tags as allTags, Tag } from "@/data/tags";
import { workTags as mappings } from "@/data/workTags";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = {
  id: number;
  title: string;
  author: string;
  source_url: string;
  tags: Tag[];
};

export default function CatalogSheet() {
  const [q, setQ] = useState("");

  // 작품별 태그 조인
  const rows: Row[] = useMemo(() => {
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    const byWork = new Map<number, Tag[]>();

    for (const m of mappings) {
      const tag = tagById.get(m.tag_id);
      if (!tag) continue;
      const list = byWork.get(m.work_id) ?? [];
      list.push(tag);
      byWork.set(m.work_id, list);
    }

    return allWorks.map((w) => ({
      id: w.id,
      title: w.title,
      author: w.author,
      source_url: w.source_url,
      tags: (byWork.get(w.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));
  }, []);

  // 검색(제목/작가/태그/별칭)
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) => {
      if (r.title.toLowerCase().includes(k)) return true;
      if (r.author.toLowerCase().includes(k)) return true;
      if (
        r.tags.some(
          (t) =>
            t.name.toLowerCase().includes(k) ||
            (t.aliases ?? []).some((a) => a.toLowerCase().includes(k))
        )
      )
        return true;
      return false;
    });
  }, [q, rows]);

  useEffect(() => {
    document.title = "현재 등록된 추천작";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container pt-20 pb-16">
        {/* 제목 */}
        <h1 className="text-xl font-semibold tracking-tight mb-2">
          현재 등록된 추천작
        </h1>

        {/* 검색창 + 개수 */}
        <div className="flex items-center gap-2 mb-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목 / 작가 / 키워드 검색…"
            className="w-64 md:w-80"
            aria-label="검색"
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} 개
          </span>
        </div>

        {/* 테이블: 고정 레이아웃 + 열 너비/줄바꿈 제어 */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                {/* 제목: 더 넓게 */}
                <th className="px-3 py-2 font-medium w-[55%] whitespace-nowrap break-keep">
                  제목
                </th>
                {/* 작가: 더 좁게 */}
                <th className="px-3 py-2 font-medium w-[88px] whitespace-nowrap break-keep">
                  작가
                </th>
                {/* 태그: 나머지 영역 */}
                <th className="px-3 py-2 font-medium w-[45%]">
                  키워드
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2 align-top">
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline underline-offset-2"
                        title={r.source_url}
                      >
                        {r.title}
                      </a>
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap break-keep">
                      <div className="text-foreground/90">{r.author}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                            title={
                              t.aliases?.length
                                ? `별칭: ${t.aliases.join(", ")}`
                                : undefined
                            }
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 버튼 */}
        <div className="mt-4 flex justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSf_SdK01Mas2ZVMeXG3-AOTdFsIMyjLRAyCMWFvpg3YZaFnkw/viewform?usp=sharing&ouid=103167940717310868379"
              target="_blank"
              rel="noopener noreferrer"
            >
              내 추천작 등록하기
            </a>
          </Button>
          <Button asChild size="sm">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScU-elPQxC2vlIifZkISf8Z6jhAC3zZA1Anw8-Xa8kY7gc-Sg/viewform"
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
}