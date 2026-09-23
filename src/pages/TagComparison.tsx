import { useEffect, useMemo, useState } from "react";
import styles from "./TagComparison.module.css";

type Axis = { id: number; key: string; label: string; prompt: string; high_label: string };
type AxisTag = { axis_id: number; id: number; name: string; category: string };
type Comparison = {
  id: number;
  axis_id: number;
  tag_a_id: number;
  tag_b_id: number;
  winner_tag_id: number | null;
  decision: "win" | "tie" | "skip";
  updated_at: string;
};
type ComparisonData = { axes: Axis[]; axisTags: AxisTag[]; comparisons: Comparison[] };
type Pair = { a: AxisTag; b: AxisTag; left: AxisTag; right: AxisTag; key: string; order: number };

function makePairs(tags: AxisTag[], axisId: number): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const [a, b] = tags[i].id < tags[j].id ? [tags[i], tags[j]] : [tags[j], tags[i]];
      const order = ((a.id * 73856093) ^ (b.id * 19349663) ^ (axisId * 83492791)) >>> 0;
      const [left, right] = order % 2 === 0 ? [a, b] : [b, a];
      pairs.push({ a, b, left, right, key: `${a.id}:${b.id}`, order });
    }
  }
  return pairs.sort((first, second) => first.order - second.order);
}

export default function TagComparison() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [axisKey, setAxisKey] = useState("darkness");
  const [history, setHistory] = useState<string[]>([]);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tag-comparisons")
      .then((response) => {
        if (!response.ok) throw new Error("비교 데이터를 불러오지 못했습니다.");
        return response.json();
      })
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "오류가 발생했습니다."));
  }, []);

  const axis = data?.axes.find((item) => item.key === axisKey) ?? null;
  const pairs = useMemo(() => {
    if (!data || !axis) return [];
    return makePairs(data.axisTags.filter((tag) => tag.axis_id === axis.id), axis.id);
  }, [data, axis]);
  const answers = useMemo(() => {
    const map = new Map<string, Comparison>();
    if (!data || !axis) return map;
    for (const answer of data.comparisons) {
      if (answer.axis_id === axis.id) map.set(`${answer.tag_a_id}:${answer.tag_b_id}`, answer);
    }
    return map;
  }, [data, axis]);

  const current = reviewKey
    ? pairs.find((pair) => pair.key === reviewKey) ?? null
    : pairs.find((pair) => !answers.has(pair.key)) ?? null;
  const answeredCount = answers.size;
  const progress = pairs.length === 0 ? 0 : Math.round((answeredCount / pairs.length) * 100);

  const save = async (decision: "win" | "tie" | "skip", winnerTagId?: number) => {
    if (!axis || !current || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/tag-comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          axisKey: axis.key,
          tagAId: current.a.id,
          tagBId: current.b.id,
          decision,
          winnerTagId: winnerTagId ?? null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "저장하지 못했습니다.");
      setData((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          comparisons: [
            ...previous.comparisons.filter((item) => item.id !== result.id),
            result,
          ],
        };
      });
      setHistory((previous) => [...previous, current.key]);
      setReviewKey(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    const key = history.at(-1);
    if (!key) return;
    setHistory((previous) => previous.slice(0, -1));
    setReviewKey(key);
  };

  if (error && !data) return <main className={styles.page}><p className={styles.error}>{error}</p></main>;
  if (!data) return <main className={styles.page}><p className={styles.status}>비교 데이터를 불러오는 중…</p></main>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>TagSpark · Pairwise annotation</p>
        <h1 className={styles.title}>태그 비교</h1>
        <p className={styles.description}>
          분량과 완결여부를 제외한 모든 태그를 비교합니다. 한 번에 하나의 축만 판단하고,
          어두움 또는 개싸움에 더 가까운 태그를 선택하세요. 두 태그 모두 축과 관련 있고 강도가 같으면 비슷함,
          축과 무관하거나 애매하면 판단 불가를 눌러도 됩니다.
        </p>

        <div className={styles.tabs} role="tablist" aria-label="비교 축">
          {data.axes.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === axisKey}
              className={`${styles.tab} ${item.key === axisKey ? styles.tabActive : ""}`}
              onClick={() => { setAxisKey(item.key); setHistory([]); setReviewKey(null); }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.progressBlock}>
          <div className={styles.progressMeta}>
            <span>{axis?.label}</span>
            <span>{answeredCount} / {pairs.length} · {progress}%</span>
          </div>
          <div className={styles.progressTrack} aria-label={`진행률 ${progress}%`}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className={styles.card} aria-live="polite">
          {current && axis ? (
            <>
              <h2 className={styles.prompt}>{axis.prompt}</h2>
              <div className={styles.pair}>
                <button className={styles.tagButton} disabled={saving} onClick={() => save("win", current.left.id)}>
                  <small>{current.left.category} · {axis.high_label}</small><strong>#{current.left.name}</strong>
                </button>
                <span className={styles.versus}>VS</span>
                <button className={styles.tagButton} disabled={saving} onClick={() => save("win", current.right.id)}>
                  <small>{current.right.category} · {axis.high_label}</small><strong>#{current.right.name}</strong>
                </button>
              </div>
              <div className={styles.secondaryActions}>
                <button className={styles.secondaryButton} disabled={saving} onClick={() => save("tie")}>비슷함</button>
                <button className={styles.secondaryButton} disabled={saving} onClick={() => save("skip")}>판단 불가</button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </>
          ) : (
            <div className={styles.complete}>
              <h2>{axis?.label} 비교 완료</h2>
              <p>이 축의 모든 태그 쌍에 응답했습니다. 다른 축으로 이동하거나 이전 응답을 검토할 수 있습니다.</p>
            </div>
          )}
        </section>

        {history.length > 0 && <button className={styles.backButton} onClick={goBack}>← 이전 응답 수정</button>}
      </div>
    </main>
  );
}
