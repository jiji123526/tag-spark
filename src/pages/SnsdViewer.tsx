import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { readApiError, snsdApiUrl, SnsdWork } from "@/lib/snsd-api";
import styles from "./SnsdViewer.module.css";

type ReaderBookmark = {
  id: string;
  paragraph: number;
  paragraphOffset?: number;
  excerpt: string;
  progress: number;
  scrollY: number;
  createdAt: number;
};

const BookmarkIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.5 3A2.5 2.5 0 0 0 4 5.5v15.56a.94.94 0 0 0 1.48.77L12 17.17l6.52 4.66a.94.94 0 0 0 1.48-.77V5.5A2.5 2.5 0 0 0 17.5 3h-11ZM6 5.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5v13.62l-5.45-3.9a.94.94 0 0 0-1.1 0L6 19.12V5.5Z" fill="currentColor" /></svg>;

export default function SnsdViewer() {
  const { id } = useParams();
  const paragraphRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const lastScrollY = useRef(window.scrollY);
  const [work, setWork] = useState<SnsdWork | null>(null);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(() => Number(window.localStorage.getItem("snsd-reader-font-size")) || 17);
  const [error, setError] = useState("");
  const [headerHidden, setHeaderHidden] = useState(() => window.scrollY > 40);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const paragraphs = useMemo(() => content ? content.split(/\r?\n\s*\r?\n/) : [], [content]);
  const bookmarkKey = `snsd-reader-bookmarks-${id}`;

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const loadViewer = async () => {
      const [workResponse, contentResponse] = await Promise.all([
        fetch(snsdApiUrl(`/api/works/${id}`), { signal: controller.signal }),
        fetch(snsdApiUrl(`/api/works/${id}/content`), { signal: controller.signal }),
      ]);

      let loadedWork: SnsdWork | undefined;
      if (workResponse.ok) {
        loadedWork = await workResponse.json();
      } else if (workResponse.status === 404) {
        // Older Worker deployments may have the list/content routes without the
        // single-work metadata route. The list is a safe compatibility fallback.
        const listResponse = await fetch(snsdApiUrl("/api/works?sort=new"), { signal: controller.signal });
        if (!listResponse.ok) throw new Error(await readApiError(listResponse));
        const works = await listResponse.json() as SnsdWork[];
        loadedWork = works.find(candidate => String(candidate.id) === id);
      } else {
        throw new Error(await readApiError(workResponse));
      }

      if (!loadedWork) throw new Error("작품을 찾을 수 없습니다.");
      if (!contentResponse.ok) throw new Error(await readApiError(contentResponse));
      setWork(loadedWork);
      setContent(await contentResponse.text());
    };

    loadViewer().catch(requestError => {
      if (requestError?.name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "작품을 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!content || !id) return;
    const key = `snsd-reader-position-${id}`;
    const saved = Number(window.localStorage.getItem(key));
    if (saved > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)));
    let saveTimer = 0;
    const save = () => window.localStorage.setItem(key, String(window.scrollY));
    const scheduleSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 250);
    };
    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.clearTimeout(saveTimer);
      save();
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("pagehide", save);
    };
  }, [content, id]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(bookmarkKey);
      const parsed = stored ? JSON.parse(stored) : [];
      setBookmarks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setBookmarks([]);
    }
  }, [bookmarkKey]);

  useEffect(() => {
    if (!bookmarksOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBookmarksOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [bookmarksOpen]);

  useEffect(() => {
    let frame = 0;
    const updateHeader = () => {
      frame = 0;
      const current = window.scrollY;
      if (current <= 16) setHeaderHidden(false);
      else if (current > lastScrollY.current + 3) setHeaderHidden(true);
      else if (current < lastScrollY.current - 3) setHeaderHidden(false);
      lastScrollY.current = current;
    };
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeader);
    };
    updateHeader();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const changeFontSize = (next: number) => {
    const clamped = Math.min(24, Math.max(14, next));
    setFontSize(clamped);
    window.localStorage.setItem("snsd-reader-font-size", String(clamped));
  };

  const saveBookmarks = (next: ReaderBookmark[]) => {
    const ordered = [...next].sort((a, b) => a.paragraph - b.paragraph || (a.paragraphOffset ?? 0) - (b.paragraphOffset ?? 0) || a.createdAt - b.createdAt);
    setBookmarks(ordered);
    window.localStorage.setItem(bookmarkKey, JSON.stringify(ordered));
  };

  const currentLocation = () => {
    const anchor = window.innerHeight * 0.24;
    let current = 0;
    paragraphRefs.current.forEach((element, index) => {
      if (element && element.getBoundingClientRect().top <= anchor) current = index;
    });
    const element = paragraphRefs.current[current];
    const rect = element?.getBoundingClientRect();
    const paragraphOffset = rect && rect.height > 0 ? Math.min(1, Math.max(0, (anchor - rect.top) / rect.height)) : 0;
    return { paragraph: current, paragraphOffset };
  };

  const addBookmark = () => {
    if (!paragraphs.length) return;
    const { paragraph, paragraphOffset } = currentLocation();
    const text = paragraphs[paragraph]?.replace(/\s+/g, " ").trim() || "빈 문단";
    const excerptStart = Math.min(Math.max(0, Math.floor(text.length * paragraphOffset)), Math.max(0, text.length - 1));
    const excerptText = text.slice(excerptStart, excerptStart + 72).trim() || text.slice(0, 72);
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const bookmark: ReaderBookmark = {
      id: crypto.randomUUID(),
      paragraph,
      paragraphOffset,
      excerpt: excerptStart + excerptText.length < text.length ? `${excerptText}…` : excerptText,
      progress: Math.min(1, window.scrollY / maxScroll),
      scrollY: window.scrollY,
      createdAt: Date.now(),
    };
    saveBookmarks([...bookmarks, bookmark]);
  };

  const goToBookmark = (bookmark: ReaderBookmark) => {
    setBookmarksOpen(false);
    requestAnimationFrame(() => {
      let target = paragraphRefs.current[bookmark.paragraph];
      if (!target) {
        const matchingIndex = paragraphs.findIndex(paragraph => paragraph.replace(/\s+/g, " ").includes(bookmark.excerpt.replace(/…$/, "")));
        target = paragraphRefs.current[matchingIndex];
      }
      if (target) {
        const rect = target.getBoundingClientRect();
        const offset = Math.min(1, Math.max(0, bookmark.paragraphOffset ?? 0));
        const top = window.scrollY + rect.top + rect.height * offset - window.innerHeight * 0.24;
        window.scrollTo({ top, behavior: "smooth" });
      } else {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: maxScroll * bookmark.progress, behavior: "smooth" });
      }
    });
  };

  const deleteBookmark = (bookmarkId: string) => {
    saveBookmarks(bookmarks.filter(bookmark => bookmark.id !== bookmarkId));
  };

  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${headerHidden ? styles.headerHidden : ""}`}>
        <a className={styles.backLink} href="/snsd">← 목록</a>
        <div className={styles.workMeta}><strong>{work?.title ?? "불러오는 중…"}</strong>{work && <span>{work.author} · {work.pairing}</span>}</div>
        <div className={styles.fontControls}><button type="button" onClick={() => changeFontSize(fontSize - 1)} aria-label="글자 작게">가</button><button type="button" onClick={() => changeFontSize(fontSize + 1)} aria-label="글자 크게">가+</button><button className={styles.bookmarkButton} type="button" onClick={() => setBookmarksOpen(true)} aria-label={`북마크 ${bookmarks.length}개`}><BookmarkIcon />{bookmarks.length > 0 && <span>{bookmarks.length}</span>}</button></div>
      </header>
      <main className={styles.reader}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!error && <article style={{ fontSize }}>{content
          ? paragraphs.map((paragraph, index) => <p className={styles.paragraph} ref={element => { paragraphRefs.current[index] = element; }} key={index}>{paragraph}</p>)
          : "본문을 불러오는 중입니다…"}</article>}
      </main>
      {bookmarksOpen && (
        <div className={styles.bookmarkOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setBookmarksOpen(false); }}>
          <section className={styles.bookmarkSheet} role="dialog" aria-modal="true" aria-labelledby="bookmark-title">
            <div className={styles.bookmarkSheetHeader}><h2 id="bookmark-title">북마크 {bookmarks.length}</h2><button type="button" onClick={() => setBookmarksOpen(false)} aria-label="닫기">×</button></div>
            <button className={styles.addBookmarkButton} type="button" onClick={addBookmark}>현재 위치 북마크</button>
            <div className={styles.bookmarkList}>
              {bookmarks.length === 0 && <p className={styles.emptyBookmarks}>저장한 위치가 없습니다.</p>}
              {bookmarks.map(bookmark => (
                <div className={styles.bookmarkItem} key={bookmark.id}>
                  <button className={styles.bookmarkLocation} type="button" onClick={() => goToBookmark(bookmark)}><strong>{Math.round(bookmark.progress * 100)}%</strong><span>{bookmark.excerpt}</span></button>
                  <button className={styles.deleteBookmarkButton} type="button" onClick={() => deleteBookmark(bookmark.id)} aria-label="북마크 삭제">×</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
