import { FunctionComponent, useState, KeyboardEvent } from 'react';
import styles from './mobileIndex.module.css';

import backIcon from "../assets/mobileIndex/back.svg";
import groupSvg from "../assets/mobileIndex/Group.svg";
import magnifyingGlass from "../assets/mobileIndex/Magnifyingglass.svg";
import extraIcon from "../assets/mobileIndex/x.svg";

import { useNavigate } from 'react-router-dom';
import { tags as allTags, Tag } from "@/data/tags";
import { Button } from "@/components/ui/button";
import { Check, MinusCircle } from "lucide-react";

const mobileIndex:FunctionComponent = () => {
	const navigate = useNavigate();
	const handleBack = () => navigate(-1);

  // segmented control state (include/exclude)
  const [excludeMode, setExcludeMode] = useState(false);
  const selectInclude = () => setExcludeMode(false);
  const selectExclude = () => setExcludeMode(true);
  const onKeySegment = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setExcludeMode(false);
    if (e.key === 'ArrowRight') setExcludeMode(true);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExcludeMode(v => !v);
    }
  };

  // search & tag selection states (ported from Index)
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);

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

  const resetSelection = () => {
    setSelected([]);
    setExcluded([]);
    setExcludeMode(false);
    setQuery("");
  };

  const filteredTags = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => {
      const hitName = t.name.toLowerCase().includes(q);
      const hitAlias = (t.aliases ?? []).some((a) => a.toLowerCase().includes(q));
      return hitName || hitAlias;
    });
  })();

  const groupedTags = (() => {
    return filteredTags.reduce<Record<Tag["category"], typeof allTags>>( (acc, tag) => {
      (acc[tag.category] ||= [] as any).push(tag);
      return acc;
    }, { 설정: [] as any, 관계: [] as any, 분위기: [] as any, 장르: [] as any, 세계관: [] as any, 분량: [] as any, 완결여부: [] as any });
  })();

  const toggleTag = (id: number) => {
    if (excludeMode) {
      setExcluded((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((t) => t !== id) : [...prev, id];
        if (!exists) setSelected((sel) => sel.filter((t) => t !== id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((t) => t !== id) : [...prev, id];
        if (!exists) setExcluded((ex) => ex.filter((t) => t !== id));
        return next;
      });
    }
  };

  	return (
    		<div className={styles.mobileIndex}>
      			<div className={styles.controlssegmentedControlsli} style={{ position: 'relative' }} role="tablist" aria-label="Tag mode" tabIndex={0} onKeyDown={onKeySegment}>
              <div className={styles.background} />
    
              {/* Sliding mask (inline styles so CSS change not required) */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  width: 'calc(50% - 4px)',
                  height: 'calc(100% - 4px)',
                  borderRadius: '7.91px',
                  background: '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                  transform: excludeMode ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
                  transition: 'transform 220ms ease',
                  zIndex: 0,
                  pointerEvents: 'none'
                }}
              />

              {/* Include option */}
              <div
                className={styles.option1}
                role="tab"
                aria-selected={!excludeMode}
                onClick={selectInclude}
                style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span
                  className={`${styles.label1} ${!excludeMode ? styles.bold : ""}`}
                  style={{ pointerEvents: 'none' }}
                >
                  포함
                </span>
              </div>

              {/* Exclude option */}
              <div
                className={styles.option2}
                role="tab"
                aria-selected={excludeMode}
                onClick={selectExclude}
                style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span
                  className={[styles.label1, excludeMode ? styles.bold : ""].filter(Boolean).join(" ")}
                  style={{ pointerEvents: 'none' }}
                >
                  제외
                </span>
              </div>
      			</div>

          {/* Tags Section (mobile, styled like Index) */}
          <section aria-labelledby="tags-mobile" style={{ padding: "8px 16px" }}>

            {/* 카테고리별 태그 리스트 */}
            <div className="mt-4 space-y-5">
              {(["설정","관계","분위기","장르","세계관","분량","완결여부"] as Tag["category"][]).map((cat) => {
                const tags = groupedTags[cat];
                if (!tags || tags.length === 0) return null;

                return (
                  <article key={cat} aria-labelledby={`cat-${cat}`}>
                    <h3
                      id={`cat-${cat}`}
                      className="mb-2 text-sm font-medium tracking-wide text-muted-foreground"
                    >
                      {cat}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => {
                        const activeInclude = selected.includes(t.id);
                        const activeExclude = excluded.includes(t.id);
                        const showingAsActive = activeInclude || activeExclude;
                        const ariaLabel = t.aliases && t.aliases.length > 0 ? `별칭: ${t.aliases.join(", ")}` : undefined;

                        return (
                          <Button
                            key={t.id}
                            variant={activeExclude ? "destructive" : activeInclude ? "chipActive" : "chip"}
                            size="pill"
                            onClick={() => toggleTag(t.id)}
                            aria-pressed={showingAsActive}
                            aria-label={ariaLabel}
                            title={ariaLabel}
                            className={activeInclude ? "bg-blue-400 text-white hover:bg-blue-500" : undefined}
                          >
                            {activeExclude ? (
                              <MinusCircle className="mr-1" />
                            ) : activeInclude ? (
                              <Check className="mr-1" />
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

            {/* 진행 버튼 */}
            <div className="mt-8 flex items-center justify-end">
              <Button onClick={goToResults} aria-label="See recommendations">
                추천작 보기
              </Button>
            </div>
          </section>

      			<div className={styles.navigationBar}>
        				<div className={styles.navBarFirstRow}>
          					<div className={styles.navigationBarLeft} onClick={handleBack} role="button" tabIndex={0}>
            						<div className={styles.label}>Back</div>
            						<img className={styles.icon} alt="Back" src={backIcon} />
          					</div>
          					<div className={styles.navigationBarCenter}>
            						<div className={styles.title}>키워드를 선택하세요.</div>
          					</div>
        				</div>
      			</div>
      			<div className={styles.systemBar}>
        				<div className={styles.group}>
          					<img className={styles.groupIcon} alt="Status Group" src={groupSvg} />
        				</div>
        				<div className={styles.starus}>
          					<div className={styles.time}>5:12</div>
        				</div>
      			</div>
      			<div className={styles.searchPlaceholder}>
              <input
                className={styles.searchField}
                type="text"
                placeholder="키워드 검색..."
                aria-label="키워드 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <img className={styles.magnifyingglassIcon} alt="Search" src={magnifyingGlass} />
              <img className={styles.mobileIndex_icon} alt="Extra" src={extraIcon} onClick={resetSelection} />
      			</div>
    		</div>);
};

export default mobileIndex;
