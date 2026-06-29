import { FunctionComponent, useState, KeyboardEvent, useEffect, useRef } from 'react';
import styles from './Index.module.css';

import backIcon from "../assets/icons/index/back.svg";
import groupSvg from "../assets/icons/index/Group.svg";
import magnifyingGlass from "../assets/icons/index/Magnifyingglass.svg";
import extraIcon from "../assets/icons/index/x.svg";
import menuIcon from "../assets/icons/index/menu.svg";

import { useNavigate } from 'react-router-dom';
import { Tag } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Check, MinusCircle } from "lucide-react";
import ContextMenu from "../components/ContextMenu";

const MobileIndex: FunctionComponent = () => {
	const navigate = useNavigate();
	const handleBack = () => navigate(-1);

  const [allTags, setAllTags] = useState<Tag[]>([]);

  useEffect(() => {
    fetch("/api/tags")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAllTags(data); })
      .catch(() => {});
  }, []);

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
          <div className={styles.pageTitle}>
            <div className={styles.actionsContainer}>
              <div className={styles.back}>
                <div className={styles.content}>
                  <div
                    className={styles.iconAndText}
                    role="button"
                    tabIndex={0}
                    aria-label="모바일 인덱스로 이동"
                    onClick={() => navigate('/Onboarding')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate('/Onboarding');
                      }
                    }}
                  >
                    <div className={styles.icon4}>
                      <img className={styles.div3} src={backIcon} alt="left icon" />
                    </div>
                    <div className={styles.back2}>Back</div>
                  </div>
                </div>
              </div>
              <div className={styles.leftAction}>
                <div className={styles.content2} />
              </div>
              <div className={styles.rightActions}>
                <div className={styles.pageTitle}>
                  <div className={styles.content2} />
                </div>
                <div className={styles.pageTitle}>
                  <div className={styles.content2} />
                </div>
                <div className={styles.pageTitle}>
                  <div className={styles.content2} />
                </div>
                <div className={styles.pageTitle}>
                  <div
                    className={`${styles.icon3} ${menuOpen ? styles.menuActive : ''}`}
                    ref={menuBtnRef}
                    role="button"
                    aria-label="메뉴 열기"
                    tabIndex={0}
                    onClick={() => setMenuOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setMenuOpen(true);
                      }
                    }}
                  >
                    <img className={styles.div3} src={menuIcon} alt="menu icon" />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.titleContainer}>
              <b className={styles.title2}>키워드 선택하기</b>
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
            
          </div>
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

        {menuOpen && (
          <ContextMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuBtnRef} />
        )}
        <footer className="py-4 text-center text-sm text-muted-foreground border-t">
          © 2025 @cxwdxggy <br /> 문의는 메뉴 탭의 요청 폼 또는 트위터(X) 디엠 주세요.
        </footer>
    		</div>);
};

export default MobileIndex;
