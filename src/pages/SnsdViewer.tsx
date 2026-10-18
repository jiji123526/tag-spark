import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { cacheSnsdViewerWork, createSnsdManualChapter, deleteSnsdManualChapter, fetchSnsdManualChapters, fetchSnsdViewerContent, getCachedSnsdViewerWork, getSnsdReadProgress, markSnsdWorkRead, readApiError, saveSnsdReadProgress, SNSD_VIEWER_WORK_CACHE_PREFIX, snsdApiUrl, SnsdManualChapter, SnsdWork, updateSnsdManualChapter } from "@/lib/snsd-api";
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

type NameReplacementRule = {
  sourceFull: string;
  targetFull: string;
  sourceGiven: string;
  targetGiven: string;
  replaceGiven: boolean;
};

const NAME_REPLACEMENT_KEY_PREFIX = "snsd-name-replacements-";
const KOREAN_SURNAMES = [
  "남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방",
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍", "유", "고", "문", "양", "손", "배", "백", "허", "남", "심", "노", "하", "곽", "성", "차", "주", "우", "구", "민", "진", "지", "엄", "채", "원", "천", "방", "공", "현", "함", "변", "염", "도", "석", "설", "마", "길", "표", "팽", "피", "빈", "탁", "태", "국", "맹", "목", "범", "복", "상", "시", "어", "예", "온", "간", "경", "계", "단", "당", "봉", "사", "소", "순", "승", "영", "옹", "장곡", "청주", "초", "춘", "강전", "강씨", "강이", "견", "내", "뇌", "누", "돈", "동", "등", "라", "란", "뢰", "만", "모", "묵", "미", "번", "부", "삼", "서", "섭", "수", "승", "야", "연", "염", "영", "옥", "운", "위", "육", "은", "익", "인", "저", "종", "좌", "준", "증", "창", "평", "필", "학", "호", "화", "환", "흥",
].sort((a, b) => b.length - a.length);

const VARIABLE_PARTICLES: Record<string, "topic" | "subject" | "object" | "and" | "instrumental" | "vocative" | "with" | "copula"> = {
  "이라고": "copula", "라고": "copula", "이라서": "copula", "라서": "copula", "이라면": "copula", "라면": "copula", "이라도": "copula", "라도": "copula", "이든": "copula", "든": "copula",
  "이랑": "with", "랑": "with", "으로": "instrumental", "로": "instrumental", "은": "topic", "는": "topic", "이": "subject", "가": "subject", "을": "object", "를": "object", "과": "and", "와": "and", "아": "vocative", "야": "vocative",
};
const FIXED_PARTICLES = ["에게서", "한테서", "께서", "으로부터", "에게", "한테", "에서", "부터", "까지", "처럼", "보다", "만큼", "조차", "마저", "밖에", "에게는", "한테는", "에서도", "만", "도", "씨", "님", "의", "께", "씩"];
const PARTICLE_SUFFIXES = [...new Set([...Object.keys(VARIABLE_PARTICLES), ...FIXED_PARTICLES])].sort((a, b) => b.length - a.length);

function splitKoreanName(value: string) {
  const name = value.trim();
  const surname = KOREAN_SURNAMES.find(candidate => name.startsWith(candidate) && [...name].length > candidate.length) ?? [...name][0] ?? "";
  return { surname, given: [...name].slice([...surname].length).join("") };
}

function readNameReplacementRules(workId?: string) {
  if (!workId) return [] as NameReplacementRule[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${NAME_REPLACEMENT_KEY_PREFIX}${workId}`) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((rule): rule is NameReplacementRule =>
      Boolean(rule && typeof rule.sourceFull === "string" && typeof rule.targetFull === "string"
        && typeof rule.sourceGiven === "string" && typeof rule.targetGiven === "string" && typeof rule.replaceGiven === "boolean"),
    ) : [];
  } catch {
    return [];
  }
}

function hasHangulBatchim(value: string) {
  const last = [...value].at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const jongseong = code % 28;
  return { hasBatchim: jongseong !== 0, isRieul: jongseong === 8 };
}

function inflectParticle(particle: string, targetName: string) {
  const kind = VARIABLE_PARTICLES[particle];
  const ending = hasHangulBatchim(targetName);
  if (!kind || !ending) return particle;
  const withBatchim = ending.hasBatchim;
  switch (kind) {
    case "topic": return withBatchim ? "은" : "는";
    case "subject": return withBatchim ? "이" : "가";
    case "object": return withBatchim ? "을" : "를";
    case "and": return withBatchim ? "과" : "와";
    case "vocative": return withBatchim ? "아" : "야";
    case "with": return withBatchim ? "이랑" : "랑";
    case "instrumental": return withBatchim && !ending.isRieul ? "으로" : "로";
    case "copula": {
      const base = particle.replace(/^이/, "");
      return withBatchim ? `이${base}` : base;
    }
  }
}

function replaceReaderNames(text: string, rules: NameReplacementRule[]) {
  const aliases = rules.flatMap(rule => [
    { from: rule.sourceFull, to: rule.targetFull },
    ...(rule.replaceGiven && rule.sourceGiven && rule.targetGiven ? [{ from: rule.sourceGiven, to: rule.targetGiven }] : []),
  ]).filter(alias => alias.from && alias.to).sort((a, b) => b.from.length - a.from.length);
  if (!aliases.length) return text;

  const escapedAliases = aliases.map(alias => alias.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const escapedParticles = PARTICLE_SUFFIXES.map(particle => particle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escapedAliases.join("|")})(${escapedParticles.join("|")})?`, "gu");
  return text.replace(matcher, (match, alias: string, particle: string | undefined, offset: number, source: string) => {
    const before = source[offset - 1] ?? "";
    const after = source[offset + match.length] ?? "";
    if (/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(before)) return match;
    if (!particle && /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(after)) return match;
    const replacement = aliases.find(candidate => candidate.from === alias)?.to;
    if (!replacement) return match;
    return replacement + (particle ? inflectParticle(particle, replacement) : "");
  });
}

function wordTokenAt(text: string, offset: number) {
  const isWord = (character: string | undefined) => Boolean(character && /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(character));
  const chars = [...text];
  let cursor = Math.min(offset, chars.length - 1);
  if (!isWord(chars[cursor]) && isWord(chars[cursor - 1])) cursor -= 1;
  if (!isWord(chars[cursor])) return "";
  let start = cursor;
  let end = cursor + 1;
  while (start > 0 && isWord(chars[start - 1])) start -= 1;
  while (end < chars.length && isWord(chars[end])) end += 1;
  let token = chars.slice(start, end).join("");
  for (const particle of PARTICLE_SUFFIXES) {
    if (token.length > particle.length && token.endsWith(particle)) {
      token = [...token].slice(0, -[...particle].length).join("");
      break;
    }
  }
  return token;
}

function nameOccurrences(text: string, alias: string, limit = 3) {
  if (!alias) return [] as string[];
  const snippets: string[] = [];
  let cursor = 0;
  while (snippets.length < limit) {
    const index = text.indexOf(alias, cursor);
    if (index < 0) break;
    const before = text[index - 1] ?? "";
    const after = text[index + alias.length] ?? "";
    if (!/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(before)
      && (!after || !/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(after) || PARTICLE_SUFFIXES.some(particle => text.startsWith(particle, index + alias.length)))) {
      snippets.push(text.slice(Math.max(0, index - 18), Math.min(text.length, index + alias.length + 24)).replace(/\s+/g, " "));
    }
    cursor = index + alias.length;
  }
  return snippets;
}

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
  const [nameRules, setNameRules] = useState<NameReplacementRule[]>(() => readNameReplacementRules(id));
  const [nameRenameOpen, setNameRenameOpen] = useState(false);
  const [nameRenameDraft, setNameRenameDraft] = useState<NameReplacementRule>({ sourceFull: "", targetFull: "", sourceGiven: "", targetGiven: "", replaceGiven: true });
  const [editingNameRule, setEditingNameRule] = useState("");
  const [nameRenameError, setNameRenameError] = useState("");
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [chapters, setChapters] = useState<SnsdChapter[] | null>(null);
  const [manualChapters, setManualChapters] = useState<SnsdManualChapter[]>([]);
  const [manualChaptersLoaded, setManualChaptersLoaded] = useState(false);
  const [chapterEditMode, setChapterEditMode] = useState(false);
  const [chapterBeingEdited, setChapterBeingEdited] = useState<SnsdChapter | null>(null);
  const [chapterManagementMode, setChapterManagementMode] = useState(false);
  const [chapterSelection, setChapterSelection] = useState<{ paragraph: number; charOffset: number; anchorText: string; title: string } | null>(null);
  const [chapterSaving, setChapterSaving] = useState(false);
  const [chaptersAddedInSession, setChaptersAddedInSession] = useState(0);
  const [chapterMessage, setChapterMessage] = useState("");
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renamePressRef = useRef<{ timer: number; x: number; y: number; pointerId: number } | null>(null);
  const renameDidTriggerRef = useRef(false);
  const readerArticleRef = useRef<HTMLElement>(null);
  const searchMatchRefs = useRef<Array<HTMLElement | null>>([]);
  const paragraphs = useMemo(() => content ? content.split(/\r?\n\s*\r?\n/) : [], [content]);
  const displayParagraphs = useMemo(() => chapterEditMode
    ? paragraphs
    : paragraphs.map(paragraph => replaceReaderNames(paragraph, nameRules)), [chapterEditMode, nameRules, paragraphs]);
  const normalizedParagraphs = useMemo(() => displayParagraphs.map(paragraph => paragraph.toLocaleLowerCase("ko")), [displayParagraphs]);
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

  useEffect(() => setNameRules(readNameReplacementRules(id)), [id]);

  useEffect(() => {
    if (!nameRenameOpen) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNameRenameOpen(false);
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [nameRenameOpen]);

  useEffect(() => () => {
    if (renamePressRef.current) window.clearTimeout(renamePressRef.current.timer);
  }, []);
  const searchMatchCount = searchRanges.reduce((count, ranges) => count + ranges.length, 0);
  const searchPending = searchQuery.trim().toLocaleLowerCase("ko") !== submittedSearchQuery.trim().toLocaleLowerCase("ko");

  useEffect(() => {
    setChapters(null);
  }, [content]);

  useEffect(() => {
    if (!id) return;
    const syncUpdatedWork = (event: StorageEvent) => {
      if (event.key !== `${SNSD_VIEWER_WORK_CACHE_PREFIX}${id}`) return;
      const updatedWork = getCachedSnsdViewerWork(id);
      if (updatedWork) setWork(updatedWork);
    };
    window.addEventListener("storage", syncUpdatedWork);
    return () => window.removeEventListener("storage", syncUpdatedWork);
  }, [id]);

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

  const openNameRenameAtPoint = (x: number, y: number) => {
    if (!id || chapterEditMode || !readerArticleRef.current) return;
    const pointDocument = document as Document & {
      caretRangeFromPoint?: (clientX: number, clientY: number) => Range | null;
      caretPositionFromPoint?: (clientX: number, clientY: number) => { offsetNode: Node; offset: number } | null;
    };
    let range = pointDocument.caretRangeFromPoint?.(x, y) ?? null;
    if (!range) {
      const position = pointDocument.caretPositionFromPoint?.(x, y);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    if (!range || !readerArticleRef.current.contains(range.startContainer)) return;
    const paragraph = (range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as HTMLElement
      : range.startContainer.parentElement)?.closest("p");
    if (!paragraph) return;
    const prefix = document.createRange();
    prefix.selectNodeContents(paragraph);
    prefix.setEnd(range.startContainer, range.startOffset);
    const token = wordTokenAt(paragraph.textContent ?? "", [...prefix.toString()].length);
    if (!token) return;

    const existing = nameRules.find(rule => [rule.sourceFull, rule.sourceGiven, rule.targetFull, rule.targetGiven].includes(token));
    const name = existing?.sourceFull ?? token;
    const sourceParts = splitKoreanName(name);
    const targetParts = splitKoreanName(existing?.targetFull ?? "");
    setEditingNameRule(existing?.sourceFull ?? "");
    setNameRenameDraft(existing ?? {
      sourceFull: name,
      targetFull: "",
      sourceGiven: sourceParts.given,
      targetGiven: targetParts.given,
      replaceGiven: Boolean(sourceParts.given),
    });
    setNameRenameError("");
    setSearchOpen(false);
    setFontSizeOpen(false);
    setNameRenameOpen(true);
  };

  const cancelNameRenamePress = () => {
    if (renamePressRef.current) window.clearTimeout(renamePressRef.current.timer);
    renamePressRef.current = null;
  };

  const handleNameRenamePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (chapterEditMode || chaptersOpen || nameRenameOpen || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea, [role='button']")) return;
    cancelNameRenamePress();
    renameDidTriggerRef.current = false;
    const { clientX: x, clientY: y, pointerId } = event;
    const timer = window.setTimeout(() => {
      renameDidTriggerRef.current = true;
      openNameRenameAtPoint(x, y);
    }, 520);
    renamePressRef.current = { timer, x, y, pointerId };
  };

  const handleNameRenamePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const press = renamePressRef.current;
    if (press && press.pointerId === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) cancelNameRenamePress();
  };

  const handleNameRenameContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (chapterEditMode || chaptersOpen || nameRenameOpen) return;
    event.preventDefault();
    if (!renameDidTriggerRef.current) openNameRenameAtPoint(event.clientX, event.clientY);
    renameDidTriggerRef.current = false;
  };

  const saveNameRename = () => {
    if (!id) return;
    const rule: NameReplacementRule = {
      sourceFull: nameRenameDraft.sourceFull.trim(),
      targetFull: nameRenameDraft.targetFull.trim(),
      sourceGiven: nameRenameDraft.sourceGiven.trim(),
      targetGiven: nameRenameDraft.targetGiven.trim(),
      replaceGiven: nameRenameDraft.replaceGiven && Boolean(nameRenameDraft.sourceGiven.trim() && nameRenameDraft.targetGiven.trim()),
    };
    if (!rule.sourceFull || !rule.targetFull) {
      setNameRenameError("바꿀 이름을 모두 입력해주세요.");
      return;
    }
    const hasGivenNameConflict = rule.replaceGiven && nameRules.some(existing => existing.sourceGiven === rule.sourceGiven
      && existing.sourceFull !== editingNameRule && existing.targetGiven !== rule.targetGiven && existing.replaceGiven);
    if (hasGivenNameConflict) {
      setNameRenameError("이 이름만 표기는 다른 인물의 치환과 겹쳐요. 이름만 치환을 끄거나 기존 규칙을 먼저 수정해주세요.");
      return;
    }
    const next = [...nameRules.filter(existing => existing.sourceFull !== editingNameRule && existing.sourceFull !== rule.sourceFull), rule];
    try {
      window.localStorage.setItem(`${NAME_REPLACEMENT_KEY_PREFIX}${id}`, JSON.stringify(next));
      setNameRules(next);
      setNameRenameOpen(false);
      setEditingNameRule("");
      setNameRenameError("");
    } catch {
      setNameRenameError("이 기기에 설정을 저장하지 못했어요.");
    }
  };

  const deleteNameRename = () => {
    if (!id || !editingNameRule) return;
    const next = nameRules.filter(rule => rule.sourceFull !== editingNameRule);
    try {
      window.localStorage.setItem(`${NAME_REPLACEMENT_KEY_PREFIX}${id}`, JSON.stringify(next));
      setNameRules(next);
      setNameRenameOpen(false);
      setEditingNameRule("");
      setNameRenameError("");
    } catch {
      setNameRenameError("이 기기에서 치환을 해제하지 못했어요.");
    }
  };

  const closeNameRename = () => {
    setNameRenameOpen(false);
    setEditingNameRule("");
    setNameRenameError("");
  };

  const sourceFullExamples = nameRenameOpen ? nameOccurrences(content, nameRenameDraft.sourceFull) : [];
  const sourceGivenExamples = nameRenameOpen && nameRenameDraft.replaceGiven && nameRenameDraft.sourceGiven !== nameRenameDraft.sourceFull
    ? nameOccurrences(content, nameRenameDraft.sourceGiven)
    : [];
  const hasGivenNameConflict = nameRenameDraft.replaceGiven && nameRules.some(rule => rule.sourceGiven === nameRenameDraft.sourceGiven
    && rule.sourceFull !== editingNameRule && rule.targetGiven !== nameRenameDraft.targetGiven && rule.replaceGiven);

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
    const replacedAutomaticLocations = new Set(manualChapters
      .filter(chapter => chapter.replaces_paragraph_index !== null && chapter.replaces_paragraph_index !== undefined)
      .map(chapter => `${chapter.replaces_paragraph_index}:${chapter.replaces_char_offset ?? 0}`));
    const combined = [
      ...automatic.filter(chapter => !manualParagraphIndexes.has(chapter.paragraph)
        && !replacedAutomaticLocations.has(`${chapter.paragraph}:${chapter.charOffset ?? 0}`)),
      ...manualChapters.map(chapter => ({
        id: `manual-${chapter.id}`,
        label: chapter.title,
        paragraph: chapter.paragraph_index,
        charOffset: chapter.char_offset,
        manualChapterId: chapter.id,
        canManage: Boolean(chapter.can_manage),
        replacesParagraphIndex: chapter.replaces_paragraph_index,
        replacesCharOffset: chapter.replaces_char_offset,
      })),
    ];
    return combined.sort((first, second) => first.paragraph - second.paragraph
      || (first.charOffset ?? 0) - (second.charOffset ?? 0));
  }, [chapters, manualChapters]);
  const chapterPartCount = new Set(displayedChapters.map(chapter => chapter.part).filter((part): part is number => part !== undefined)).size;

  const startChapterEditMode = () => {
    setChapterBeingEdited(null);
    setChaptersAddedInSession(0);
    setChaptersOpen(false);
    setChapterEditMode(true);
    setChapterMessage("");
  };

  const startChapterRelocation = (chapter: SnsdChapter) => {
    setChapterBeingEdited(chapter);
    setChapterSelection(null);
    setChapterMessage("");
    setChapterManagementMode(false);
    setChaptersOpen(false);
    setChapterEditMode(true);
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
      setChaptersAddedInSession(count => count + 1);
      setChapterSelection(null);
      window.getSelection()?.removeAllRanges();
      setChapterMessage("");
    } catch (requestError) {
      setChapterMessage(requestError instanceof Error ? requestError.message : "목차를 추가하지 못했습니다.");
    } finally {
      setChapterSaving(false);
    }
  };

  const saveChapterTitle = async (chapter: SnsdChapter) => {
    if (!id || !chapterBeingEdited || !chapterSelection || !chapterSelection.title.trim() || chapterSaving) return;
    setChapterSaving(true);
    const title = chapterSelection.title.trim();
    const location = {
      title,
      paragraph_index: chapterSelection.paragraph,
      char_offset: chapterSelection.charOffset,
      anchor_text: chapterSelection.anchorText,
    };
    try {
      if (chapter.manualChapterId) {
        const replacesParagraphIndex = chapter.replacesParagraphIndex ?? chapter.paragraph;
        const replacesCharOffset = chapter.replacesCharOffset ?? chapter.charOffset ?? 0;
        await updateSnsdManualChapter(id, chapter.manualChapterId, {
          ...location,
          replaces_paragraph_index: replacesParagraphIndex,
          replaces_char_offset: replacesCharOffset,
        });
        setManualChapters(current => current.map(item => item.id === chapter.manualChapterId ? {
          ...item,
          title,
          paragraph_index: location.paragraph_index,
          char_offset: location.char_offset,
          anchor_text: location.anchor_text,
          replaces_paragraph_index: replacesParagraphIndex,
          replaces_char_offset: replacesCharOffset,
        } : item));
      } else {
        const created = await createSnsdManualChapter(id, {
          ...location,
          replaces_paragraph_index: chapter.paragraph,
          replaces_char_offset: chapter.charOffset ?? 0,
        });
        setManualChapters(current => [...current, created]);
      }
      setChapterSelection(null);
      setChapterBeingEdited(null);
      setChapterEditMode(false);
      setChaptersOpen(true);
      setChapterMessage("목차 제목과 위치를 수정했어요.");
    } catch (requestError) {
      setChapterMessage(requestError instanceof Error ? requestError.message : "목차를 수정하지 못했습니다.");
    } finally {
      setChapterSaving(false);
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
        {!error && <article
          ref={readerArticleRef}
          style={{ fontSize }}
          onPointerDown={handleNameRenamePointerDown}
          onPointerMove={handleNameRenamePointerMove}
          onPointerUp={cancelNameRenamePress}
          onPointerCancel={cancelNameRenamePress}
          onContextMenu={handleNameRenameContextMenu}
        >
          {content && displayParagraphs.map((paragraph, index) => <p className={styles.paragraph} ref={element => { paragraphRefs.current[index] = element; }} key={index}>{renderParagraph(paragraph, index)}</p>)}
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
                    <button
                      className={`${styles.chapterLocation} ${chapter.paragraph < currentParagraph ? styles.chapterRead : ""}`}
                      type="button"
                      onClick={() => goToChapter(chapter)}
                      aria-label={`${chapter.label}${chapter.paragraph < currentParagraph ? ", 읽음" : ""}`}
                    ><strong>{index + 1}</strong><span>{chapter.label}</span></button>
                    {chapterManagementMode && (!chapter.manualChapterId || chapter.canManage) && (
                      <div className={styles.chapterManageButtons}>
                        <button type="button" onClick={() => startChapterRelocation(chapter)}>수정</button>
                        {chapter.manualChapterId && chapter.canManage && <button type="button" onClick={() => removeChapter(chapter.manualChapterId!)}>삭제</button>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chapterManagementMode && (
                <button className={styles.chapterAddAtEnd} type="button" onClick={startChapterEditMode}>＋ 장 추가</button>
              )}
            </div>
            <div className={styles.chapterFooter}>
              <button type="button" onClick={() => { setChapterManagementMode(mode => !mode); setChapterMessage(""); }}>{chapterManagementMode ? "수정 완료" : "목차 수정하기"}</button>
            </div>
          </section>
        </div>
      )}
      {chapterEditMode && (
        <div className={styles.chapterEditBar}>
          {chapterSelection ? (
            <>
              <input value={chapterSelection.title} maxLength={120} onChange={event => setChapterSelection(current => current ? { ...current, title: event.target.value } : current)} aria-label={chapterBeingEdited ? "수정할 목차 제목" : "추가할 목차 제목"} />
              <button className={styles.chapterAddButton} type="button" onClick={() => chapterBeingEdited ? void saveChapterTitle(chapterBeingEdited) : void addSelectedChapter()} disabled={chapterSaving || !chapterSelection.title.trim()}>{chapterSaving ? "저장 중…" : chapterBeingEdited ? "수정 완료" : "목차에 추가"}</button>
              <button className={styles.chapterCancelButton} type="button" onClick={() => { setChapterSelection(null); setChapterMessage(""); window.getSelection()?.removeAllRanges(); }}>다시 선택</button>
            </>
          ) : <span className={styles.chapterEditHint}>{chapterBeingEdited ? "본문에서 새 위치와 제목을 드래그해 선택하세요." : chaptersAddedInSession > 0 ? `${chaptersAddedInSession}개 추가됨 · 다음 제목을 선택하거나 완료를 누르세요.` : "본문에서 목차로 만들 제목을 선택하세요. 여러 장을 차례로 추가할 수 있어요."}</span>}
          {chapterMessage && <span className={styles.chapterEditMessage} role="status">{chapterMessage}</span>}
          <button className={styles.chapterDoneButton} type="button" onClick={() => { setChapterEditMode(false); setChapterSelection(null); setChapterBeingEdited(null); setChapterMessage(""); window.getSelection()?.removeAllRanges(); setChaptersOpen(true); }}>{chapterBeingEdited ? "취소" : "완료"}</button>
        </div>
      )}
      {nameRenameOpen && (
        <div className={styles.nameRenameOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeNameRename(); }}>
          <section className={styles.nameRenameDialog} role="dialog" aria-modal="true" aria-labelledby="name-rename-title">
            <header className={styles.nameRenameHeader}>
              <div>
                <h2 id="name-rename-title">이름 바꿔 읽기</h2>
                <p>이 작품의 본문에만 적용돼요.</p>
              </div>
              <button type="button" onClick={closeNameRename} aria-label="닫기">×</button>
            </header>
            <label className={styles.nameRenameField}>
              <span>원래 이름</span>
              <input autoFocus value={nameRenameDraft.sourceFull} maxLength={40} onChange={event => {
                const sourceFull = event.target.value;
                setNameRenameDraft(current => ({ ...current, sourceFull, sourceGiven: splitKoreanName(sourceFull).given }));
              }} />
            </label>
            <label className={styles.nameRenameField}>
              <span>바꿀 이름</span>
              <input value={nameRenameDraft.targetFull} maxLength={40} onChange={event => {
                const targetFull = event.target.value;
                setNameRenameDraft(current => ({ ...current, targetFull, targetGiven: splitKoreanName(targetFull).given }));
              }} />
            </label>
            <label className={styles.nameRenameToggle}>
              <input type="checkbox" checked={nameRenameDraft.replaceGiven} disabled={!nameRenameDraft.sourceGiven || !nameRenameDraft.targetGiven} onChange={event => setNameRenameDraft(current => ({ ...current, replaceGiven: event.target.checked }))} />
              <span>성 없이 이름만 쓰인 경우도 바꾸기</span>
            </label>
            {nameRenameDraft.sourceGiven && nameRenameDraft.targetGiven && (
              <div className={styles.nameRenameAliases}>
                <label><span>이름만</span><input value={nameRenameDraft.sourceGiven} maxLength={30} onChange={event => setNameRenameDraft(current => ({ ...current, sourceGiven: event.target.value }))} /></label>
                <span aria-hidden="true">→</span>
                <label><span className={styles.visuallyHidden}>바꿀 이름만</span><input value={nameRenameDraft.targetGiven} maxLength={30} onChange={event => setNameRenameDraft(current => ({ ...current, targetGiven: event.target.value }))} /></label>
              </div>
            )}
            <div className={styles.nameRenamePreview}>
              <strong>조사 미리보기</strong>
              {nameRenameDraft.targetFull ? (
                <span>{nameRenameDraft.sourceFull}{hasHangulBatchim(nameRenameDraft.sourceFull)?.hasBatchim ? "은" : "는"} → {replaceReaderNames(`${nameRenameDraft.sourceFull}${hasHangulBatchim(nameRenameDraft.sourceFull)?.hasBatchim ? "은" : "는"}`, [nameRenameDraft])}</span>
              ) : <span>바꿀 이름을 입력하면 확인할 수 있어요.</span>}
              {nameRenameDraft.replaceGiven && nameRenameDraft.sourceGiven && nameRenameDraft.targetGiven && (
                <span>{nameRenameDraft.sourceGiven}{hasHangulBatchim(nameRenameDraft.sourceGiven)?.hasBatchim ? "은" : "는"} → {replaceReaderNames(`${nameRenameDraft.sourceGiven}${hasHangulBatchim(nameRenameDraft.sourceGiven)?.hasBatchim ? "은" : "는"}`, [nameRenameDraft])}</span>
              )}
            </div>
            {nameRenameDraft.replaceGiven && nameRenameDraft.sourceGiven && (
              <div className={styles.nameRenameMatches}>
                <strong>이름만 나오는 문맥 미리보기</strong>
                {sourceGivenExamples.length
                  ? <ul>{sourceGivenExamples.map((snippet, index) => <li key={`${snippet}-${index}`}>…{snippet}…</li>)}</ul>
                  : <span>이름만 단독으로 쓰인 부분은 찾지 못했어요.</span>}
              </div>
            )}
            {hasGivenNameConflict && <p className={styles.nameRenameError} role="alert">이 이름만 표기는 다른 인물의 치환과 겹쳐요. 이름만 치환을 끄거나 기존 규칙을 먼저 수정해주세요.</p>}
            {nameRenameError && <p className={styles.nameRenameError} role="alert">{nameRenameError}</p>}
            <footer className={styles.nameRenameFooter}>
              {editingNameRule && <button className={styles.nameRenameDelete} type="button" onClick={deleteNameRename}>치환 해제</button>}
              <button type="button" onClick={closeNameRename}>취소</button>
              <button className={styles.nameRenameSave} type="button" onClick={saveNameRename} disabled={!nameRenameDraft.sourceFull.trim() || !nameRenameDraft.targetFull.trim() || hasGivenNameConflict}>적용</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
