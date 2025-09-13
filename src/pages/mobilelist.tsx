import { useNavigate } from 'react-router-dom';
import { useRef, useState, KeyboardEvent, useMemo, useEffect } from 'react';
import ContextMenu from "../components/ContextMenu";
import styles from './mobilelist.module.css';
import backIcon from "../assets/mobileIndex/back.svg";
import menuIcon from "../assets/mobileIndex/menu.svg";
import magnifyingglassIcon from "../assets/mobilelist/magnifyingglass.svg";
import microphoneIcon from "../assets/mobilelist/x.svg";
import chevronRightIcon from "../assets/mobilelist/chevron.right.svg";
import line3HorizontalIcon from "../assets/mobilelist/+.svg";
import squareAndPencilIcon from "../assets/mobilelist/square.and.pencil.svg";
import { works as allWorks } from "@/data/works";
import { tags as allTags, Tag } from "@/data/tags";
import { workTags as mappings } from "@/data/workTags";

const MobileHeader = () => {
  useEffect(() => {
    console.log("MobileHeader rendered");
  }, []);

  const navigate = useNavigate();
  const menuBtnRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    console.log("Menu button clicked");
    setMenuOpen(true);
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
      "분량": 1,
      "완결여부": 2,
      "세계관": 3,
      "장르": 4,
      "설정": 5,
      "관계": 6,
      "분위기": 7,
    };

    return allWorks.map((w) => ({
      id: w.id,
      title: w.title,
      author: w.author,
      source_url: w.source_url,
      tags: (byWork.get(w.id) ?? []).sort((a, b) => {
        const ca = categoryOrder[a.category] ?? 999;
        const cb = categoryOrder[b.category] ?? 999;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name, "ko");
      }),
    })).sort((a, b) => {
      const ak = a.author.charCodeAt(0) >= 0xac00 && a.author.charCodeAt(0) <= 0xd7a3;
      const bk = b.author.charCodeAt(0) >= 0xac00 && b.author.charCodeAt(0) <= 0xd7a3;

      if (ak !== bk) return ak ? -1 : 1;

      const locale = ak ? "ko" : "en";
      const authorCompare = a.author.localeCompare(b.author, locale);
      if (authorCompare !== 0) return authorCompare;

      return a.title.localeCompare(b.title, locale);
    });
  }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) => {
      if (r.title.toLowerCase().includes(k)) return true;
      if (r.author.toLowerCase().includes(k)) return true;
      return r.tags.some(t =>
        t.name.toLowerCase().includes(k) ||
        (t.aliases ?? []).some((a) => a.toLowerCase().includes(k))
      );
    });
  }, [q, rows]);

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
                onClick={() => navigate(-1)}
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
                onClick={() => setMenuOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMenuOpen(true);
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

      <div className={styles.mobilelist}>
        <div className={styles.topnavigation}>
          <div className={styles.extra}>
            <div className={styles.searchfield}>
              <div className={styles.mobilelistSearchfield} onClick={() => inputRef.current?.focus()}>
                <img className={styles.iconMagnifyingglass} alt="" src={magnifyingglassIcon} />
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="제목 / 작가명 / 키워드 검색..."
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
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSf_SdK01Mas2ZVMeXG3-AOTdFsIMyjLRAyCMWFvpg3YZaFnkw/viewform" target="_blank" rel="noopener noreferrer">
              <img className={styles.sfSymbolLine3horizontal} alt="" src={line3HorizontalIcon} />
            </a>
            <div className={styles.updatesUnread}>
              <div className={styles.url}>{filtered.length} Works</div>
              <div className={styles.mobilelistUrl}>Updated Sep 13</div>
            </div>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLScU-elPQxC2vlIifZkISf8Z6jhAC3zZA1Anw8-Xa8kY7gc-Sg/viewform" target="_blank" rel="noopener noreferrer">
              <img className={styles.sfSymbolSquareandpencil} alt="" src={squareAndPencilIcon} />
            </a>
          </div>
          <div className={styles.homeindicator} />
        </div>
      </div>
      {menuOpen && (
        <ContextMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuBtnRef} />
      )}
    </>
  );
}

export default MobileHeader;