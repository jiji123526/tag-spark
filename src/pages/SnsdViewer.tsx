import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { readApiError, snsdApiUrl, SnsdWork } from "@/lib/snsd-api";
import styles from "./SnsdViewer.module.css";

export default function SnsdViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [work, setWork] = useState<SnsdWork | null>(null);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(() => Number(window.localStorage.getItem("snsd-reader-font-size")) || 17);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    Promise.all([
      fetch(snsdApiUrl(`/api/works/${id}`), { signal: controller.signal }),
      fetch(snsdApiUrl(`/api/works/${id}/content`), { signal: controller.signal }),
    ]).then(async ([workResponse, contentResponse]) => {
      if (!workResponse.ok) throw new Error(await readApiError(workResponse));
      if (!contentResponse.ok) throw new Error(await readApiError(contentResponse));
      setWork(await workResponse.json());
      setContent(await contentResponse.text());
    }).catch(requestError => {
      if (requestError?.name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "작품을 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const key = `snsd-reader-position-${id}`;
    const saved = Number(window.localStorage.getItem(key));
    if (saved > 0) requestAnimationFrame(() => window.scrollTo(0, saved));
    const save = () => window.localStorage.setItem(key, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [content, id]);

  const changeFontSize = (next: number) => {
    const clamped = Math.min(24, Math.max(14, next));
    setFontSize(clamped);
    window.localStorage.setItem("snsd-reader-font-size", String(clamped));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/snsd")}>← 목록</button>
        <div><strong>{work?.title ?? "불러오는 중…"}</strong>{work && <span>{work.author} · {work.pairing}</span>}</div>
        <div className={styles.fontControls}><button type="button" onClick={() => changeFontSize(fontSize - 1)} aria-label="글자 작게">가</button><button type="button" onClick={() => changeFontSize(fontSize + 1)} aria-label="글자 크게">가+</button></div>
      </header>
      <main className={styles.reader}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!error && <article style={{ fontSize }}>{content || "본문을 불러오는 중입니다…"}</article>}
      </main>
    </div>
  );
}
