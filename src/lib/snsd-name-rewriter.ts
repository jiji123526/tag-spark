export type ParticleKind = "topic" | "subject" | "object" | "and" | "instrumental" | "vocative" | "with" | "copula";

export type NameReplacementRule = {
  sourceFull: string;
  targetFull: string;
  sourceGiven: string;
  targetGiven: string;
  replaceGiven: boolean;
};

const KOREAN_SURNAMES = ["남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방", "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍", "유", "고", "문", "양", "손", "배", "백", "허", "남", "심", "노", "하", "곽", "성", "차", "주", "우", "구", "민", "진", "지", "엄", "채", "원", "천"].sort((a, b) => b.length - a.length);

const VARIABLE_PARTICLES: Record<string, ParticleKind> = {
  "이잖아요": "copula", "잖아요": "copula", "이잖아": "copula", "잖아": "copula",
  "이네요": "copula", "네요": "copula", "이네": "copula", "네": "copula",
  "이니": "copula", "니": "copula", "이야": "copula",
  "이라고": "copula", "라고": "copula", "이라서": "copula", "라서": "copula", "이라면": "copula", "라면": "copula", "이라도": "copula", "라도": "copula", "이든": "copula", "든": "copula",
  "이랑": "with", "랑": "with", "으로": "instrumental", "로": "instrumental", "은": "topic", "는": "topic", "이": "subject", "가": "subject", "을": "object", "를": "object", "과": "and", "와": "and", "아": "vocative", "야": "vocative",
};
const FIXED_PARTICLES = ["에게서", "한테서", "께서", "으로부터", "에게", "한테", "에서", "부터", "까지", "처럼", "보다", "만큼", "조차", "마저", "밖에", "에게는", "한테는", "에서도", "만", "도", "씨", "님", "의", "께", "씩"];
const VARIABLE_PARTICLE_NAMES = Object.keys(VARIABLE_PARTICLES).sort((a, b) => b.length - a.length);
const PARTICLE_SUFFIXES = [...new Set([
  ...VARIABLE_PARTICLE_NAMES,
  ...FIXED_PARTICLES,
  ...VARIABLE_PARTICLE_NAMES.flatMap(head => [...FIXED_PARTICLES, ...VARIABLE_PARTICLE_NAMES].map(tail => `${head}${tail}`)),
])].sort((a, b) => b.length - a.length);

export function splitKoreanName(value: string) {
  const name = value.trim();
  const surname = KOREAN_SURNAMES.find(candidate => name.startsWith(candidate) && [...name].length > [...candidate].length) ?? "";
  return { surname, given: surname ? [...name].slice([...surname].length).join("") : name };
}

export function hasHangulBatchim(value: string) {
  const last = [...value].at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const jongseong = code % 28;
  return { hasBatchim: jongseong !== 0, isRieul: jongseong === 8 };
}

export function shouldInflectNameParticle(sourceName: string, targetName: string) {
  const sourceEnding = hasHangulBatchim(sourceName);
  const targetEnding = hasHangulBatchim(targetName);
  return Boolean(sourceEnding && targetEnding && sourceEnding.hasBatchim !== targetEnding.hasBatchim);
}

export function shouldAddCallingI(sourceName: string, targetName: string, isGivenName: boolean) {
  const sourceEnding = hasHangulBatchim(sourceName);
  const targetEnding = hasHangulBatchim(targetName);
  return Boolean(isGivenName && sourceEnding && targetEnding && !sourceEnding.hasBatchim && targetEnding.hasBatchim);
}

export function particleKind(particle: string) {
  const variablePart = VARIABLE_PARTICLE_NAMES.find(candidate => particle.startsWith(candidate));
  return variablePart ? VARIABLE_PARTICLES[variablePart] : undefined;
}

export function inflectParticle(particle: string, targetName: string) {
  const variablePart = VARIABLE_PARTICLE_NAMES.find(candidate => particle.startsWith(candidate));
  const kind = variablePart ? VARIABLE_PARTICLES[variablePart] : undefined;
  const ending = hasHangulBatchim(targetName);
  if (!kind || !ending) return particle;
  const withBatchim = ending.hasBatchim;
  const rest = particle.slice(variablePart.length);
  let changed = particle;
  switch (kind) {
    case "topic": changed = withBatchim ? "은" : "는"; break;
    case "subject": changed = withBatchim ? "이" : "가"; break;
    case "object": changed = withBatchim ? "을" : "를"; break;
    case "and": changed = withBatchim ? "과" : "와"; break;
    case "vocative": changed = withBatchim ? "아" : "야"; break;
    case "with": changed = withBatchim ? "이랑" : "랑"; break;
    case "instrumental": changed = withBatchim && !ending.isRieul ? "으로" : "로"; break;
    case "copula": {
      const base = variablePart.replace(/^이/, "");
      changed = withBatchim ? `이${base}` : base;
      break;
    }
  }
  return changed + rest;
}

export function isNameWordCharacter(character: string | undefined) {
  return Boolean(character && /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(character));
}

export function particleAt(text: string, offset: number) {
  return PARTICLE_SUFFIXES.find(particle => text.startsWith(particle, offset)
    && !isNameWordCharacter(text[offset + particle.length])) ?? "";
}

function affectionateNameParticleAt(text: string, offset: number, sourceName: string) {
  // A consonant-final name can be called with an extra "이" (미영이).
  // If another particle follows it, treat that first 이 as part of the name:
  // 미영이가 -> [미영이] + 가, 미영이의 -> [미영이] + 의.
  if (!hasHangulBatchim(sourceName)?.hasBatchim || !text.startsWith("이", offset)) return "";
  // Prefer established forms such as 이랑/이야 as a single ending.
  if (VARIABLE_PARTICLE_NAMES.some(particle => text.startsWith(particle, offset)
    && !isNameWordCharacter(text[offset + particle.length]))) return "";
  return particleAt(text, offset + 1);
}

export function replaceReaderNames(text: string, rules: NameReplacementRule[], shouldAdjustParticles = true) {
  const aliases = rules.flatMap(rule => [
    { from: rule.sourceFull, to: rule.targetFull, isGivenName: false },
    ...(rule.replaceGiven && rule.sourceGiven && rule.targetGiven ? [{ from: rule.sourceGiven, to: rule.targetGiven, isGivenName: true }] : []),
  ]).filter(alias => alias.from && alias.to).sort((a, b) => b.from.length - a.from.length);
  if (!aliases.length) return text;

  let result = "";
  let cursor = 0;
  while (cursor < text.length) {
    const before = text[cursor - 1] ?? "";
    const alias = !isNameWordCharacter(before) ? aliases.find(candidate => text.startsWith(candidate.from, cursor)) : undefined;
    if (alias) {
      const aliasEnd = cursor + alias.from.length;
      const affectionateParticle = shouldAdjustParticles
        ? affectionateNameParticleAt(text, aliasEnd, alias.from)
        : "";
      if (affectionateParticle) {
        result += alias.to + inflectParticle(affectionateParticle, alias.to);
        cursor = aliasEnd + 1 + affectionateParticle.length;
        continue;
      }

      const particle = particleAt(text, aliasEnd);
      // Keep the name replacement even when an ending is not recognized.
      // Only consume a suffix when it is confidently recognized as a particle.
      const addCallingI = shouldAdjustParticles && !particle
        && !isNameWordCharacter(text[aliasEnd])
        && shouldAddCallingI(alias.from, alias.to, alias.isGivenName);
      const adjustedParticle = particle && shouldAdjustParticles && shouldInflectNameParticle(alias.from, alias.to)
        ? inflectParticle(particle, alias.to)
        : particle;
      result += alias.to + adjustedParticle + (addCallingI ? "이" : "");
      cursor = aliasEnd + particle.length;
      continue;
    }
    result += text[cursor];
    cursor += 1;
  }
  return result;
}

export function nameOccurrences(text: string, alias: string, limit = 3) {
  if (!alias) return [] as string[];
  const snippets: string[] = [];
  let cursor = 0;
  while (snippets.length < limit) {
    const index = text.indexOf(alias, cursor);
    if (index < 0) break;
    const before = text[index - 1] ?? "";
    const after = text[index + alias.length] ?? "";
    if (!isNameWordCharacter(before) && (!isNameWordCharacter(after) || particleAt(text, index + alias.length))) {
      snippets.push(text.slice(Math.max(0, index - 18), Math.min(text.length, index + alias.length + 24)).replace(/\s+/g, " "));
    }
    cursor = index + alias.length;
  }
  return snippets;
}
