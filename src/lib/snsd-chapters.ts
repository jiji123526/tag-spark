export type SnsdChapter = {
  id: string;
  label: string;
  paragraph: number;
  part?: number;
  charOffset?: number;
  manualChapterId?: number;
  canManage?: boolean;
  replacesParagraphIndex?: number | null;
  replacesCharOffset?: number | null;
};

type ChapterCandidate = SnsdChapter & {
  format: "generic" | "title" | "explicit" | "hash" | "bracket" | "special";
  sequenceNumber?: number;
  seriesKey?: string;
  bareNumber?: boolean;
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
      if (!line || line.length > 80 || /^[·•\s]{3,}$/.test(line)) continue;
      if (/^step\s*\d+/i.test(line)) continue;
      if (/\d[.,]\d/.test(line)) continue;

      const special = /^(?:[.·\s]*)?(?:prologue|epilogue|프롤로그|에필로그|외전|번외)(?:\s*(?:\([^)]*\)|완|完|완결|두번째))?[.·\s]*$/i.test(line);
      const hashMatch = /^(.{0,40}?)#\s*(\d{1,3}(?:[-–]\d{1,3})?)(?:\s*[.)])?(?:\s+.{1,80})?$/.exec(line);
      const bracketMatch = /^\[\s*(\d{1,3}(?:[-–]\d{1,3})?)\s*\](?:\s+.{0,80})?$/.exec(line);
      const explicitMatch = /(?:^|[\s])(?:ep(?:isode)?|chapter)\s*\d+/i.test(line)
        || /(?:^|[\s])제?\s*\d+\s*(?:장|화|부|편|회)/.test(line)
        || /(?:^|[\s])(?:ep|ch)\.?\s*\d{1,3}\b/i.test(line);
      const genericMatch = /^(?:\d{1,3}(?:[-–]\d{1,3})?)[.]?(?:\s+.{1,60})?$/.exec(line);
      const titleMatch = /^[^0-9].{0,78}\s+(\d{1,3})(?:[-–](\d{1,3}))?(?:\s*[.．)]?(?:\s*(?:완|완결|끝|完|번외|외전))?)?(?:\s*[（(](?:완|완결|끝|完|번외|외전)[）)])?$/.exec(line);
      const explicitNumber = explicitMatch ? /(?:\d{1,3})(?:[-–]\d{1,3})?/.exec(line)?.[0] : undefined;
      const getSequenceNumber = (value?: string) => {
        if (!value) return undefined;
        const parts = value.split(/[-–]/).map(Number);
        return parts[0] * 100 + (parts[1] ?? 0);
      };

      if (special || hashMatch || bracketMatch || explicitMatch || genericMatch || titleMatch) {
        const format = special
          ? "special"
          : hashMatch
            ? "hash"
            : bracketMatch
              ? "bracket"
            : explicitMatch
              ? "explicit"
              : titleMatch
                ? "title"
                : "generic";
        const matchedNumber = titleMatch?.[1]
          ? `${titleMatch[1]}${titleMatch[2] ? `-${titleMatch[2]}` : ""}`
          : hashMatch?.[2]
            ?? bracketMatch?.[1]
            ?? explicitNumber
            ?? genericMatch?.[0].match(/^\d{1,3}(?:[-–]\d{1,3})?/)?.[0];
        const titlePrefix = titleMatch?.[0]
          .replace(/\s*[（(](?:완|완결|끝|完|번외|외전)[）)]$/, "")
          .replace(/\s+\d{1,3}(?:[-–]\d{1,3})?(?:\s*[.．)]?(?:\s*(?:완|완결|끝|完|번외|외전))?)?$/, "")
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
            : format === "bracket"
              ? "bracket"
            : format === "title"
              ? `title:${titlePrefix}`
              : format === "explicit"
                ? "explicit"
                : format,
          bareNumber: format === "generic" && /^\d{1,3}(?:[-–]\d{1,3})?[.．)]?\s*$/.test(line),
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
      && (
        Math.abs(other.sequenceNumber - candidate.sequenceNumber) === 100
        || (
          Math.floor(other.sequenceNumber / 100) === Math.floor(candidate.sequenceNumber / 100)
          && Math.abs(other.sequenceNumber - candidate.sequenceNumber) === 1
        )
      )
      && ((other.sequenceNumber > candidate.sequenceNumber && other.paragraph > candidate.paragraph)
        || (other.sequenceNumber < candidate.sequenceNumber && other.paragraph < candidate.paragraph)));
  };
  const hasStrongSeries = candidates.some(candidate => candidate.format !== "generic" && candidate.format !== "special" && hasChronologicalNeighbor(candidate));
  const hasNumberedSeries = candidates.some(candidate => candidate.format !== "special"
    && candidate.sequenceNumber !== undefined
    && hasChronologicalNeighbor(candidate));
  const hasTitledGenericSeries = candidates.some(candidate => candidate.format === "generic"
    && !candidate.bareNumber
    && hasChronologicalNeighbor(candidate));
  const filtered = candidates.filter(candidate => {
    if (candidate.format === "special") return hasNumberedSeries;
    if (candidate.format === "generic" && candidate.bareNumber && hasTitledGenericSeries) return false;
    if (hasStrongSeries && candidate.format === "generic") return false;
    return hasChronologicalNeighbor(candidate);
  });
  const seenSequenceNumbers = new Set<number>();
  const seenParagraphs = new Set<number>();
  const chapters = filtered
    .filter(candidate => {
      if (candidate.sequenceNumber !== undefined) {
        if (seenSequenceNumbers.has(candidate.sequenceNumber)) return false;
        seenSequenceNumbers.add(candidate.sequenceNumber);
      }
      if (seenParagraphs.has(candidate.paragraph)) return false;
      seenParagraphs.add(candidate.paragraph);
      return true;
    })
    .map(candidate => ({
      id: candidate.id,
      label: candidate.label,
      paragraph: candidate.paragraph,
      sequenceNumber: candidate.sequenceNumber,
    }));

  let part = 1;
  let previousSequence: number | undefined;
  return chapters.map(({ sequenceNumber, ...chapter }) => {
    if (sequenceNumber !== undefined
      && previousSequence !== undefined
      && sequenceNumber < previousSequence) {
      part += 1;
    }
    if (sequenceNumber !== undefined) previousSequence = sequenceNumber;
    return { ...chapter, part };
  });
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
