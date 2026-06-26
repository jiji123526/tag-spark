import { useNavigate } from 'react-router-dom';
import { useRef, useState, KeyboardEvent, useMemo, useEffect } from 'react';
import ContextMenu from "../components/ContextMenu";
import SortMenu, { SortMenuItem } from "../components/SortMenu";
import AddWorkCompose from "../components/AddWorkCompose";
import styles from './mobilelist.module.css';
import backIcon from "../assets/mobileIndex/back.svg";
import menuIcon from "../assets/mobileIndex/menu.svg";
import magnifyingglassIcon from "../assets/mobilelist/magnifyingglass.svg";
import microphoneIcon from "../assets/mobilelist/x.svg";
import chevronRightIcon from "../assets/mobilelist/chevron.right.svg";
import line3HorizontalIcon from "../assets/mobilelist/sort.svg";
import squareAndPencilIcon from "../assets/mobilelist/square.and.pencil.svg";
import { Tag, Work, WorkTag } from "@/lib/types";

const MobileHeader = () => {
  const [allWorks, setAllWorks] = useState<Work[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [mappings, setMappings] = useState<WorkTag[]>([]);

  useEffect(() => {
    fetch("/api/reco-data")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setAllWorks(data.works);
          setAllTags(data.tags);
          setMappings(data.workTags);
        }
      })
      .catch(() => {});
  }, []);

  const navigate = useNavigate();
  const menuBtnRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortBtnRef = useRef<HTMLAnchorElement | HTMLDivElement | null>(null);
  const [sortKey, setSortKey] = useState<'author_asc' | 'views_desc' | 'likes_desc' | 'comments_desc' | 'popular_desc' | null>('author_asc');
  const [composeOpen, setComposeOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const compareByAuthorTitle = (a: {author: string; title: string}, b: {author: string; title: string}) => {
    const ak = a.author.charCodeAt(0) >= 0xac00 && a.author.charCodeAt(0) <= 0xd7a3;
    const bk = b.author.charCodeAt(0) >= 0xac00 && b.author.charCodeAt(0) <= 0xd7a3;
    if (ak !== bk) return ak ? -1 : 1;
    const locale = ak ? "ko" : "en";
    const authorCompare = a.author.localeCompare(b.author, locale);
    if (authorCompare !== 0) return authorCompare;
    return a.title.localeCompare(b.title, locale);
  };

  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    const byWork = new Map<number, Tag[]>();
    for (const m of mappings) {
      const tag = tagById.get(m.tag_id);
      if (!tag) continue;
      const list = byWork.get(m.work_id) ?? [];
      list.push(tag);
      byWork.set(m.work_id, list);
    }

    const categoryOrder: Record<string, number> = {
      "분량": 1, "완결여부": 2, "세계관": 3, "장르": 4, "설정": 5, "관계": 6, "분위기": 7,
    };

    return allWorks.map((w) => ({
      id: w.id,
      title: w.title,
      aliases: w.aliases ?? [],
      author_aliases: w.author_aliases ?? [],
      author: w.author,
      source_url: w.source_url,
      tags: (byWork.get(w.id) ?? [])
        .filter((t) => t.id !== 900)
        .sort((a, b) => {
          const ca = categoryOrder[a.category] ?? 999;
          const cb = categoryOrder[b.category] ?? 999;
          if (ca !== cb) return ca - cb;
          return a.name.localeCompare(b.name, "ko");
        }),
      views: w.views,
      likes: w.likes,
      comments: w.comments,
    }));
  }, [allWorks, allTags, mappings]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    let base = rows;
    if (k) {
      base = rows.filter((r) => {
        if (r.title.toLowerCase().includes(k)) return true;
        if (r.author.toLowerCase().includes(k)) return true;
        if ((r.aliases ?? []).some((a: string) => a.toLowerCase().includes(k))) return true;
        if ((r.author_aliases ?? []).some((a: string) => a.toLowerCase().includes(k))) return true;
        return r.tags.some(t =>
          t.name.toLowerCase().includes(k) ||
          (t.aliases ?? []).some((a) => a.toLowerCase().includes(k))
        );
      });
    }
    if (sortKey === 'author_asc') {
      // copy before sort to avoid mutating memoized arrays
      return [...base].sort(compareByAuthorTitle);
    }
    if (sortKey === 'views_desc') {
      return [...base].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    }
    if (sortKey === 'likes_desc') {
      return [...base].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    }
    if (sortKey === 'comments_desc') {
      return [...base].sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0));
    }
    if (sortKey === 'popular_desc') {
      return [...base].sort((a, b) => {
        const scoreA = (a.views ?? 0) + (a.likes ?? 0) * 10 + (a.comments ?? 0) * 20;
        const scoreB = (b.views ?? 0) + (b.likes ?? 0) * 10 + (b.comments ?? 0) * 20;
        return scoreB - scoreA;
      });
    }
    return base;
  }, [q, rows, sortKey]);

  return (
    <>
      <div className={styles.pageTitle}>
        <div className={styles.actionsContainer}>
          <div className={styles.back}>
            <div className={styles.content}>
              <div
                className={styles.iconAndText}
                role="button"
                tabIndex={0}
                aria-label="모바일 인덱스로 이동"
                onClick={() => navigate("/mobile-index")}
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

          <div className={styles.leftAction}><div className={styles.content2} /></div>
          <div className={styles.rightActions}>
            <div className={styles.pageTitle}><div className={styles.content2} /></div>
            <div className={styles.pageTitle}><div className={styles.content2} /></div>
            <div className={styles.pageTitle}><div className={styles.content2} /></div>
            <div className={styles.pageTitle}>
              <div
                className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnActive : ''}`}
                ref={menuBtnRef}
                role="button"
                aria-label="메뉴 열기"
                tabIndex={0}
                onClick={() => { setMenuOpen((v) => !v); setSortOpen(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMenuOpen((v) => !v);
                    setSortOpen(false);
                  }
                }}
              >
                <img className={styles.icon} src={menuIcon} alt="menu icon" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.titleContainer}>
        <b className={styles.title2}>현재 등록된 추천작</b>
      </div>

      <div className={styles.mobilelist} ref={listRef}>
        <div className={styles.topnavigation}>
          <div className={styles.extra}>
            <div className={styles.searchfield}>
              <div className={styles.mobilelistSearchfield} onClick={() => inputRef.current?.focus()}>
                <img className={styles.iconMagnifyingglass} alt="" src={magnifyingglassIcon} />
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="제목 / 작가 / 키워드 검색..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <img
                  className={styles.sfSymbolMicrophone}
                  alt=""
                  src={microphoneIcon}
                  role="button"
                  onClick={() => {
                    setQ("");
                    inputRef.current?.focus();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.threads}>
          {filtered.map((r) => (
            <a
              key={r.id}
              href={r.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mobilelistThread}
            >
              <div className={styles.mobilelistcontent}>
                <div className={styles.contactTime}>
                  <div className={styles.contactName}>{r.title}</div>
                  <div className={styles.timeChevron}>
                    <img className={styles.sfSymbolChevronright} alt="" src={chevronRightIcon} />
                  </div>
                </div>
                <div className={styles.subject}>
                  <div className={styles.mobilelistSubject}>{r.author}</div>
                </div>
                <div className={styles.preview}>
                  {r.tags.map((t) => t.name).join(", ")}
                </div>
              </div>
            </a>
          ))}
        </div>
        <div className={styles.tabBar}>
          <div className={styles.content9}>
            <div
              className={styles.sortButton}
              ref={sortBtnRef as any}
              role="button"
              tabIndex={0}
              aria-label="정렬 옵션 열기"
              onClick={() => { setSortOpen((v) => !v); setMenuOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSortOpen((v) => !v); setMenuOpen(false); }}}
            >
              <img className={styles.sfSymbolLine3horizontal} alt="sort menu" src={line3HorizontalIcon} />
            </div>
            <div className={styles.updatesUnread}>
              <div className={styles.url}>{filtered.length} Works</div>
            </div>
            <a onClick={() => setComposeOpen(true)} style={{ cursor: 'pointer' }}>
              <img className={styles.sfSymbolSquareandpencil} alt="" src={squareAndPencilIcon} />
            </a>
          </div>
          <div className={styles.homeindicator} />
        </div>
      </div>
      {sortOpen && (
        <SortMenu
          open={sortOpen}
          onClose={() => setSortOpen(false)}
          anchorRef={sortBtnRef as any}
          items={[
            { label: '가나다순', onClick: () => { setSortKey('author_asc'); listRef.current?.scrollTo(0, 0); } },
            { label: '조회수순', onClick: () => { setSortKey('views_desc'); listRef.current?.scrollTo(0, 0); } },
            { label: '좋아요순', onClick: () => { setSortKey('likes_desc'); listRef.current?.scrollTo(0, 0); } },
            { label: '댓글순', onClick: () => { setSortKey('comments_desc'); listRef.current?.scrollTo(0, 0); } },
            { label: '인기순', onClick: () => { setSortKey('popular_desc'); listRef.current?.scrollTo(0, 0); } },
          ]}
        />
      )}
      {menuOpen && (
        <ContextMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuBtnRef} />
      )}
      <AddWorkCompose open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  );
}

export default MobileHeader;