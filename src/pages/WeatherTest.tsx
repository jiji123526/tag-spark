import { useState } from "react";
import { mapWeatherToTags, pickWeightedTags } from "@/lib/weather-tags";
import { WeatherData } from "@/lib/weather";
import { Tag, Work, WorkTag } from "@/lib/types";
import { computeRecommendations } from "@/lib/reco";
import styles from "../components/WeatherPopup.module.css";

const CONDITIONS = ["clear", "clouds", "rain", "drizzle", "thunderstorm", "snow", "fog"];

export default function WeatherTest() {
  const [condition, setCondition] = useState("clear");
  const [temp, setTemp] = useState(20);
  const [isNight, setIsNight] = useState(false);
  const [lat, setLat] = useState(37.5);
  const [result, setResult] = useState<{ emoji: string; message: string; tagNames: string[]; works: Work[] } | null>(null);
  const [allResults, setAllResults] = useState<Work[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recoData, setRecoData] = useState<{ works: Work[]; tags: Tag[]; workTags: WorkTag[] } | null>(null);
  const [fullRec, setFullRec] = useState<{ emoji: string; message: string; tagNames: string[]; excludeTagNames: string[] } | null>(null);

  const handleTest = async () => {
    setLoading(true);
    const weather: WeatherData = { condition, temp, isNight };
    const rec = mapWeatherToTags(weather, lat);

    try {
      const res = await fetch("/api/reco-data");
      const data = await res.json() as { works: Work[]; tags: Tag[]; workTags: WorkTag[] };
      setRecoData(data);
      setFullRec(rec);

      const shuffledTags = pickWeightedTags(rec.tagNames, 3);
      const matchedTagIds = data.tags.filter(t => shuffledTags.includes(t.name)).map(t => t.id);
      const excludeTagIds = data.tags.filter(t => rec.excludeTagNames.includes(t.name)).map(t => t.id);
      const results = computeRecommendations(matchedTagIds, { ...data, excludeTagIds });
      let filtered = results.filter(w => {
        const workTagIds = data.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
        return matchedTagIds.every(id => workTagIds.includes(id));
      });

      let finalTags = shuffledTags;

      if (filtered.length < 3) {
        filtered = results.filter(w => {
          const workTagIds = data.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
          return matchedTagIds.some(id => workTagIds.includes(id));
        });
        const topWorks = filtered.sort(() => Math.random() - 0.5).slice(0, 3);
        if (topWorks.length > 0) {
          finalTags = shuffledTags.filter(tagName => {
            const tagId = data.tags.find(t => t.name === tagName)?.id;
            if (!tagId) return false;
            return topWorks.every(w => data.workTags.some(wt => wt.work_id === w.id && wt.tag_id === tagId));
          });
          if (finalTags.length === 0) finalTags = shuffledTags.slice(0, 1);
          filtered = topWorks;
        }
      }

      const shuffled = filtered.sort(() => Math.random() - 0.5);
      setAllResults(shuffled);
      setResult({ ...rec, tagNames: finalTags, works: shuffled.slice(0, 3) });
      setPage(0);
    } catch {
      setResult({ ...rec, tagNames: rec.tagNames.slice(0, 3), works: [] });
      setAllResults([]);
    }
    setLoading(false);
  };

  const handleMore = () => {
    if (!fullRec || !recoData) return;
    const shuffledTags = pickWeightedTags(fullRec.tagNames, 3);
    const matchedTagIds = recoData.tags.filter(t => shuffledTags.includes(t.name)).map(t => t.id);
    const excludeTagIds = recoData.tags.filter(t => fullRec.excludeTagNames.includes(t.name)).map(t => t.id);
    const results = computeRecommendations(matchedTagIds, { ...recoData, excludeTagIds });
    let filtered = results.filter(w => {
      const workTagIds = recoData.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
      return matchedTagIds.every(id => workTagIds.includes(id));
    });

    let finalTags = shuffledTags;

    if (filtered.length < 3) {
      filtered = results.filter(w => {
        const workTagIds = recoData.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
        return matchedTagIds.some(id => workTagIds.includes(id));
      });
      const topWorks = filtered.sort(() => Math.random() - 0.5).slice(0, 3);
      if (topWorks.length > 0) {
        finalTags = shuffledTags.filter(tagName => {
          const tagId = recoData.tags.find(t => t.name === tagName)?.id;
          if (!tagId) return false;
          return topWorks.every(w => recoData.workTags.some(wt => wt.work_id === w.id && wt.tag_id === tagId));
        });
        if (finalTags.length === 0) finalTags = shuffledTags.slice(0, 1);
        filtered = topWorks;
      }
    }

    const shuffled = filtered.sort(() => Math.random() - 0.5);
    setAllResults(shuffled);
    setResult(prev => prev ? { ...prev, tagNames: finalTags, works: shuffled.slice(0, 3) } : null);
    setPage(0);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: "20px" }}>
      {/* Controls */}
      <div style={{ maxWidth: 320, margin: "0 auto 20px", background: "#fff", borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🧪 Weather Controls</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Condition</span>
            <select value={condition} onChange={e => setCondition(e.target.value)} style={{ display: "block", width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", marginTop: 4, fontSize: 14 }}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Temperature: {temp}°C</span>
            <input type="range" min={-20} max={40} value={temp} onChange={e => setTemp(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isNight} onChange={e => setIsNight(e.target.checked)} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Night time</span>
          </label>
          <label>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Latitude: {lat}° ({lat >= 0 ? "Northern" : "Southern"})</span>
            <input type="range" min={-60} max={60} step={0.5} value={lat} onChange={e => setLat(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <button onClick={handleTest} disabled={loading} style={{ background: "#141415", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "로딩 중..." : "추천 받기"}
          </button>
        </div>
      </div>

      {/* Popup preview - exact same styles */}
      {result && (
        <div className={styles.overlay} style={{ position: "relative", background: "none", minHeight: "auto" }}>
          <div className={styles.popup}>
            <div className={styles.emoji}>{result.emoji}</div>
            <p className={styles.message}>{result.message}</p>
            <div className={styles.workList}>
              {result.works.length === 0 && <p className={styles.noResult}>매칭되는 작품이 없어요</p>}
              {result.works.map(w => (
                <a key={w.id} href={w.source_url} target="_blank" rel="noopener noreferrer" className={styles.workItem}>
                  <span className={styles.workTitle}>{w.title}</span>
                  <span className={styles.workAuthor}>{w.author}</span>
                </a>
              ))}
            </div>
            <div className={styles.tagList}>
              {result.tagNames.map(name => (
                <span key={name} className={styles.tag}>#{name}</span>
              ))}
            </div>
            <div className={styles.buttons}>
              <button className={styles.decline} onClick={() => setResult(null)}>닫기</button>
              <button className={styles.accept} onClick={handleMore}>추천 더보기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
