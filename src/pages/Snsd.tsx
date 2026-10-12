import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getSnsdUserId,
  getSnsdReadHistory,
  cacheSnsdViewerWork,
  prefetchSnsdViewer,
  readApiError,
  SNSD_READ_HISTORY_KEY,
  snsdApiUrl,
  SnsdComment,
  SnsdWork,
} from "@/lib/snsd-api";
import styles from "./Snsd.module.css";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_URL = "https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png";
const COMPOSE_COLLAPSED_KEY = "snsd-compose-collapsed";

const HeartIcon = ({ filled = false }: { filled?: boolean }) => <svg aria-hidden="true" viewBox="0 0 24 24"><path d={filled ? "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Z" : "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Zm.52-12.625a.205.205 0 0 1-.04-.043l-.695-.78-.003-.005A3.85 3.85 0 0 0 3.875 9.23v.13c0 1.113.465 2.18 1.281 2.937L12 18.651l6.844-6.355a4.012 4.012 0 0 0 1.281-2.937v-.13a3.851 3.851 0 0 0-6.723-2.566l-.004.004-.003.004-.696.781c-.011.016-.027.028-.039.043a.935.935 0 0 1-1.32 0v-.004Z"} fill="currentColor" /></svg>;
const CommentIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.832 17.535a1.877 1.877 0 0 1 1.742-.25c1.035.375 2.194.59 3.428.59 4.87 0 8.123-3.145 8.123-6.25s-3.253-6.25-8.123-6.25c-4.87 0-8.122 3.145-8.122 6.25 0 1.25.484 2.453 1.394 3.484.336.38.5.88.46 1.387a6.92 6.92 0 0 1-.44 1.93 9.811 9.811 0 0 0 1.538-.887v-.004Zm-3.999 1.586c.07-.105.137-.21.2-.316.39-.649.76-1.5.835-2.457-1.172-1.332-1.863-2.961-1.863-4.723 0-4.488 4.475-8.125 9.997-8.125C17.526 3.5 22 7.137 22 11.625c0 4.488-4.475 8.125-9.998 8.125-1.448 0-2.823-.25-4.065-.7-.465.34-1.222.805-2.12 1.196a9.564 9.564 0 0 1-1.957.629c-.031.008-.062.012-.094.02-.171.03-.34.058-.515.074-.008 0-.02.004-.027.004-.2.02-.399.03-.598.03a.625.625 0 0 1-.445-1.066 5.606 5.606 0 0 0 .629-.797l.011-.019h.012Z" fill="currentColor" /></svg>;
const BookmarkIcon = ({ filled = false }: { filled?: boolean }) => <svg aria-hidden="true" viewBox="0 0 24 24"><path d={filled ? "M4.5 4.875C4.5 3.84 5.34 3 6.375 3h11.25c1.035 0 1.875.84 1.875 1.875v16.188a.938.938 0 0 1-1.48.762L12 17.526l-6.02 4.297a.938.938 0 0 1-1.48-.762V4.875Z" : "M4.5 4.875C4.5 3.84 5.34 3 6.375 3v16.242l5.082-3.629a.93.93 0 0 1 1.09 0l5.078 3.63V4.874H6.375V3h11.25c1.035 0 1.875.84 1.875 1.875v16.188a.938.938 0 0 1-1.48.762L12 17.526l-6.02 4.297a.938.938 0 0 1-1.48-.762z"} fill="currentColor" /></svg>;
const ShareIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12.664 2.275a.934.934 0 0 0-1.324 0l-5.004 5A.937.937 0 0 0 7.66 8.6l3.399-3.398v9.614c0 .519.418.937.937.937.52 0 .938-.418.938-.938V5.202L16.332 8.6a.937.937 0 0 0 1.324-1.324l-4.992-5ZM5.125 15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124a3.438 3.438 0 0 0 3.438 3.438h10.625a3.438 3.438 0 0 0 3.437-3.438V15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124c0 .864-.7 1.563-1.563 1.563H6.688c-.863 0-1.562-.7-1.562-1.563V15.44Z" fill="currentColor" /></svg>;
const MoreIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.125 12a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-6.25 0a1.875 1.875 0 1 1-3.751 0 1.875 1.875 0 0 1 3.751 0ZM5.75 13.875a1.875 1.875 0 1 1 0-3.75 1.875 1.875 0 0 1 0 3.75Z" fill="currentColor" /></svg>;
const SearchIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20.7 19.3-4.2-4.2a7.5 7.5 0 1 0-1.4 1.4l4.2 4.2a1 1 0 0 0 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" fill="currentColor" /></svg>;
const DownloadIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M11 3a1 1 0 1 1 2 0v10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V3Zm-7 13a1 1 0 0 1 1 1v2h14v-2a1 1 0 1 1 2 0v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1Z" fill="currentColor" /></svg>;

function relativeDate(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function validateTextFile(file: File) {
  const isText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
  if (!isText) return "TXT 파일만 업로드할 수 있습니다.";
  if (file.size > MAX_FILE_SIZE) return "파일은 최대 5MB까지 업로드할 수 있습니다.";
  if (file.size === 0) return "빈 파일은 업로드할 수 없습니다.";
  return "";
}

function pairingTags(value: string) {
  return value
    .split(/[,，#]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function downloadFilename(work: SnsdWork) {
  const safePart = (value: string) => value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  const pairing = safePart(work.pairing) || "씨피 미상";
  const title = safePart(work.title.replace(/\.txt$/i, "")) || "제목 없음";
  const author = safePart(work.author) || "작가 미상";
  return `[${pairing}] ${title} w.${author}.txt`;
}

export default function Snsd() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commentRequestsRef = useRef<Map<number, Promise<SnsdComment[]>>>(new Map());
  const [works, setWorks] = useState<SnsdWork[]>([]);
  const [sort, setSort] = useState<"top" | "new" | "bookmarked" | "archive">("new");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(() => window.localStorage.getItem(COMPOSE_COLLAPSED_KEY) !== "true");
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pairing, setPairing] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, SnsdComment[]>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [toast, setToast] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [editing, setEditing] = useState<SnsdWork | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", author: "", pairing: "", reason: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [readHistory, setReadHistory] = useState<Record<string, number>>(() => getSnsdReadHistory());
  const [bookmarked, setBookmarked] = useState<Set<number>>(() => {
    const stored = window.localStorage.getItem("snsd-bookmarked-ids");
    try { return new Set(stored ? JSON.parse(stored) : []); } catch { return new Set(); }
  });
  const [voted, setVoted] = useState<Set<number>>(() => {
    const stored = window.localStorage.getItem("snsd-voted-ids");
    try { return new Set(stored ? JSON.parse(stored) : []); } catch { return new Set(); }
  });

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const viewer = encodeURIComponent(getSnsdUserId());
      const response = await fetch(snsdApiUrl(`/api/works?viewer=${viewer}`));
      if (!response.ok) throw new Error(await readApiError(response));
      setWorks(await response.json());
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchComments = useCallback((workId: number) => {
    const pending = commentRequestsRef.current.get(workId);
    if (pending) return pending;
    const request = (async () => {
      const response = await fetch(snsdApiUrl(`/api/works/${workId}/comments`));
      if (!response.ok) throw new Error(await readApiError(response));
      const loaded = await response.json() as SnsdComment[];
      setComments(current => ({ ...current, [workId]: loaded }));
      return loaded;
    })();
    commentRequestsRef.current.set(workId, request);
    void request.finally(() => commentRequestsRef.current.delete(workId)).catch(() => undefined);
    return request;
  }, []);

  useEffect(() => { void loadWorks(); }, [loadWorks]);

  useEffect(() => {
    const refreshReadHistory = () => setReadHistory(getSnsdReadHistory());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SNSD_READ_HISTORY_KEY) refreshReadHistory();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshReadHistory);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshReadHistory);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchOpen]);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  const visibleWorks = useMemo(() => {
    if (searchOpen) {
      const query = searchQuery.trim().toLocaleLowerCase("ko");
      if (!query) return works;
      return works.filter(work => [work.title, work.author, work.pairing]
        .some(value => value.toLocaleLowerCase("ko").includes(query)));
    }
    if (sort === "bookmarked") return works.filter(work => bookmarked.has(work.id));
    if (sort === "archive") {
      return works
        .filter(work => readHistory[String(work.id)])
        .sort((a, b) => readHistory[String(b.id)] - readHistory[String(a.id)]);
    }
    const sorted = [...works];
    if (sort === "new") {
      return sorted.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    }
    return sorted.sort((a, b) => b.score - a.score || Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [bookmarked, readHistory, searchOpen, searchQuery, sort, works]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const toggleCompose = () => {
    setComposeOpen(open => {
      if (open) window.localStorage.setItem(COMPOSE_COLLAPSED_KEY, "true");
      return !open;
    });
  };

  const searchPairing = (tag: string) => {
    setSearchQuery(tag);
    setSearchOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseFile = (nextFile?: File) => {
    if (!nextFile) return;
    const validationError = validateTextFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(nextFile);
    setError("");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !author.trim() || !pairing.trim() || !file) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    const body = new FormData();
    body.set("title", title.trim());
    body.set("author", author.trim());
    body.set("pairing", pairing.trim());
    body.set("reason", reason.trim());
    body.set("createdBy", getSnsdUserId());
    body.set("file", file);
    try {
      const response = await fetch(snsdApiUrl("/api/works"), { method: "POST", body });
      if (!response.ok) throw new Error(await readApiError(response));
      setTitle(""); setAuthor(""); setPairing(""); setReason(""); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      window.localStorage.setItem(COMPOSE_COLLAPSED_KEY, "true");
      setComposeOpen(false);
      await loadWorks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "업로드하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVote = async (workId: number) => {
    const response = await fetch(snsdApiUrl(`/api/works/${workId}/vote`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voter: getSnsdUserId() }),
    });
    if (!response.ok) { setError(await readApiError(response)); return; }
    const result = await response.json();
    setWorks(current => current.map(work => work.id === workId ? { ...work, score: result.score } : work));
    setVoted(current => {
      const next = new Set(current);
      result.voted ? next.add(workId) : next.delete(workId);
      window.localStorage.setItem("snsd-voted-ids", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleComments = async (workId: number) => {
    if (openComments === workId) { setOpenComments(null); return; }
    setOpenComments(workId);
    if (comments[workId]) return;
    const work = works.find(candidate => candidate.id === workId);
    if (!work?.comment_count) {
      setComments(current => ({ ...current, [workId]: [] }));
      return;
    }
    try {
      await fetchComments(workId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "댓글을 불러오지 못했습니다.");
    }
  };

  const submitComment = async (workId: number) => {
    const content = commentText[workId]?.trim();
    if (!content) return;
    const response = await fetch(snsdApiUrl(`/api/works/${workId}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "익명", content }),
    });
    if (!response.ok) { setError(await readApiError(response)); return; }
    const created = await response.json();
    setComments(current => ({ ...current, [workId]: [...(current[workId] ?? []), created] }));
    setCommentText(current => ({ ...current, [workId]: "" }));
    setWorks(current => current.map(work => work.id === workId
      ? { ...work, comment_count: work.comment_count + 1, preview_comment: work.preview_comment || created.content }
      : work));
  };

  const toggleBookmark = (workId: number) => {
    setBookmarked(current => {
      const next = new Set(current);
      next.has(workId) ? next.delete(workId) : next.add(workId);
      window.localStorage.setItem("snsd-bookmarked-ids", JSON.stringify([...next]));
      return next;
    });
  };

  const shareWork = async (workId: number) => {
    const url = `${window.location.origin}/snsd/view/${workId}`;
    await navigator.clipboard.writeText(url);
    setToast("링크가 복사되었습니다!");
    window.setTimeout(() => setToast(""), 2200);
  };

  const openWork = (work: SnsdWork) => {
    const url = `/snsd/view/${work.id}?from=list`;
    cacheSnsdViewerWork(work);
    const viewerWindow = window.open("", "_blank");

    if (!viewerWindow) {
      void prefetchSnsdViewer(work);
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    viewerWindow.opener = null;
    viewerWindow.document.title = "불러오는 중 · SNSDFF";
    viewerWindow.document.body.innerHTML = '<p style="margin:40px;font:16px system-ui,sans-serif">작품을 불러오는 중입니다…</p>';

    let navigated = false;
    const navigate = () => {
      if (navigated || viewerWindow.closed) return;
      navigated = true;
      viewerWindow.location.replace(url);
    };
    const fallbackTimer = window.setTimeout(navigate, 5000);
    void prefetchSnsdViewer(work).finally(() => {
      window.clearTimeout(fallbackTimer);
      navigate();
    });
  };

  const downloadUrl = (workId: number) => snsdApiUrl(`/api/works/${workId}/content?download=1`);

  const beginEdit = (work: SnsdWork) => {
    setOpenMenu(null);
    setEditing(work);
    setEditDraft({ title: work.title, author: work.author, pairing: work.pairing, reason: work.reason });
  };

  const saveEdit = async () => {
    if (!editing || !editDraft.title.trim() || !editDraft.author.trim() || !editDraft.pairing.trim()) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }
    setSavingEdit(true);
    const response = await fetch(snsdApiUrl(`/api/works/${editing.id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editDraft, createdBy: getSnsdUserId() }),
    });
    setSavingEdit(false);
    if (!response.ok) { setError(await readApiError(response)); return; }
    const updatedWork = { ...editing, ...editDraft };
    cacheSnsdViewerWork(updatedWork);
    setWorks(current => current.map(work => work.id === editing.id ? updatedWork : work));
    setEditing(null);
    setError("");
    setToast("수정되었습니다.");
    window.setTimeout(() => setToast(""), 2200);
  };

  const deleteWork = async (work: SnsdWork) => {
    setOpenMenu(null);
    if (!window.confirm(`‘${work.title}’ 작품을 삭제할까요?\n삭제한 작품과 TXT 파일은 복구할 수 없습니다.`)) return;
    const response = await fetch(snsdApiUrl(`/api/works/${work.id}`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdBy: getSnsdUserId() }),
    });
    if (!response.ok) { setError(await readApiError(response)); return; }
    setWorks(current => current.filter(candidate => candidate.id !== work.id));
    setBookmarked(current => {
      const next = new Set(current);
      next.delete(work.id);
      window.localStorage.setItem("snsd-bookmarked-ids", JSON.stringify([...next]));
      return next;
    });
    setToast("삭제되었습니다.");
    window.setTimeout(() => setToast(""), 2200);
  };

  return (
    <div className={styles.page} data-page="snsd-dashboard">
      <header className={styles.header}>
        <div className={styles.titleGroup}><h1>SNSDFF</h1><button className={styles.helpButton} type="button" onClick={() => setHelpOpen(true)}>사용법</button></div>
        <button className={styles.searchButton} type="button" aria-label="작품 검색" aria-expanded={searchOpen} onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}><SearchIcon /></button>
      </header>
      <main className={styles.main}>
        {searchOpen && (
          <div className={styles.searchPanel} role="search">
            <SearchIcon />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              onKeyDown={event => { if (event.key === "Escape") closeSearch(); }}
              placeholder="제목, 작가, 씨피 검색"
              aria-label="제목, 작가, 씨피 검색"
            />
            <button type="button" onClick={closeSearch} aria-label="검색 닫기">×</button>
          </div>
        )}
        {!searchOpen && <section className={`${styles.compose} ${composeOpen ? styles.composeOpen : ""}`}>
          <button className={styles.composeToggle} type="button" onClick={toggleCompose} aria-expanded={composeOpen}>
            <span>작품 추천</span><span className={styles.chevron}>{composeOpen ? "−" : "+"}</span>
          </button>
          {composeOpen && (
            <form className={styles.form} onSubmit={handleSubmit}>
              <input value={title} onChange={event => setTitle(event.target.value)} placeholder="제목" maxLength={120} />
              <input value={author} onChange={event => setAuthor(event.target.value)} placeholder="작가" maxLength={80} />
              <div
                className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""} ${file ? styles.dropzoneSelected : ""}`}
                onDragEnter={event => { event.preventDefault(); setDragging(true); }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
              >
                <input ref={fileInputRef} className={styles.fileInput} type="file" accept=".txt,text/plain" onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])} />
                <strong>{file ? file.name : "TXT 파일을 끌어다 놓으세요"}</strong>
                <span>{file ? `${(file.size / 1024).toFixed(1)}KB` : "또는 눌러서 파일 선택 · 최대 5MB"}</span>
              </div>
              <input value={pairing} onChange={event => setPairing(event.target.value)} placeholder="씨피 (여러 개면 쉼표로 구분)" maxLength={80} />
              <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="추천 이유 (선택)" rows={3} maxLength={1000} />
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={styles.submitButton} disabled={submitting} type="submit">{submitting ? "업로드 중…" : "제출"}</button>
            </form>
          )}
        </section>}

        {!searchOpen && !composeOpen && error && <p className={styles.error} role="alert">{error}</p>}
        {!searchOpen && <nav className={styles.sortBar} aria-label="작품 정렬">
          <button className={sort === "new" ? styles.active : ""} onClick={() => setSort("new")} type="button">최신순</button>
          <button className={sort === "top" ? styles.active : ""} onClick={() => setSort("top")} type="button">추천순</button>
          <button className={sort === "bookmarked" ? styles.active : ""} onClick={() => setSort("bookmarked")} type="button">북마크</button>
          <button className={sort === "archive" ? styles.active : ""} onClick={() => setSort("archive")} type="button">기록</button>
        </nav>}

        <section className={styles.list}>
          {!loading && visibleWorks.length === 0 && (
            <div className={styles.empty}>
              {searchOpen
                ? "검색 결과가 없습니다."
                : sort === "bookmarked"
                  ? <>저장한 작품이 없습니다.<br />작품 카드의 북마크 아이콘을 눌러보세요.</>
                  : sort === "archive"
                    ? <>읽은 작품이 없습니다.<br />작품 카드를 열면 여기에 저장됩니다.</>
                  : <>🥺<br />추천이 없습니다... 하나 하고 가세요</>}
            </div>
          )}
          {visibleWorks.map(work => (
            <article
              className={styles.card}
              key={work.id}
              role="link"
              tabIndex={0}
              aria-label={`${work.title} 작품 읽기`}
              onClick={event => {
                const target = event.target as HTMLElement;
                if (target.closest("button, a, input, textarea, label, [data-card-action]")) return;
                openWork(work);
              }}
              onKeyDown={event => {
                if (event.target === event.currentTarget && event.key === "Enter") openWork(work);
              }}
              onPointerEnter={() => { void prefetchSnsdViewer(work); }}
              onTouchStart={() => { void prefetchSnsdViewer(work); }}
            >
              <div className={styles.cardBody}>
                <div className={styles.postHeader}>
                  <div className={styles.postHeaderLeft}>
                    <div className={styles.postAvatar}><img src={AVATAR_URL} alt="" width="32" height="32" /></div>
                    <div className={styles.postHeaderInfo}><strong>{work.author}</strong><span>{relativeDate(work.created_at)} · 독서합시다</span></div>
                  </div>
                  {Boolean(work.is_owner) ? (
                    <div className={styles.moreWrapper}>
                      <button className={styles.moreButton} type="button" aria-label="더보기" aria-expanded={openMenu === work.id} onClick={() => setOpenMenu(current => current === work.id ? null : work.id)}><MoreIcon /></button>
                      {openMenu === work.id && (
                        <div className={styles.postDropdown}>
                          <button type="button" onClick={() => beginEdit(work)}>수정</button>
                          <button className={styles.deleteMenuItem} type="button" onClick={() => void deleteWork(work)}>삭제</button>
                          <a href={downloadUrl(work.id)} download={downloadFilename(work)} onClick={() => setOpenMenu(null)}>다운로드</a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <a className={styles.moreButton} href={downloadUrl(work.id)} download={downloadFilename(work)} aria-label={`${work.title} 다운로드`}><DownloadIcon /></a>
                  )}
                </div>
                <div className={styles.postContent}>
                  <a className={styles.workTitle} href={`/snsd/view/${work.id}?from=list`} target="_blank" rel="noopener noreferrer" onClick={event => { event.preventDefault(); openWork(work); }}>{work.title}</a>
                  <div className={styles.pairingTags} aria-label={`씨피: ${work.pairing}`}>
                    {pairingTags(work.pairing).map((tag, index) => <button className={styles.pairingTag} type="button" onClick={() => searchPairing(tag)} key={`${tag}-${index}`}>#{tag}</button>)}
                  </div>
                </div>
                <div className={styles.actions}>
                  <div className={styles.actionsLeft}>
                    <button className={`${styles.voteButton} ${voted.has(work.id) ? styles.voted : ""}`} onClick={() => void toggleVote(work.id)} type="button" aria-label="좋아요"><HeartIcon filled={voted.has(work.id)} /><span>{work.score}</span></button>
                    <button className={styles.commentButton} onPointerEnter={() => { if (work.comment_count > 0 && !comments[work.id]) void fetchComments(work.id).catch(() => undefined); }} onFocus={() => { if (work.comment_count > 0 && !comments[work.id]) void fetchComments(work.id).catch(() => undefined); }} onClick={() => void toggleComments(work.id)} type="button" aria-label="댓글"><CommentIcon /><span>{work.comment_count}</span></button>
                  </div>
                  <div className={styles.actionsRight}>
                    <button className={`${styles.iconButton} ${bookmarked.has(work.id) ? styles.bookmarked : ""}`} type="button" onClick={() => toggleBookmark(work.id)} aria-label="북마크"><BookmarkIcon filled={bookmarked.has(work.id)} /></button>
                    <button className={styles.iconButton} type="button" onClick={() => void shareWork(work.id)} aria-label="공유"><ShareIcon /></button>
                  </div>
                </div>
                {(work.reason || work.preview_comment) && (
                  <button className={styles.reason} type="button" onPointerEnter={() => { if (work.comment_count > 0 && !comments[work.id]) void fetchComments(work.id).catch(() => undefined); }} onFocus={() => { if (work.comment_count > 0 && !comments[work.id]) void fetchComments(work.id).catch(() => undefined); }} onClick={() => void toggleComments(work.id)}><img src={AVATAR_URL} alt="" width="24" height="24" /><span>{work.reason || work.preview_comment}</span></button>
                )}
                {openComments === work.id && (
                  <div className={styles.comments} data-card-action>
                    {(comments[work.id] ?? []).map(comment => (
                      <div className={styles.comment} key={comment.id}><img src={AVATAR_URL} alt="" className={styles.commentAvatar} /><div className={styles.commentBody}><div className={styles.commentHeader}><strong>{comment.author}</strong><span>{relativeDate(comment.created_at)}</span></div><p>{comment.content}</p></div></div>
                    ))}
                    <div className={styles.commentForm}>
                      <div className={styles.commentInputHeader}><img src={AVATAR_URL} alt="" /><span>익명</span></div>
                      <textarea value={commentText[work.id] ?? ""} onChange={event => setCommentText(current => ({ ...current, [work.id]: event.target.value }))} placeholder="공감할래말래" rows={1} />
                      <div className={styles.commentFormRow}><button type="button" onClick={() => void submitComment(work.id)}>등록</button></div>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      </main>
      {openMenu !== null && <button className={styles.menuBackdrop} type="button" aria-label="메뉴 닫기" onClick={() => setOpenMenu(null)} />}
      {helpOpen && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
          <div className={`${styles.modalBox} ${styles.helpModal}`} role="dialog" aria-modal="true" aria-labelledby="snsd-help-title">
            <div className={styles.modalHeader}><h2 id="snsd-help-title">SNSDFF 사용법</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label="닫기">×</button></div>
            <div className={styles.helpContent}>
              <p><strong>작품 추천</strong><span>제목·작가·TXT 파일·씨피를 입력해 올려주세요. 추천 이유는 선택입니다.</span></p>
              <p><strong>읽기와 검색</strong><span>카드를 누르면 뷰어가 열립니다. 돋보기나 씨피 태그로 작품을 검색할 수 있어요.</span></p>
              <p><strong>저장과 기록</strong><span>카드 북마크는 북마크 탭에, 읽은 작품은 최근 순서대로 기록 탭에 저장됩니다.</span></p>
              <p><strong>뷰어</strong><span>글자 크기를 조절하고 한 작품 안에 여러 읽기 위치를 북마크할 수 있습니다.</span></p>
              <p><strong>다운로드</strong><span>카드 우측 다운로드 아이콘 또는 작성자 점 메뉴에서 TXT 파일을 받을 수 있습니다.</span></p>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}>
          <div className={styles.modalBox} role="dialog" aria-modal="true" aria-labelledby="edit-work-title">
            <div className={styles.modalHeader}><h2 id="edit-work-title">게시글 수정</h2><button type="button" onClick={() => setEditing(null)} aria-label="닫기">×</button></div>
            <div className={styles.modalBody}>
              <label>제목<input value={editDraft.title} onChange={event => setEditDraft(current => ({ ...current, title: event.target.value }))} maxLength={120} /></label>
              <label>작가<input value={editDraft.author} onChange={event => setEditDraft(current => ({ ...current, author: event.target.value }))} maxLength={80} /></label>
              <label>씨피<input value={editDraft.pairing} onChange={event => setEditDraft(current => ({ ...current, pairing: event.target.value }))} maxLength={80} /></label>
              <label>추천 이유 (선택)<textarea value={editDraft.reason} onChange={event => setEditDraft(current => ({ ...current, reason: event.target.value }))} rows={3} maxLength={1000} /></label>
            </div>
            <div className={styles.modalFooter}><button type="button" className={styles.cancelButton} onClick={() => setEditing(null)}>취소</button><button type="button" className={styles.confirmButton} disabled={savingEdit} onClick={() => void saveEdit()}>{savingEdit ? "저장 중…" : "수정하기"}</button></div>
          </div>
        </div>
      )}
      <div className={`${styles.toast} ${toast ? styles.toastVisible : ""}`}>{toast}</div>
    </div>
  );
}
