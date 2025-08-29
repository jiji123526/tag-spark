import { FunctionComponent, useState, KeyboardEvent, useEffect, useRef } from 'react';
import styles from './mobileIndex.module.css';

import backIcon from "../assets/mobileIndex/back.svg";
import groupSvg from "../assets/mobileIndex/Group.svg";
import magnifyingGlass from "../assets/mobileIndex/Magnifyingglass.svg";
import extraIcon from "../assets/mobileIndex/x.svg";
import menuIcon from "../assets/mobileIndex/menu.svg";

import { useNavigate } from 'react-router-dom';
import { tags as allTags, Tag } from "@/data/tags";
import { Button } from "@/components/ui/button";
import { Check, MinusCircle } from "lucide-react";
import ContextMenu from "../components/ContextMenu";

const MobileIndex: FunctionComponent = () => {
	const navigate = useNavigate();
	const handleBack = () => navigate(-1);

  const selectedBarRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLDivElement | null>(null);

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

  const [menuOpen, setMenuOpen] = useState(false);
  const handleMenuToggle = () => setMenuOpen((v) => !v);

  const goToResults = () => {
    const includeSet = new Set(selected);
    const uniqueSelected = Array.from(includeSet);
    const uniqueExcluded = excluded.filter((id) => !includeSet.has(id));
    const qs = uniqueSelected.join(",");
    const ex = uniqueExcluded.join(",");
    const params = new URLSearchParams();
    if (qs) params.set("tags", qs);
    if (ex) params.set("exclude", ex);
    navigate(`/mobile-recom?${params.toString()}`);
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

  // Keep CSS variable --selbar-h in sync with the selected bar's height
  useEffect(() => {
    const updateSelbarHeight = () => {
      const h = selectedBarRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty('--selbar-h', `${h}px`);
    };
    updateSelbarHeight();
    window.addEventListener('resize', updateSelbarHeight);
    return () => window.removeEventListener('resize', updateSelbarHeight);
  }, [selected.length, excluded.length]);

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

				<div
  					className={styles.lightLargeButton}
  					onClick={goToResults}
  					role="button"
  					aria-label="추천작 보기"
				>
  					<div className={styles.background} />
  					<div className={styles.button}>추천작 보기</div>
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
                    <div className={styles.navigationBarRight}>
                      <div
                        className={styles.menuAnchor}
                        ref={menuBtnRef}
                        role="button"
                        aria-label="메뉴 열기"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuOpen(true); } }}
                      >
                        <img
                          className={styles.menuButton}
                          alt="Menu"
                          src={menuIcon}
                          draggable={false}
                        />
                      </div>
                    </div>
        				</div>
      			</div>

          {/* 선택된 키워드 요약 (검색창 위) */}
          <div className={styles.selectedBar} aria-live="polite" ref={selectedBarRef}>
            <div className={styles.selectedList}>
              {selected.map((id) => {
                const t = allTags.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <button
                    key={`sel-${id}`}
                    type="button"
                    className={`${styles.selectedChip} ${styles.include}`}
                    onClick={() => setSelected((p) => p.filter((x) => x !== id))}
                    aria-label={`${t.name} 포함 해제`}
                    title="클릭하면 해제됩니다"
                  >
                    {'+ ' + t.name}
                  </button>
                );
              })}
              {excluded.map((id) => {
                const t = allTags.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <button
                    key={`ex-${id}`}
                    type="button"
                    className={`${styles.selectedexcludedChip} ${styles.exclude}`}
                    onClick={() => setExcluded((p) => p.filter((x) => x !== id))}
                    aria-label={`${t.name} 제외 해제`}
                    title="클릭하면 해제됩니다"
                  >
                    {'- ' + t.name}
                  </button>
                );
              })}
            </div>
            {(selected.length > 0 || excluded.length > 0) && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={resetSelection}
                aria-label="선택된 키워드 전체 해제"
                title="전체 해제"
              >
                Clear
              </button>
            )}
          </div>

      			<div className={styles.searchPlaceholder}>
              <input
                className={styles.searchField}
                type="text"
                placeholder="키워드 검색..."
                aria-label="키워드 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ color: "black" }}
              />
              <img className={styles.magnifyingglassIcon} alt="Search" src={magnifyingGlass} />
              <img className={styles.mobileIndex_icon} alt="Extra" src={extraIcon} onClick={resetSelection} />
      			</div>
          {menuOpen && (
            <ContextMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuBtnRef} />
          )}
    		</div>);
};

export default MobileIndex;
