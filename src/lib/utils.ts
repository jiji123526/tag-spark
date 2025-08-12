// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* =========================
   🔎 별칭/부분매칭 유틸 3종
   ========================= */

// 1) 문자열 정규화: 소문자화 + 유니코드 정규화 + 공백/기호 제거
export function normalizeToken(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    // 유니코드 문자/숫자만 남김 (ES2020+ 환경)
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

// 2) 태그명 + 별칭 배열을 토큰 집합으로 변환
// 예) name: "연예계", aliases: ["아이돌", "배우, 앵커"] ->
// Set{"연예계","아이돌","배우","앵커"}
export function buildAliasSet(name: string, aliases?: string[]): Set<string> {
  const set = new Set<string>();
  const push = (raw: string) => {
    if (!raw) return;
    String(raw)
      // 쉼표/중점/슬래시/파이프 등으로 분할
      .split(/[,\u00B7\/|]+/g)
      .map((p) => normalizeToken(p))
      .filter(Boolean)
      .forEach((p) => set.add(p));
  };

  push(name);
  if (aliases) aliases.forEach(push);
  return set;
}

// 3) 두 alias 집합이 교집합이 있거나 부분 포함되면 true
export function aliasOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x === y) return true;
      if (x.includes(y) || y.includes(x)) return true;
    }
  }
  return false;
}