import { useState, useRef, useMemo } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { tags as allTags } from "@/data/tags";
import { works as allWorks } from "@/data/works";
import styles from "./AddWorkCompose.module.css";

interface AddWorkComposeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddWorkCompose({ open, onOpenChange }: AddWorkComposeProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showTagInfo, setShowTagInfo] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const checkDuplicate = (t: string, a: string, u: string) => {
    const duplicate = allWorks.find(w =>
      (u.trim() && w.source_url.toLowerCase() === u.trim().toLowerCase()) ||
      (t.trim() && a.trim() && w.title.toLowerCase() === t.trim().toLowerCase() && w.author.toLowerCase() === a.trim().toLowerCase())
    );
    setDuplicateError(duplicate ? `이미 등록된 작품입니다: ${duplicate.title} - ${duplicate.author}` : "");
  };

  const isValid = title.trim() && author.trim() && url.trim() && selectedTags.length > 0;

  const filteredTags = useMemo(() => {
    if (!tagQuery.trim()) return [];
    const q = tagQuery.toLowerCase();
    return allTags
      .filter(t => !selectedTags.includes(t.id))
      .filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.aliases ?? []).some(a => a.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [tagQuery, selectedTags]);

  const handleAddTag = (tagId: number) => {
    setSelectedTags(prev => [...prev, tagId]);
    setTagQuery("");
    setShowTagSuggestions(false);
  };

  const handleAddTagFromSuggestion = (tagId: number) => {
    handleAddTag(tagId);
    tagInputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: number) => {
    setSelectedTags(prev => prev.filter(id => id !== tagId));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    if (duplicateError) return;

    try {
      const res = await fetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, source_url: url, tags: selectedTags }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setDuplicateError(data.error);
        return;
      }
      handleReset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = () => {
    setTitle("");
    setAuthor("");
    setUrl("");
    setSelectedTags([]);
    setTagQuery("");
    setDuplicateError("");
  };

  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className={styles.overlay} />
        <DrawerPrimitive.Content className={styles.content}>
          {/* Drag handle bar */}
          <div className={styles.handleBar}>
            <div className={styles.handle} />
          </div>

          {/* Cancel button row */}
          <div className={styles.topRow}>
            <button className={styles.cancelBtn} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
          </div>

          {/* Title + Send button */}
          <div className={styles.titleRow}>
            <h1 className={styles.title}>새 작품 추가</h1>
            <button
              className={styles.sendBtn}
              disabled={!isValid}
              onClick={handleSubmit}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="18" fill={isValid ? "#007AFF" : "#D1D1D6"} />
                <path d="M18 10V26M18 10L12.5 15.5M18 10L23.5 15.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Form fields */}
          <div className={styles.fields}>
            {duplicateError && (
              <div className={styles.duplicateError}>{duplicateError}</div>
            )}
            {/* 제목 */}
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>제목:</span>
              <input
                type="text"
                className={styles.fieldInput}
                value={title}
                onChange={e => { setTitle(e.target.value); checkDuplicate(e.target.value, author, url); }}
              />
            </div>
            <div className={styles.separator} />

            {/* 작가 */}
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>작가:</span>
              <input
                type="text"
                className={styles.fieldInput}
                value={author}
                onChange={e => { setAuthor(e.target.value); checkDuplicate(title, e.target.value, url); }}
              />
            </div>
            <div className={styles.separator} />

            {/* 키워드 — To: style */}
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>키워드:</span>
              <div className={styles.tagFieldContent}>
                {selectedTags.map(id => {
                  const tag = allTags.find(t => t.id === id);
                  if (!tag) return null;
                  return (
                    <span key={id} className={styles.tagChip} onClick={() => handleRemoveTag(id)}>
                      {tag.name}
                    </span>
                  );
                })}
                <input
                  ref={tagInputRef}
                  type="text"
                  className={styles.tagInput}
                  value={tagQuery}
                  onChange={e => { setTagQuery(e.target.value); setShowTagSuggestions(true); }}
                  onFocus={() => setShowTagSuggestions(true)}
                  placeholder={selectedTags.length === 0 ? "" : ""}
                />
              </div>
            </div>
            {showTagSuggestions && filteredTags.length > 0 && (
              <div className={styles.tagSuggestions}>
                {filteredTags.map(t => (
                  <button key={t.id} className={styles.tagSuggestionItem} onClick={() => handleAddTagFromSuggestion(t.id)}>
                    <span>{t.name}</span>
                    <span className={styles.tagCategory}>{t.category}</span>
                  </button>
                ))}
              </div>
            )}
            <div className={styles.separator} />

            {/* URL — Body area */}
            <div className={styles.bodyArea}>
              <input
                type="url"
                className={styles.bodyInput}
                value={url}
                onChange={e => { setUrl(e.target.value); checkDuplicate(title, author, e.target.value); }}
                placeholder="링크"
              />
            </div>

            {/* Keyword reference list */}
            <div className={styles.tagReference}>
              <div className={styles.tagReferenceTitle}>키워드 목록</div>
              <div className={styles.tagInfoToggle} onClick={() => setShowTagInfo(v => !v)}>
                <span>ℹ️ 포함 키워드</span>
                <span className={styles.tagInfoArrow}>{showTagInfo ? "▾" : "▸"}</span>
              </div>
              {showTagInfo && (
                <div className={styles.tagInfoContent}>
                  <p><b>연예인:</b> 아이돌, 배우, 앵커, 연습생, 프듀, 래퍼 (기타 등등 모든 연예계 종사자) / 한 쪽만 연예인인 경우도 포함</p>
                  <p><b>시대물:</b> 과거, 조선, 옛날</p>
                  <p><b>조직물:</b> 조폭, 마피아</p>
                  <p><b>인외:</b> 인어, 외계인, 뱀파이어, 저승사자</p>
                  <p><b>사제:</b> 선생님, 제자, 교수, 학생</p>
                  <p><b>세계관/기타:</b> 피스틸버스, 하나하키</p>
                  <p><b>씨피 고정:</b> 작가에 의해 씨피 고정(왼른 구분)이 명시된 경우에만 체크해주세요.</p>
                </div>
              )}
              {["설정", "관계", "분위기", "장르", "세계관", "분량", "완결여부", "씨피고정"].map(category => {
                const categoryTags = allTags.filter(t => t.category === category);
                if (categoryTags.length === 0) return null;
                return (
                  <div key={category} className={styles.tagReferenceGroup}>
                    <span className={styles.tagReferenceLabel}>{category}</span>
                    <div className={styles.tagReferenceChips}>
                      {categoryTags.map(t => (
                        <span
                          key={t.id}
                          className={`${styles.tagReferenceChip} ${selectedTags.includes(t.id) ? styles.tagReferenceChipSelected : ""}`}
                          onClick={() => selectedTags.includes(t.id) ? handleRemoveTag(t.id) : handleAddTag(t.id)}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
