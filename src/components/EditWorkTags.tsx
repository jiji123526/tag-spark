import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Tag, Work, WorkTag } from "@/lib/types";
import styles from "./EditWorkTags.module.css";
import composeStyles from "./AddWorkCompose.module.css";
import chevronRightIcon from "../assets/icons/list/chevron.right.svg";
import magnifyingglassIcon from "../assets/icons/list/magnifyingglass.svg";
import clearIcon from "../assets/icons/list/x.svg";

interface EditWorkTagsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const categories = ["설정", "관계", "분위기", "장르", "세계관", "분량", "완결여부", "씨피고정"];

const compareByAuthorTitle = (first: Work, second: Work) => {
  const firstIsKorean = first.author.charCodeAt(0) >= 0xac00 && first.author.charCodeAt(0) <= 0xd7a3;
  const secondIsKorean = second.author.charCodeAt(0) >= 0xac00 && second.author.charCodeAt(0) <= 0xd7a3;
  if (firstIsKorean !== secondIsKorean) return firstIsKorean ? -1 : 1;
  const locale = firstIsKorean ? "ko" : "en";
  const authorDifference = first.author.localeCompare(second.author, locale);
  return authorDifference || first.title.localeCompare(second.title, locale);
};

export default function EditWorkTags({ open, onOpenChange, onSaved }: EditWorkTagsProps) {
  const [works, setWorks] = useState<Work[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [mappings, setMappings] = useState<WorkTag[]>([]);
  const [workQuery, setWorkQuery] = useState("");
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [originalTagIds, setOriginalTagIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const closeTimerRef = useRef<number | null>(null);
  const fieldsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (selectedWorkId !== null) fieldsRef.current?.scrollTo({ top: 0 });
  }, [selectedWorkId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMessage("");
    fetch("/api/reco-data")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setWorks(data.works);
        setTags(data.tags);
        setMappings(data.workTags);
      })
      .catch(() => setMessage("데이터를 불러오지 못했습니다. 다시 시도해주세요."))
      .finally(() => setLoading(false));
  }, [open]);

  const tagsByWorkId = useMemo(() => {
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    const grouped = new Map<number, Tag[]>();
    const categoryOrder: Record<string, number> = {
      "분량": 1,
      "완결여부": 2,
      "세계관": 3,
      "장르": 4,
      "설정": 5,
      "관계": 6,
      "분위기": 7,
    };

    for (const mapping of mappings) {
      const tag = tagById.get(mapping.tag_id);
      if (!tag || tag.id === 900) continue;
      const workTags = grouped.get(mapping.work_id) ?? [];
      workTags.push(tag);
      grouped.set(mapping.work_id, workTags);
    }

    for (const workTags of grouped.values()) {
      workTags.sort((first, second) => {
        const categoryDifference = (categoryOrder[first.category] ?? 999) - (categoryOrder[second.category] ?? 999);
        return categoryDifference || first.name.localeCompare(second.name, "ko");
      });
    }

    return grouped;
  }, [mappings, tags]);

  const filteredWorks = useMemo(() => {
    const query = workQuery.trim().toLowerCase();
    const matchingWorks = !query ? works : works.filter((work) =>
      work.title.toLowerCase().includes(query) ||
      work.author.toLowerCase().includes(query) ||
      (work.aliases ?? []).some((alias) => alias.toLowerCase().includes(query)) ||
      (work.author_aliases ?? []).some((alias) => alias.toLowerCase().includes(query)) ||
      (tagsByWorkId.get(work.id) ?? []).some((tag) =>
        tag.name.toLowerCase().includes(query) ||
        (tag.aliases ?? []).some((alias) => alias.toLowerCase().includes(query))
      )
    );
    return [...matchingWorks].sort(compareByAuthorTitle);
  }, [tagsByWorkId, workQuery, works]);

  const selectedWork = works.find((work) => work.id === selectedWorkId);
  const selectedCategories = new Set(
    tags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.category)
  );
  const hasRequiredTags = selectedCategories.has("분량") && selectedCategories.has("완결여부");
  const sortedSelectedTagIds = [...selectedTagIds].sort((first, second) => first - second);
  const sortedOriginalTagIds = [...originalTagIds].sort((first, second) => first - second);
  const hasChanges = selectedTagIds.length !== originalTagIds.length ||
    sortedSelectedTagIds.some((tagId, index) => tagId !== sortedOriginalTagIds[index]);
  const canSave = selectedWorkId !== null && hasRequiredTags && hasChanges;

  const selectWork = (workId: number) => {
    const workTagIds = mappings.filter((mapping) => mapping.work_id === workId).map((mapping) => mapping.tag_id);
    setSelectedWorkId(workId);
    setSelectedTagIds(workTagIds);
    setOriginalTagIds(workTagIds);
    setMessage("");
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
    setMessage("");
  };

  const close = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSelectedWorkId(null);
    setSelectedTagIds([]);
    setOriginalTagIds([]);
    setWorkQuery("");
    setMessage("");
    onOpenChange(false);
  };

  const save = async () => {
    if (!canSave || selectedWorkId === null) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/works", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_id: selectedWorkId, tags: selectedTagIds }),
      });
      if (!response.ok) throw new Error();
      setMappings((current) => [
        ...current.filter((mapping) => mapping.work_id !== selectedWorkId),
        ...selectedTagIds.map((tagId) => ({ work_id: selectedWorkId, tag_id: tagId, weight: 1 })),
      ]);
      setOriginalTagIds(selectedTagIds);
      onSaved?.();
      setMessage("키워드가 수정되었습니다.");
      closeTimerRef.current = window.setTimeout(close, 3000);
    } catch {
      setMessage("수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (selectedWorkId === null) {
      close();
      return;
    }
    setSelectedWorkId(null);
    setSelectedTagIds([]);
    setOriginalTagIds([]);
    setMessage("");
  };

  return (
    <DrawerPrimitive.Root open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className={composeStyles.overlay} />
        <DrawerPrimitive.Content className={composeStyles.content} aria-describedby={undefined}>
          <DrawerPrimitive.Title className={styles.srOnly}>키워드 수정 요청</DrawerPrimitive.Title>
          <div className={composeStyles.handleBar}><div className={composeStyles.handle} /></div>
          <div className={composeStyles.topRow}>
            <button type="button" className={composeStyles.cancelBtn} onClick={handleCancel}>Cancel</button>
          </div>
          <div className={composeStyles.titleRow}>
            <h1 className={composeStyles.title}>키워드 수정 요청</h1>
            {selectedWorkId !== null && (
              <button type="button" className={composeStyles.sendBtn} disabled={!canSave || saving} onClick={save} aria-label="키워드 저장">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="18" fill={canSave && !saving ? "#007AFF" : "#D1D1D6"} />
                  <path d="M18 10V26M18 10L12.5 15.5M18 10L23.5 15.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          <div ref={fieldsRef} className={composeStyles.fields}>
            {message && <div className={message.includes("되었습니다") ? styles.success : composeStyles.duplicateError}>{message}</div>}
            {loading ? (
              <div className={styles.empty}>불러오는 중...</div>
            ) : selectedWorkId === null ? (
              <>
                <p className={styles.instructions}>키워드를 수정할 작품을 선택해주세요.</p>
                <div className={styles.stickySearch}>
                  <div className={styles.searchBar}>
                    <img className={styles.searchIcon} src={magnifyingglassIcon} alt="" />
                    <input
                      className={styles.searchInput}
                      value={workQuery}
                      onChange={(event) => setWorkQuery(event.target.value)}
                      placeholder="제목 또는 작가 검색"
                      aria-label="작품 검색"
                    />
                    {workQuery && (
                      <button type="button" className={styles.clearButton} onClick={() => setWorkQuery("")} aria-label="검색어 지우기">
                        <img src={clearIcon} alt="" />
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.workList}>
                  {filteredWorks.map((work) => (
                    <button type="button" key={work.id} className={styles.workRow} onClick={() => selectWork(work.id)}>
                      <div className={styles.workContent}>
                        <div className={styles.workTitleRow}>
                          <span className={styles.workTitle}>{work.title}</span>
                          <img className={styles.chevron} src={chevronRightIcon} alt="" />
                        </div>
                        <span className={styles.workAuthor}>{work.author}</span>
                        <span className={styles.workTags}>
                          {(tagsByWorkId.get(work.id) ?? []).map((tag) => tag.name).join(", ")}
                        </span>
                      </div>
                    </button>
                  ))}
                  {filteredWorks.length === 0 && <div className={styles.empty}>검색 결과가 없습니다.</div>}
                </div>
              </>
            ) : (
              <>
                <div className={composeStyles.fieldRow}>
                  <span className={composeStyles.fieldLabel}>제목:</span>
                  <span className={styles.fieldValue}>{selectedWork?.title}</span>
                </div>
                <div className={composeStyles.separator} />
                <div className={composeStyles.fieldRow}>
                  <span className={composeStyles.fieldLabel}>작가:</span>
                  <span className={styles.fieldValue}>{selectedWork?.author}</span>
                </div>
                <div className={composeStyles.separator} />
                <div className={`${composeStyles.fieldRow} ${styles.currentKeywordsRow}`}>
                  <span className={composeStyles.fieldLabel}>현재 포함된 키워드:</span>
                  <div className={composeStyles.tagFieldContent}>
                    {selectedTagIds.map((tagId) => {
                      const tag = tags.find((candidate) => candidate.id === tagId);
                      if (!tag) return null;
                      return (
                        <button
                          type="button"
                          key={tagId}
                          className={`${composeStyles.tagChip} ${styles.currentKeywordChip}`}
                          onClick={() => toggleTag(tagId)}
                          aria-label={`${tag.name} 키워드 제거`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {!hasRequiredTags && <p className={styles.requirement}>분량과 완결여부 키워드를 각각 하나 이상 선택해주세요.</p>}
                <div className={`${composeStyles.tagReference} ${styles.keywordList}`}>
                  <div className={composeStyles.tagReferenceTitle}>키워드 목록</div>
                  {categories.map((category) => {
                    const categoryTags = tags.filter((tag) => tag.category === category);
                    if (categoryTags.length === 0) return null;
                    return (
                      <section key={category} className={composeStyles.tagReferenceGroup}>
                        <span className={composeStyles.tagReferenceLabel}>{category}</span>
                        <div className={composeStyles.tagReferenceChips}>
                          {categoryTags.map((tag) => {
                            const selected = selectedTagIds.includes(tag.id);
                            return (
                              <button
                                type="button"
                                key={tag.id}
                                className={`${composeStyles.tagReferenceChip} ${styles.tagButton} ${selected ? composeStyles.tagReferenceChipSelected : ""}`}
                                aria-pressed={selected}
                                onClick={() => toggleTag(tag.id)}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
