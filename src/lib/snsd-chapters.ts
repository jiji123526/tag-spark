export type SnsdChapter = {
  id: string;
  label: string;
  paragraph: number;
};

type ChapterCandidate = SnsdChapter & {
  format: "generic" | "title" | "explicit" | "hash" | "special";
  sequenceNumber?: number;
  seriesKey?: string;
};

export function detectSnsdChapters(paragraphs: string[]): SnsdChapter[] {
  const candidates: ChapterCandidate[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = paragraph
      .split(/\r?\n/)
      .map(line => line.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").trim())
      .filter(Boolean);
    if (lines.length > 2) return;

    for (const line of lines) {
      if (!line || line.length > 80 || /^[-=_*·•\s]{3,}$/.test(line)) continue;
      if (/^step\s*\d+/i.test(line)) continue;

      const special = /^(?:[.·\s]*)?(?:prologue|epilogue|프롤로그|에필로그|외전|번외)(?:\s*(?:\([^)]*\)|완|完|완결|두번째))?[.·\s]*$/i.test(line);
      const hashMatch = /^(.{0,40}?)#\s*(\d{1,3}(?:[-–]\d{1,3})?)(?:\s*[.)])?(?:\s+.{1,80})?$/.exec(line);
      const explicitMatch = /(?:^|[\s])(?:ep(?:isode)?|chapter)\s*\d+/i.test(line)
        || /(?:^|[\s])제?\s*\d+\s*(?:장|화|부|편|회)/.test(line)
        || /(?:^|[\s])(?:ep|ch)\.?\s*\d{1,3}\b/i.test(line);
      const genericMatch = /^(?:\d{1,3}(?:[-–]\d{1,3})?)[.]?(?:\s+.{1,60})?$/.exec(line);
      const titleMatch = /^[^0-9].{0,58}\s+(\d{1,3})(?:[-–](\d{1,3}))?(?:\s*[.．)]?(?:\s*(?:完|완결))?)?$/.exec(line);
      const explicitNumber = explicitMatch ? /(?:\d{1,3})(?:[-–]\d{1,3})?/.exec(line)?.[0] : undefined;
      const getSequenceNumber = (value?: string) => {
        if (!value) return undefined;
        const parts = value.split(/[-–]/).map(Number);
        return parts[0] * 100 + (parts[1] ?? 0);
      };

      if (special || hashMatch || explicitMatch || genericMatch || titleMatch) {
        const format = special
          ? "special"
          : hashMatch
            ? "hash"
            : explicitMatch
              ? "explicit"
              : titleMatch
                ? "title"
                : "generic";
        const matchedNumber = titleMatch?.[1]
          ? `${titleMatch[1]}${titleMatch[2] ? `-${titleMatch[2]}` : ""}`
          : hashMatch?.[2]
            ?? explicitNumber
            ?? genericMatch?.[0].match(/^\d{1,3}(?:[-–]\d{1,3})?/)?.[0];
        const titlePrefix = titleMatch?.[0]
          .replace(/\s+\d{1,3}(?:[-–]\d{1,3})?(?:\s*[.．)]?(?:\s*(?:完|완결))?)?$/, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLocaleLowerCase("ko");
        const hashPrefix = hashMatch?.[1]
          .replace(/\s+/g, " ")
          .trim()
          .toLocaleLowerCase("ko");
        candidates.push({
          id: `chapter-${paragraphIndex}`,
          label: line,
          paragraph: paragraphIndex,
          format,
          sequenceNumber: getSequenceNumber(matchedNumber),
          seriesKey: format === "hash"
            ? `hash:${hashPrefix || "default"}`
            : format === "title"
              ? `title:${titlePrefix}`
              : format === "explicit"
                ? "explicit"
                : format,
        });
        break;
      }
    }
  });

  const hasChronologicalNeighbor = (candidate: ChapterCandidate) => {
    if (candidate.sequenceNumber === undefined) return false;
    return candidates.some(other => other !== candidate
      && other.format === candidate.format
      && other.seriesKey === candidate.seriesKey
      && other.sequenceNumber !== undefined
      && Math.abs(other.sequenceNumber - candidate.sequenceNumber) === 1
      && ((other.sequenceNumber > candidate.sequenceNumber && other.paragraph > candidate.paragraph)
        || (other.sequenceNumber < candidate.sequenceNumber && other.paragraph < candidate.paragraph)));
  };
  const hasStrongSeries = candidates.some(candidate => candidate.format !== "generic" && candidate.format !== "special" && hasChronologicalNeighbor(candidate));
  const filtered = candidates.filter(candidate => {
    if (candidate.format === "special") return true;
    if (hasStrongSeries && candidate.format === "generic") return false;
    return hasChronologicalNeighbor(candidate);
  });
  const seenParagraphs = new Set<number>();
  return filtered
    .filter(candidate => {
      if (seenParagraphs.has(candidate.paragraph)) return false;
      seenParagraphs.add(candidate.paragraph);
      return true;
    })
    .map(candidate => ({ id: candidate.id, label: candidate.label, paragraph: candidate.paragraph }));
}

export function countSnsdChapters(text: string) {
  if (!text.trim()) return 0;
  return detectSnsdChapters(text.split(/\r?\n\s*\r?\n/)).length;
}

export function getSnsdLengthTag(chapterCount: number | null | undefined) {
  if (!chapterCount || chapterCount < 1) return null;
  if (chapterCount <= 3) return "단편";
  if (chapterCount <= 9) return "중편";
  return "장편";
}
