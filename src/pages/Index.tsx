import { useMemo, useState } from "react";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { tags as allTags, Tag } from "@/data/tags";
import { Check, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
const formatCategory = (c: Tag["category"]) => c.toUpperCase();
const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const goToResults = () => {
    const qs = selected.join(",");
    navigate(`/loading?tags=${qs}`);
  };
  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allTags.filter(t => t.name.toLowerCase().includes(q)) : allTags;
  }, [query]);
  const groupedTags = useMemo(() => {
    return filteredTags.reduce<Record<Tag["category"], Tag[]>>((acc, tag) => {
      acc[tag.category] = acc[tag.category] || [];
      acc[tag.category].push(tag);
      return acc;
    }, {
      situation: [],
      mood: [],
      relationship: []
    });
  }, [filteredTags]);
  const toggleTag = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };
  return <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container pt-20 pb-16">
        <section aria-labelledby="hero">
          <h1 id="hero" className="text-2xl font-semibold tracking-tight">키워드를 골라 내 취향에 맞는 포타를 감상하세요</h1>
          <p className="mt-2 text-muted-foreground">* 선택한 키워드와 가장 유사한 작품이 우선 순위로 추천됩니다.</p>
        </section>

        <section aria-labelledby="tags" className="mt-6">
          <h2 id="tags" className="sr-only">Tag selection</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tags..." aria-label="Search tags" className="pl-9" />
          </div>

          <div className="mt-4 space-y-5">
            {(["situation", "mood", "relationship"] as const).map(cat => {
            const tags = groupedTags[cat];
            if (!tags || tags.length === 0) return null;
            return <article key={cat} aria-labelledby={`cat-${cat}`}>
                  <h3 id={`cat-${cat}`} className="mb-2 text-sm font-medium tracking-wide text-muted-foreground">
                    {formatCategory(cat)}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(t => {
                  const active = selected.includes(t.id);
                  return <Button key={t.id} variant={active ? "chipActive" : "chip"} size="pill" onClick={() => toggleTag(t.id)} aria-pressed={active} aria-label={`Toggle ${t.name}`}>
                          {active && <Check className="mr-1 size-4" />}
                          {t.name}
                        </Button>;
                })}
                  </div>
                </article>;
          })}
          </div>
        </section>

        <section aria-labelledby="proceed" className="mt-8">
          <div className="flex items-center justify-end">
            <Button onClick={goToResults} aria-label="See recommendations">
              See recommendations
            </Button>
          </div>
        </section>
      </main>
    </div>;
};
export default Index;