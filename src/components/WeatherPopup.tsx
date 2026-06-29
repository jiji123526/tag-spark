import { useState, useRef, TouchEvent } from "react";
import { getLocation, fetchWeather } from "@/lib/weather";
import { mapWeatherToTags, WeatherRecommendation, pickWeightedTags } from "@/lib/weather-tags";
import { Tag, Work, WorkTag } from "@/lib/types";
import { computeRecommendations } from "@/lib/reco";
import styles from "./WeatherPopup.module.css";

type Props = { onClose: () => void };
type Phase = "ask" | "loading" | "result" | "error";

export default function WeatherPopup({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [weatherRec, setWeatherRec] = useState<WeatherRecommendation | null>(null);
  const [recWorks, setRecWorks] = useState<Work[]>([]);
  const [allResults, setAllResults] = useState<Work[]>([]);
  const [page, setPage] = useState(0);
  const [recoData, setRecoData] = useState<{ works: Work[]; tags: Tag[]; workTags: WorkTag[] } | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const handleAccept = async () => {
    setPhase("loading");
    try {
      const { lat, lon } = await getLocation();
      const weather = await fetchWeather(lat, lon);
      const rec = mapWeatherToTags(weather, lat);
      setWeatherRec(rec);

      // Fetch reco data
      const res = await fetch("/api/reco-data");
      const data = await res.json() as { works: Work[]; tags: Tag[]; workTags: WorkTag[] };
      setRecoData(data);

      // Pick 3 random tags from the mapped set
      const shuffledTags = pickWeightedTags(rec.tagNames, 3);
      const matchedTagIds = data.tags.filter(t => shuffledTags.includes(t.name)).map(t => t.id);
      const excludeTagIds = data.tags.filter(t => rec.excludeTagNames.includes(t.name)).map(t => t.id);

      const results = computeRecommendations(matchedTagIds, { ...data, excludeTagIds });
      // Only show works that have ALL active tags
      let filtered = results.filter(w => {
        const workTagIds = data.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
        return matchedTagIds.every(id => workTagIds.includes(id));
      });

      // If not enough works match all tags, relax to any-match
      if (filtered.length < 3) {
        filtered = results.filter(w => {
          const workTagIds = data.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
          return matchedTagIds.some(id => workTagIds.includes(id));
        });
      }

      const shuffled = filtered.sort(() => Math.random() - 0.5);
      const finalWorks = shuffled.slice(0, 3);

      // Derive displayed tags: only show tags from our picked set that ALL displayed works actually have
      const finalTags = shuffledTags.filter(tagName => {
        const tagId = data.tags.find(t => t.name === tagName)?.id;
        if (!tagId) return false;
        return finalWorks.every(w => data.workTags.some(wt => wt.work_id === w.id && wt.tag_id === tagId));
      });

      setAllResults(shuffled);
      setRecWorks(finalWorks);
      setActiveTags(finalTags.length > 0 ? finalTags : shuffledTags.slice(0, 1));
      setPage(0);
      setPhase("result");
    } catch {
      setPhase("error");
    }
  };

  const handleMore = () => {
    if (!weatherRec || !recoData) return;

    // Re-randomize tags
    const shuffledTags = pickWeightedTags(weatherRec.tagNames, 3);
    const matchedTagIds = recoData.tags.filter(t => shuffledTags.includes(t.name)).map(t => t.id);
    const excludeTagIds = recoData.tags.filter(t => weatherRec.excludeTagNames.includes(t.name)).map(t => t.id);

    const results = computeRecommendations(matchedTagIds, { ...recoData, excludeTagIds });
    // Only show works that have ALL active tags
    let filtered = results.filter(w => {
      const workTagIds = recoData.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
      return matchedTagIds.every(id => workTagIds.includes(id));
    });

    // If not enough works match all tags, relax to any-match
    if (filtered.length < 3) {
      filtered = results.filter(w => {
        const workTagIds = recoData.workTags.filter(wt => wt.work_id === w.id).map(wt => wt.tag_id);
        return matchedTagIds.some(id => workTagIds.includes(id));
      });
    }

    const shuffled = filtered.sort(() => Math.random() - 0.5);
    const finalWorks = shuffled.slice(0, 3);

    // Derive displayed tags: only show tags from our picked set that ALL displayed works actually have
    const finalTags = shuffledTags.filter(tagName => {
      const tagId = recoData.tags.find(t => t.name === tagName)?.id;
      if (!tagId) return false;
      return finalWorks.every(w => recoData.workTags.some(wt => wt.work_id === w.id && wt.tag_id === tagId));
    });

    setAllResults(shuffled);
    setRecWorks(finalWorks);
    setActiveTags(finalTags.length > 0 ? finalTags : shuffledTags.slice(0, 1));
    setPage(0);
  };

  if (phase === "ask") {
    return (
      <div className={styles.overlay}>
        <div className={styles.popup}>
          <div className={styles.popupBody}>
            <p className={styles.title}>오늘 날씨에 어울리는 작품을<br />추천해 드릴까요?</p>
            <div className={styles.imageArea}>
              <ImageCarousel />
            </div>
            <p className={styles.subtitle}>어떤 포타를 읽을지 감이 안 오시나요?<br />현재 날씨에 어울리는 포타를 추천받으세요.</p>
          </div>
          <div className={styles.buttons}>
            <button className={styles.accept} onClick={handleAccept}>좋아요!</button>
            <button className={styles.decline} onClick={onClose}>괜찮아요</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className={styles.overlay}>
        <div className={styles.popup}>
          <div className={styles.popupBody}>
            <p className={styles.title}>날씨 확인 중...</p>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className={styles.overlay}>
        <div className={styles.popup}>
          <div className={styles.popupBody}>
            <p className={styles.title}>위치를 가져올 수 없어요</p>
            <p className={styles.subtitle}>위치 권한을 허용해주시면<br />날씨 기반 추천을 받을 수 있어요.</p>
          </div>
          <div className={styles.buttons}>
            <button className={styles.accept} onClick={onClose}>확인</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupBody}>
          <div className={styles.emoji}>{weatherRec?.emoji}</div>
          <p className={styles.message}>{weatherRec?.message}</p>
        </div>
        <div className={styles.workList}>
          {recWorks.length === 0 && <p className={styles.noResult}>매칭되는 작품이 없어요</p>}
          {recWorks.map(w => {
            return (
              <a key={w.id} href={w.source_url} target="_blank" rel="noopener noreferrer" className={styles.workItem}>
                <span className={styles.workTitle}>{w.title}</span>
                <span className={styles.workAuthor}>{w.author}</span>
              </a>
            );
          })}
        </div>
        <div className={styles.tagList}>
          {activeTags.map(name => (
            <span key={name} className={styles.tag}>#{name}</span>
          ))}
        </div>
        <div className={styles.buttons}>
          <button className={styles.accept} onClick={handleMore}>추천 더보기</button>
          <button className={styles.decline} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function ImageCarousel() {
  const [current, setCurrent] = useState(0);
  const startX = useRef(0);
  const slides = 3;

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const diff = startX.current - e.changedTouches[0].clientX;
    if (diff > 40 && current < slides - 1) setCurrent(current + 1);
    if (diff < -40 && current > 0) setCurrent(current - 1);
  };

  return (
    <>
      <div
        className={styles.carousel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.carouselTrack} style={{ transform: `translateX(-${current * 100}%)` }}>
          <div className={styles.carouselSlide}><span className={styles.imagePlaceholder}>🖼️</span></div>
          <div className={styles.carouselSlide}><span className={styles.imagePlaceholder}>🖼️</span></div>
          <div className={styles.carouselSlide}><span className={styles.imagePlaceholder}>🖼️</span></div>
        </div>
      </div>
      <div className={styles.dots}>
        {[0, 1, 2].map(i => (
          <span key={i} className={i === current ? styles.dotActive : styles.dot} onClick={() => setCurrent(i)} />
        ))}
      </div>
    </>
  );
}
