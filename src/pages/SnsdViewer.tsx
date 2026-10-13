import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { cacheSnsdViewerWork, createSnsdManualChapter, deleteSnsdManualChapter, fetchSnsdManualChapters, fetchSnsdViewerContent, getCachedSnsdViewerWork, getSnsdReadProgress, markSnsdWorkRead, readApiError, saveSnsdReadProgress, snsdApiUrl, SnsdManualChapter, SnsdWork, updateSnsdManualChapter } from "@/lib/snsd-api";
import { detectSnsdChapters, SnsdChapter } from "@/lib/snsd-chapters";
import styles from "./SnsdViewer.module.css";

const MenuIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6.75A.75.75 0 0 1 4.75 6h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 6.75Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Zm.75 4.5a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H4.75Z" fill="currentColor" /></svg>;
const SearchIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20.7 19.3-4.2-4.2a7.5 7.5 0 1 0-1.4 1.4l4.2 4.2a1 1 0 0 0 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" fill="currentColor" /></svg>;
const TextSizeIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.25A1.25 1.25 0 0 1 5.25 4h7.5A1.25 1.25 0 0 1 14 5.25v1a.75.75 0 0 1-1.5 0v-.75H10.5v12h1.25a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5H8.5v-12H6.25v.75a.75.75 0 0 1-1.5 0v-1ZM15.5 11.25A1.25 1.25 0 0 1 16.75 10h3A1.25 1.25 0 0 1 21 11.25v.75a.75.75 0 0 1-1.5 0v-.5h-.5v5.25h.5a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.5V11.5h-.5v.5a.75.75 0 0 1-1.5 0v-.75Z" fill="currentColor" /></svg>;

type SearchRange = {
  start: number;
  end: number;
  globalIndex: number;
};

export default function SnsdViewer() {
  const { id } = useParams();
  const paragraphRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const lastScrollY = useRef(window.scrollY);
  const [work, setWork] = useState<SnsdWork | null>(() => id ? getCachedSnsdViewerWork(id) : null);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(() => Number(window.localStorage.getItem("snsd-reader-font-size")) || 17);
  const [error, setError] = useState("");
  const [offlineRead, setOfflineRead] = useState(() => !navigator.onLine);
  const [headerHidden, setHeaderHidden] = useState(() => window.scrollY > 40);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");
  const [activeSearchMatch, setActiveSearchMatch] = useState(0);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [chapters, setChapters] = useState<SnsdChapter[] | null>(null);
  const [manualChapters, setManualChapters] = useState<SnsdManualChapter[]>([]);
  const [manualChaptersLoaded, setManualChaptersLoaded] = useState(false);
  const [chapterEditMode, setChapterEditMode] = useState(false);
  const [chapterSelection, setChapterSelection] = useState<{ paragraph: number; charOffset: number; anchorText: string; title: string } | null>(null);
  const [chapterSaving, setChapterSaving] = useState(false);
  const [chapterMessage, setChapterMessage] = useState("");
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState("");
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const readerArticleRef = useRef<HTMLElement>(null);
  const searchMatchRefs = useRef<Array<HTMLElement | null>>([]);
  const paragraphs = useMemo(() => content ? content.split(/\r?\n\s*\r?\n/) : [], [content]);
  const normalizedParagraphs = useMemo(() => paragraphs.map(paragraph => paragraph.toLocaleLowerCase("ko")), [paragraphs]);
  const searchRanges = useMemo(() => {
    const query = submittedSearchQuery.trim().toLocaleLowerCase("ko");
    let globalIndex = 0;

    return normalizedParagraphs.map(normalizedParagraph => {
      if (!query) return [] as SearchRange[];
      const ranges: SearchRange[] = [];
      let start = normalizedParagraph.indexOf(query);
      while (start !== -1) {
        ranges.push({ start, end: start + query.length, globalIndex });
        globalIndex += 1;
        start = normalizedParagraph.indexOf(query, start + query.length);
      }
      return ranges;
    });
  }, [normalizedParagraphs, submittedSearchQuery]);
  const searchMatchCount = searchRanges.reduce((count, ranges) => count + ranges.length, 0);
  const searchPending = searchQuery.trim().toLocaleLowerCase("ko") !== submittedSearchQuery.trim().toLocaleLowerCase("ko");

  useEffect(() => {
    setChapters(null);
  }, [content]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setManualChapters([]);
    setManualChaptersLoaded(false);
    fetchSnsdManualChapters(id, controller.signal)
      .then(remoteChapters => {
        setManualChapters(current => [...remoteChapters, ...current.filter(chapter => !remoteChapters.some(remote => remote.id === chapter.id))]);
        setManualChaptersLoaded(true);
      })
      .catch(error => {
        if (error?.name !== "AbortError") {
          setManualChapters([]);
          setManualChaptersLoaded(true);
        }
      });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!chapterEditMode) return;
    const captureSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount || !readerArticleRef.current) return;
      const range = selection.getRangeAt(0);
      if (!readerArticleRef.current.contains(range.commonAncestorContainer)) return;
      const getParagraph = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement)?.closest("p");
      const startParagraph = getParagraph(range.startContainer);
      const endParagraph = getParagraph(range.endContainer);
      if (!startParagraph || startParagraph !== endParagraph) return;
      const paragraphIndex = Array.from(readerArticleRef.current.children).indexOf(startParagraph);
      if (paragraphIndex < 0) return;
      const rawText = range.toString();
      const anchorText = rawText.replace(/\s+/g, " ").trim().slice(0, 120);
      if (!anchorText) return;
      const prefixRange = document.createRange();
      prefixRange.selectNodeContents(startParagraph);
      prefixRange.setEnd(range.startContainer, range.startOffset);
      const leadingWhitespace = rawText.length - rawText.trimStart().length;
      setChapterSelection({
        paragraph: paragraphIndex,
        charOffset: prefixRange.toString().length + leadingWhitespace,
        anchorText,
        title: anchorText,
      });
      setChapterMessage("");
    };
    let timer = 0;
    const scheduleCapture = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(captureSelection, 80);
    };
    document.addEventListener("selectionchange", scheduleCapture);
    window.addEventListener("pointerup", scheduleCapture);
    window.addEventListener("touchend", scheduleCapture);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", scheduleCapture);
      window.removeEventListener("pointerup", scheduleCapture);
      window.removeEventListener("touchend", scheduleCapture);
    };
  }, [chapterEditMode]);

  useEffect(() => {
    if (!id || !window.location.pathname.startsWith("/snsd/read/")) return;
    const params = new URLSearchParams(window.location.search);
    params.set("v", "2");
    window.history.replaceState(window.history.state, "", `/snsd/view/${id}?${params.toString()}`);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const loadViewer = async () => {
      const cachedWork = getCachedSnsdViewerWork(id);
      const [workResponse, contentResponse] = await Promise.all([
        cachedWork ? Promise.resolve(null) : fetch(snsdApiUrl(`/api/works/${id}`), { signal: controller.signal }),
        fetchSnsdViewerContent(id, controller.signal),
      ]);

      let loadedWork: SnsdWork | undefined = cachedWork ?? undefined;
      if (workResponse?.ok) {
        loadedWork = await workResponse.json();
      } else if (workResponse?.status === 404) {
        // Older Worker deployments may have the list/content routes without the
        // single-work metadata route. The list is a safe compatibility fallback.
        const listResponse = await fetch(snsdApiUrl("/api/works?sort=new"), { signal: controller.signal });
        if (!listResponse.ok) throw new Error(await readApiError(listResponse));
        const works = await listResponse.json() as SnsdWork[];
        loadedWork = works.find(candidate => String(candidate.id) === id);
      } else if (workResponse) {
        throw new Error(await readApiError(workResponse));
      }

      if (!loadedWork) throw new Error("작품을 찾을 수 없습니다.");
      if (!contentResponse.ok) throw new Error(await readApiError(contentResponse));
      const loadedContent = await contentResponse.text();
      setWork(loadedWork);
      cacheSnsdViewerWork(loadedWork);
      setContent(loadedContent);
      setOfflineRead(!navigator.onLine);
      markSnsdWorkRead(id);
    };

    loadViewer().catch(requestError => {
      if (requestError?.name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "작품을 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const handleOffline = () => setOfflineRead(true);
    const handleOnline = () => setOfflineRead(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!content || !id) return;
    const key = `snsd-reader-position-${id}`;
    const params = new URLSearchParams(window.location.search);
    const restart = params.get("restart") === "1";
    const savedProgress = restart ? null : getSnsdReadProgress(id);
    const saved = restart ? 0 : savedProgress?.scrollY ?? Number(window.localStorage.getItem(key));
    if (restart) {
      window.localStorage.setItem(key, "0");
      saveSnsdReadProgress(id, { scrollY: 0, progress: 0 });
      params.delete("restart");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 0)));
    } else if (saved > 0) {
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)));
    }
    let saveTimer = 0;
    let idleSaveId: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const save = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      window.localStorage.setItem(key, String(window.scrollY));
      saveSnsdReadProgress(id, {
        scrollY: window.scrollY,
        progress: window.scrollY / maxScroll,
      });
    };
    const scheduleSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        if (idleWindow.requestIdleCallback) {
          idleSaveId = idleWindow.requestIdleCallback(save, { timeout: 1000 });
        } else {
          save();
        }
      }, 500);
    };
    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.clearTimeout(saveTimer);
      if (idleSaveId !== null) idleWindow.cancelIdleCallback?.(idleSaveId);
      save();
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("pagehide", save);
    };
  }, [content, id]);

  useEffect(() => {
    if (!chaptersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setChaptersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [chaptersOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    requestAnimationFrame(() => searchInputRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
        setSubmittedSearchQuery("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen && !fontSizeOpen) return;
    const dismissPopovers = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-viewer-popover]")) return;
      if (!(searchOpen && submittedSearchQuery.trim())) setSearchOpen(false);
      setFontSizeOpen(false);
    };
    document.addEventListener("pointerdown", dismissPopovers);
    return () => document.removeEventListener("pointerdown", dismissPopovers);
  }, [fontSizeOpen, searchOpen, submittedSearchQuery]);

  useEffect(() => {
    setActiveSearchMatch(current => Math.min(current, Math.max(0, searchMatchCount - 1)));
  }, [searchMatchCount]);

  useEffect(() => {
    if (!searchOpen || !searchMatchCount) return;
    requestAnimationFrame(() => searchMatchRefs.current[activeSearchMatch]?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [activeSearchMatch, searchMatchCount, searchOpen]);

  useEffect(() => {
    let frame = 0;
    const updateHeader = () => {
      frame = 0;
      const current = window.scrollY;
      if (searchOpen) setHeaderHidden(false);
      else if (current <= 16) setHeaderHidden(false);
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
  }, [searchOpen]);

  const changeFontSize = (next: number) => {
    const clamped = Math.min(24, Math.max(14, next));
    setFontSize(clamped);
    window.localStorage.setItem("snsd-reader-font-size", String(clamped));
  };

  const moveSearchMatch = (direction: 1 | -1) => {
    if (!searchMatchCount) return;
    setActiveSearchMatch(current => (current + direction + searchMatchCount) % searchMatchCount);
  };

  const submitSearch = (direction: 1 | -1 = 1) => {
    const nextQuery = searchQuery.trim();
    if (nextQuery.toLocaleLowerCase("ko") !== submittedSearchQuery.trim().toLocaleLowerCase("ko")) {
      setActiveSearchMatch(0);
      setSubmittedSearchQuery(nextQuery);
      return;
    }
    moveSearchMatch(direction);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderParagraph = (paragraph: string, paragraphIndex: number): ReactNode => {
    const ranges = searchRanges[paragraphIndex];
    if (!ranges?.length) return paragraph;

    const nodes: ReactNode[] = [];
    let cursor = 0;
    ranges.forEach(range => {
      if (range.start > cursor) nodes.push(paragraph.slice(cursor, range.start));
      nodes.push(
        <mark
          className={`${styles.searchMatch} ${range.globalIndex === activeSearchMatch ? styles.searchMatchActive : ""}`}
          key={`${paragraphIndex}-${range.start}`}
          ref={element => { searchMatchRefs.current[range.globalIndex] = element; }}
        >
          {paragraph.slice(range.start, range.end)}
        </mark>,
      );
      cursor = range.end;
    });
    if (cursor < paragraph.length) nodes.push(paragraph.slice(cursor));
    return nodes;
  };

  const goToChapter = (chapter: SnsdChapter) => {
    setCurrentParagraph(chapter.paragraph);
    setChaptersOpen(false);
    requestAnimationFrame(() => {
      const paragraph = paragraphRefs.current[chapter.paragraph];
      if (!paragraph || chapter.charOffset === undefined) {
        paragraph?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let remaining = chapter.charOffset;
      let textNode = walker.nextNode();
      while (textNode && remaining > (textNode.textContent?.length ?? 0)) {
        remaining -= textNode.textContent?.length ?? 0;
        textNode = walker.nextNode();
      }
      if (!textNode) {
        paragraph.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const range = document.createRange();
      range.setStart(textNode, Math.min(remaining, textNode.textContent?.length ?? 0));
      range.collapse(true);
      window.scrollTo({ top: window.scrollY + range.getBoundingClientRect().top - 12, behavior: "smooth" });
    });
  };

  const openChapterList = () => {
    if (chapters === null) setChapters(detectSnsdChapters(paragraphs));
    const readingLine = window.innerHeight * 0.28;
    let visibleParagraph = 0;
    paragraphRefs.current.forEach((element, index) => {
      if (element && element.getBoundingClientRect().top <= readingLine) visibleParagraph = index;
    });
    setCurrentParagraph(visibleParagraph);
    setChaptersOpen(true);
    setSearchOpen(false);
    setFontSizeOpen(false);
  };

  const displayedChapters = useMemo(() => {
    const automatic = chapters ?? [];
    const manualParagraphIndexes = new Set(manualChapters.map(chapter => chapter.paragraph_index));
    const combined = [
      ...automatic.filter(chapter => !manualParagraphIndexes.has(chapter.paragraph)),
      ...manualChapters.map(chapter => ({
        id: `manual-${chapter.id}`,
        label: chapter.title,
        paragraph: chapter.paragraph_index,
        charOffset: chapter.char_offset,
        manualChapterId: chapter.id,
        canManage: Boolean(chapter.can_manage),
      })),
    ];
    return combined.sort((first, second) => first.paragraph - second.paragraph
      || (first.charOffset ?? 0) - (second.charOffset ?? 0));
  }, [chapters, manualChapters]);
  const chapterPartCount = new Set(displayedChapters.map(chapter => chapter.part).filter((part): part is number => part !== undefined)).size;

  const startChapterEditMode = () => {
    setChaptersOpen(false);
    setChapterEditMode(true);
    setChapterMessage("");
  };

  const addSelectedChapter = async () => {
    if (!id || !chapterSelection?.title.trim() || chapterSaving) return;
    setChapterSaving(true);
    try {
      const chapter = await createSnsdManualChapter(id, {
        title: chapterSelection.title.trim(),
        paragraph_index: chapterSelection.paragraph,
        char_offset: chapterSelection.charOffset,
        anchor_text: chapterSelection.anchorText,
      });
      setManualChapters(current => [...current, chapter]);
      setChapterSelection(null);
      window.getSelection()?.removeAllRanges();
      setChapterMessage("공용 목차에 추가했어요.");
    } catch (requestError) {
      setChapterMessage(requestError instanceof Error ? requestError.message : "목차를 추가하지 못했습니다.");
    } finally {
      setChapterSaving(false);
    }
  };

  const saveChapterTitle = async (chapterId: number) => {
    if (!id || !editingChapterTitle.trim()) return;
    try {
      await updateSnsdManualChapter(id, chapterId, editingChapterTitle.trim());
      setManualChapters(current => current.map(chapter => chapter.id === chapterId ? { ...chapter, title: editingChapterTitle.trim() } : chapter));
      setEditingChapterId(null);
      setChapterMessage("목차를 수정했어요.");
    } catch (requestError) {
      setChapterMessage(requestError instanceof Error ? requestError.message : "목차를 수정하지 못했습니다.");
    }
  };

  const removeChapter = async (chapterId: number) => {
    if (!id || !window.confirm("이 공용 목차 항목을 삭제할까요?")) return;
    try {
      await deleteSnsdManualChapter(id, chapterId);
      setManualChapters(current => current.filter(chapter => chapter.id !== chapterId));
      setChapterMessage("목차를 삭제했어요.");
    } catch (requestError) {
      setChapterMessage(requestError instanceof Error ? requestError.message : "목차를 삭제하지 못했습니다.");
    }
  };

  const returnToList = () => {
    const openedFromList = new URLSearchParams(window.location.search).get("from") === "list";
    if (openedFromList) {
      window.close();
      window.setTimeout(() => {
        if (!window.closed) window.location.replace("/snsd");
      }, 150);
      return;
    }
    window.location.assign("/snsd");
  };

  return (
    <div className={styles.page} data-page="snsd-viewer">
      <header
        className={`${styles.header} ${headerHidden ? styles.headerHidden : ""}`}
        onClick={event => {
          const target = event.target as HTMLElement;
          if (!target.closest("button, a, input, textarea, [role='button']")) scrollToTop();
        }}
      >
        <button className={styles.backLink} type="button" onClick={returnToList}>← 목록</button>
        <div className={styles.workMeta}>
          <div className={styles.workTitleRow}>
            <strong>{work?.title}</strong>
          </div>
          {work && <span>{work.author} · {work.pairing}</span>}
        </div>
        <div className={styles.headerActions}>
          <div className={styles.controlWrapper} data-viewer-popover>
            <button className={styles.iconButton} type="button" onClick={() => { setSearchOpen(current => !current); setFontSizeOpen(false); }} aria-label="본문 검색" aria-expanded={searchOpen}><SearchIcon /></button>
            {searchOpen && (
              <div className={`${styles.popover} ${styles.searchPopover}`} role="search">
                <div className={styles.searchField}>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    onBlur={() => { if (searchPending) submitSearch(); }}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitSearch(event.shiftKey ? -1 : 1);
                      }
                    }}
                    placeholder="본문 검색"
                    aria-label="본문 검색"
                  />
                  <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); setSubmittedSearchQuery(""); }} aria-label="검색 닫기">×</button>
                </div>
                <div className={styles.searchFooter}>
                  <span>{searchQuery.trim() ? (searchPending ? "Enter로 검색" : searchMatchCount ? `${activeSearchMatch + 1} / ${searchMatchCount}` : "검색 결과 없음") : "검색어를 입력하세요"}</span>
                  <div className={styles.searchNavigation}>
                    <button type="button" onClick={() => moveSearchMatch(-1)} disabled={!searchMatchCount} aria-label="이전 검색 결과">↑</button>
                    <button type="button" onClick={() => moveSearchMatch(1)} disabled={!searchMatchCount} aria-label="다음 검색 결과">↓</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={styles.controlWrapper} data-viewer-popover>
            <button className={styles.iconButton} type="button" onClick={() => { setFontSizeOpen(current => !current); setSearchOpen(false); }} aria-label="글자 크기 조절" aria-expanded={fontSizeOpen}><TextSizeIcon /></button>
            {fontSizeOpen && (
              <div className={`${styles.popover} ${styles.fontPopover}`} role="dialog" aria-label="글자 크기 조절">
                <span>글자 크기</span>
                <div className={styles.fontAdjuster}>
                  <button type="button" onClick={() => changeFontSize(fontSize - 1)} disabled={fontSize <= 14} aria-label="글자 작게">−</button>
                  <output>{fontSize}px</output>
                  <button type="button" onClick={() => changeFontSize(fontSize + 1)} disabled={fontSize >= 24} aria-label="글자 크게">＋</button>
                </div>
              </div>
            )}
          </div>
          <div className={styles.controlWrapper}>
            <button className={styles.iconButton} type="button" onClick={openChapterList} aria-label="목차 열기" aria-expanded={chaptersOpen}><MenuIcon /></button>
          </div>
        </div>
      </header>
      {offlineRead && <div className={styles.offlineBanner} role="status">오프라인 저장본으로 읽는 중</div>}
      <main className={styles.reader}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!error && <article ref={readerArticleRef} style={{ fontSize }}>
          {content && paragraphs.map((paragraph, index) => <p className={styles.paragraph} ref={element => { paragraphRefs.current[index] = element; }} key={index}>{renderParagraph(paragraph, index)}</p>)}
        </article>}
      </main>
      {chaptersOpen && (
        <div className={styles.chapterOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setChaptersOpen(false); }}>
          <section className={styles.chapterSheet} role="dialog" aria-modal="true" aria-labelledby="chapter-title">
            <div className={styles.chapterSheetHeader}>
              <h2 id="chapter-title">{work?.title || "작품"}{chapters === null ? "" : ` · ${displayedChapters.length}${chapterPartCount > 1 ? ` · ${chapterPartCount}파트` : ""}`}</h2>
              <div className={styles.chapterHeaderActions}>
                <button type="button" onClick={() => setChaptersOpen(false)} aria-label="닫기">×</button>
              </div>
            </div>
            <div className={styles.chapterList}>
              {(chapters === null || (chapters.length === 0 && !manualChaptersLoaded)) && <p className={styles.emptyChapters}>목차를 준비 중입니다…</p>}
              {chapters?.length === 0 && manualChaptersLoaded && manualChapters.length === 0 && (
                <div className={styles.emptyChapters}>
                  <p>감지된 목차가 없습니다.</p>
                  <span>본문에서 제목을 선택해 공용 목차에 추가할 수 있어요.</span>
                  <button type="button" onClick={startChapterEditMode}>목차 추가하기</button>
                </div>
              )}
              {displayedChapters.map((chapter, index) => (
                <div key={chapter.id}>
                  {chapterPartCount > 1 && chapter.part && (index === 0 || chapter.part !== displayedChapters[index - 1]?.part) && (
                    <h3 className={styles.chapterPartTitle}>파트 {chapter.part}</h3>
                  )}
                  <div className={styles.chapterItem}>
                    {editingChapterId === chapter.manualChapterId ? (
                      <div className={styles.chapterInlineEdit}>
                        <input value={editingChapterTitle} maxLength={120} onChange={event => setEditingChapterTitle(event.target.value)} aria-label="목차 제목" />
                        <button type="button" onClick={() => chapter.manualChapterId && saveChapterTitle(chapter.manualChapterId)}>저장</button>
                        <button type="button" onClick={() => setEditingChapterId(null)}>취소</button>
                      </div>
                    ) : (
                    <button
                      className={`${styles.chapterLocation} ${chapter.paragraph < currentParagraph ? styles.chapterRead : ""}`}
                      type="button"
                      onClick={() => goToChapter(chapter)}
                      aria-label={`${chapter.label}${chapter.paragraph < currentParagraph ? ", 읽음" : ""}`}
                    ><strong>{index + 1}</strong><span>{chapter.label}</span></button>
                    )}
                    {chapter.manualChapterId && chapter.canManage && editingChapterId !== chapter.manualChapterId && (
                      <div className={styles.chapterManageButtons}>
                        <button type="button" onClick={() => { setEditingChapterId(chapter.manualChapterId ?? null); setEditingChapterTitle(chapter.label); }}>수정</button>
                        <button type="button" onClick={() => removeChapter(chapter.manualChapterId!)}>삭제</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {manualChapters.some(chapter => Boolean(chapter.is_owner)) && (
                <div className={styles.chapterAddMore}>
                  <span>내가 추가한 목차</span>
                  <button type="button" onClick={startChapterEditMode}>목차 더 추가하기</button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {chapterEditMode && (
        <div className={styles.chapterEditBar}>
          {chapterSelection ? (
            <>
              <input value={chapterSelection.title} maxLength={120} onChange={event => setChapterSelection(current => current ? { ...current, title: event.target.value } : current)} aria-label="추가할 목차 제목" />
              <button className={styles.chapterAddButton} type="button" onClick={addSelectedChapter} disabled={chapterSaving || !chapterSelection.title.trim()}>{chapterSaving ? "추가 중…" : "목차에 추가"}</button>
              <button className={styles.chapterCancelButton} type="button" onClick={() => { setChapterSelection(null); setChapterMessage(""); window.getSelection()?.removeAllRanges(); }}>취소</button>
            </>
          ) : <span className={styles.chapterEditHint}>본문에서 목차로 만들 제목을 선택하세요.</span>}
          {chapterMessage && <span className={styles.chapterEditMessage} role="status">{chapterMessage}</span>}
          <button className={styles.chapterDoneButton} type="button" onClick={() => { setChapterEditMode(false); setChapterSelection(null); setChapterMessage(""); window.getSelection()?.removeAllRanges(); }}>완료</button>
        </div>
      )}
    </div>
  );
}
