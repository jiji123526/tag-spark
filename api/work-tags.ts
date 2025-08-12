// /api/work-tags.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Papa from 'papaparse';

// 너의 태그 사전(이 경로는 프로젝트 구조에 맞춰 수정)
// tags.ts 안에 aliases 포함되어 있어야 하고, "썰 백업"을 alias로 추가했다면 그대로 매핑됨.
import { tags as ALL_TAGS } from '../src/data/tags';

// "태그명 또는 별칭" -> tag_id 매핑
const NAME_TO_ID = (() => {
  const map = new Map<string, number>();
  for (const t of ALL_TAGS) {
    map.set(t.name.trim(), t.id);
    for (const a of t.aliases ?? []) map.set(a.trim(), t.id);
  }
  return map;
})();

// 다국어/오타 대비: 기본 구분자를 넉넉히 허용(, 와 ， 둘 다)
function splitList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/[,，]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const csvUrl = process.env.SHEET_CSV_URL;
    if (!csvUrl) {
      return res.status(500).json({ error: 'SHEET_CSV_URL is not set' });
    }

    const rsp = await fetch(csvUrl);
    if (!rsp.ok) {
      return res.status(502).json({ error: `Failed to fetch sheet: ${rsp.status}` });
    }
    const text = await rsp.text();

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows: any[] = parsed.data as any[];

    // 출력: work_id, tag_id, weight(항상 1)
    const out: { work_id: number; tag_id: number; weight: 1 }[] = [];

    for (const r of rows) {
      const workId = Number(r.id);
      if (!Number.isFinite(workId)) continue;

      // 1) 자유 태그 칼럼
      const tagNames = new Set<string>(splitList(r.tags));

      // 2) 분량(series)도 태그로 취급 (예: 단편/중편/장편/썰백업/썰 백업 등)
      const series = String(r.series || '').trim();
      if (series) tagNames.add(series);

      // 3) 완결여부(status)도 태그로 취급 (예: 완결/미완)
      const status = String(r.status || '').trim();
      if (status) tagNames.add(status);

      // 매핑
      for (const name of tagNames) {
        const tagId = NAME_TO_ID.get(name);
        if (tagId) out.push({ work_id: workId, tag_id: tagId, weight: 1 });
        // 매칭 안 되면 스킵(필요하면 로깅)
      }
    }

    // 캐시(엣지 캐시 5분, 그 사이엔 SWR로 60초)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(out);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
}