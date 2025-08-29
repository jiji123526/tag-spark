import { FunctionComponent, useMemo, useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LeftIcon from "../assets/mobilerecom/left.svg";
import MenuIcon from "../assets/mobilerecom/menu.svg";
import MagIcon from "../assets/mobilerecom/tag.svg";
import styles from './mobilerecom.module.css';

import { works as allWorks } from "@/data/works";
import { tags as allTags, Tag } from "@/data/tags";
import { workTags as mappings } from "@/data/workTags";
import { computeRecommendations } from "@/lib/reco";

import ContextMenu from "../components/ContextMenu";

const PAGE_SIZE = 10;
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const mobilerecom:FunctionComponent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLDivElement | null>(null);

  // selected / excluded ids from query
  const selected = useMemo(() => {
    const raw = (searchParams.get("tags") || "").trim();
    if (!raw) return [] as number[];
    return raw.split(",").map((n) => parseInt(n, 10)).filter(Number.isFinite);
  }, [searchParams]);

  const excluded = useMemo(() => {
    const raw = (searchParams.get("exclude") || "").trim();
    if (!raw) return [] as number[];
    return raw.split(",").map((n) => parseInt(n, 10)).filter(Number.isFinite);
  }, [searchParams]);

  const selectedEffective = useMemo(() => {
    if (excluded.length === 0) return selected;
    const ex = new Set(excluded);
    return selected.filter((id) => !ex.has(id));
  }, [selected, excluded]);

  const selectedTags = useMemo(
    () =>
      selectedEffective
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t),
    [selectedEffective]
  );

  const selectedText = useMemo(() => {
    const names = selectedTags.map((t) => t.name).join(', ');
    return names || '선택한 키워드가 없습니다.';
  }, [selectedTags]);

  // tags grouped by work id (order: weight → category → name)
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
      "세계관": 1, "장르": 2, "설정": 3, "관계": 4, "분위기": 5, "분량": 6, "완결여부": 7,
    };
    for (const [workId, list] of map) {
      list.sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        const aCat = categoryOrder[a.tag.category] ?? 999;
        const bCat = categoryOrder[b.tag.category] ?? 999;
        if (aCat !== bCat) return aCat - bCat;
        return a.tag.name.localeCompare(b.tag.name, 'ko');
      });
      out.set(workId, list.map((x) => x.tag));
    }
    return out;
  }, []);

  // filter out works containing excluded tag ids
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

  // exact matches (contains all selectedEffective)
  const exactMatches = useMemo(() => {
    if (selectedEffective.length === 0) return [] as typeof allWorks;
    const byWork: Record<number, Record<number, number>> = mappings.reduce((acc, m) => {
      (acc[m.work_id] ??= {});
      acc[m.work_id][m.tag_id] = m.weight;
      return acc;
    }, {} as Record<number, Record<number, number>>);
    const hits = filteredWorks.filter((w) => {
      const tagWeights = byWork[w.id] || {};
      return selectedEffective.every((id) => id in tagWeights);
    });
    return shuffle(hits);
  }, [selectedEffective, filteredWorks]);

  // similar (page-less here; keep 10 like original)
  const similar = useMemo(() => {
    if (selectedEffective.length === 0) return shuffle(filteredWorks).slice(0, PAGE_SIZE);
    const recos = computeRecommendations(selectedEffective, {
      works: filteredWorks,
      tags: allTags,
      excludeTagIds: excluded,
    });
    const exactIds = new Set(exactMatches.map((w) => w.id));
    const onlySimilar = recos.filter((w) => !exactIds.has(w.id));
    return onlySimilar.sort((a, b) => b.similarity - a.similarity).slice(0, PAGE_SIZE);
  }, [selectedEffective, excluded, filteredWorks, exactMatches]);

  useEffect(() => { document.title = '키워드 추천 결과'; }, []);

  // row renderer matching the current visual layout
  const renderRow = (w: any, withSeparator: boolean) => (
    <div className={styles.pageTitle} key={w.id}>
      <a href={w.source_url} target="_blank" rel="noopener noreferrer" className={styles.row}>
        <b className={styles.title5}>{w.title}</b>
        <div className={styles.timeAndPreview}>
          <div className={styles.time}>{w.author}</div>
          <div className={styles.firstRow} />
        </div>
        <div className={styles.iconAndText2}>
          <div className={styles.time}>#</div>
          <div className={styles.time}>
            {(tagsByWorkId.get(w.id) || []).map((t) => t.name).join(', ')}
          </div>
        </div>
        {withSeparator && (
          <div className={styles.hasSeparator}><div className={styles.separator} /></div>
        )}
      </a>
    </div>
  );

  	return (
    		<div className={styles.mobilerecom}>
      			<div className={styles.pageTitle}>
        				<div className={styles.pageTitle}>
          					<div className={styles.statusBar}>
            						
          					</div>
          					<div className={styles.actionsContainer}>
            						<div className={styles.back}>
              							<div className={styles.content}>
                								<div
                                            className={styles.iconAndText}
                                            role="button"
                                            tabIndex={0}
                                            aria-label="모바일 인덱스로 이동"
                                            onClick={() => navigate('/mobile-index')}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                navigate('/mobileindex');
                                              }
                                            }}
                                          >
                                                <div className={styles.icon4}>
                  									<img className={styles.div3} src={LeftIcon} alt="left icon" />
                								</div>
                  									<div className={styles.back2}>키워드 선택하기</div>
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
                  									<img className={styles.div3} src={MenuIcon} alt="menu icon" />
                								</div>
              							</div>
            						</div>
          					</div>
          					<div className={styles.titleContainer}>
            						<div className={styles.title}>
              							<b className={styles.title2}>키워드 매칭 결과</b>
              							<div className={styles.pageTitle}>
                								<div className={styles.content6} />
              							</div>
            						</div>
          					</div>
        				</div>
      			</div>
      			<div className={styles.section}>
                <div className={styles.searchInput}>
                  <div className={styles.inputChangeOpacity}>
                    <div className={styles.iconAndText}>
                      <img className={styles.div} src={MagIcon} alt="search" />
                      <div className={styles.scrollFade}>
                        <div className={styles.textScroll} aria-label="선택한 키워드">
                          {selectedText}
                        </div>
                      </div>
                    </div>
                    
                  </div>
                </div>
        				<div className={styles.pageTitle}>
          					<div className={styles.pageTitle}>
            						<div className={styles.title3}>
              							<b className={styles.title4}>완벽 매치 추천작</b>
              							<span className={styles.matchCount}>({exactMatches.length})</span>
            						</div>
          					</div>
          					<div className={styles.card}>
                      {exactMatches.length === 0 ? (
                        <div className={styles.pageTitle}><div className={styles.row}><b className={styles.time}>완벽 매치 작품이 없습니다.</b></div></div>
                      ) : (
                        exactMatches.map((w, i) => renderRow(w, i !== exactMatches.length - 1))
                      )}
          					</div>
        				</div>
        				<div className={styles.pageTitle}>
          					<div className={styles.pageTitle}>
            						<div className={styles.title3}>
              							<b className={styles.title4}>이런 포타는 어떠세요?</b>
                								</div>
                								</div>
                								<div className={styles.card}>
                                                {similar.map((w, i) => renderRow(w, i !== similar.length - 1))}
                								</div>
                								</div>
                								</div>
                								{menuOpen && (
                            <ContextMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuBtnRef} />
                          )}
                								</div>);
              							};
              							
              							export default mobilerecom;