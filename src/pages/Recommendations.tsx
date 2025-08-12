import Header from "@/components/Header";
import WorkCard from "@/components/WorkCard";
import { Button } from "@/components/ui/button";
import { works as allWorks, Work } from "@/data/works";
import { workTags as mappings } from "@/data/workTags";
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

const Recommendations = () => {
  const [searchParams] = useSearchParams();
  const selected = useMemo(() => {
    const raw = (searchParams.get("tags") || "").trim();
    if (!raw) return [] as number[];
    return raw
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n));
  }, [searchParams]);

  const recommendations = useMemo(() => {
    if (selected.length === 0) return allWorks;
    const tagsByWork = mappings.reduce<Record<number, Record<number, number>>>((acc, m) => {
      acc[m.work_id] = acc[m.work_id] || {};
      acc[m.work_id][m.tag_id] = m.weight;
      return acc;
    }, {});
    const results: Array<{ work: Work; score: number }> = [];
    for (const w of allWorks) {
      const tagWeights = tagsByWork[w.id] || {};
      const hasAll = selected.every((tagId) => tagId in tagWeights);
      if (!hasAll) continue;
      const score = selected.reduce((sum, tagId) => sum + (tagWeights[tagId] || 0), 0);
      results.push({ work: w, score });
    }
    return results.sort((a, b) => b.score - a.score).map((r) => r.work);
  }, [selected]);

  useEffect(() => {
    document.title = "Recommendations";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container pt-20 pb-16">
        <section aria-labelledby="results">
          <div className="mb-3 flex items-center justify-between">
            <h1 id="results" className="text-xl font-semibold tracking-tight">Recommendations</h1>
            <div className="flex items-center gap-2">
              <Link to="/">
                <Button variant="outline" size="sm" aria-label="Back to filters">Change filters</Button>
              </Link>
              <span className="text-sm text-muted-foreground">{recommendations.length} results</span>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No works match all selected tags.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recommendations.map((w) => (
                <WorkCard key={w.id} work={w} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Recommendations;
