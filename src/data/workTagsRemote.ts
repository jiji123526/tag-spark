// src/data/workTagsRemote.ts
import { workTags as FALLBACK } from './workTags';

export async function getWorkTags() {
  try {
    // 브라우저 캐시는 막고(최신 본다), Vercel 엣지 캐시는 위 함수 헤더로 관리
    const rsp = await fetch('/api/work-tags', { cache: 'no-store' });
    if (!rsp.ok) throw new Error('Bad status');
    return await rsp.json();
  } catch {
    return FALLBACK;
  }
}