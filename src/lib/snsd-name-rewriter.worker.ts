import init, { TokenizerBuilder } from "lindera-wasm-web-ko-dic";
import {
  type NameReplacementRule,
  inflectParticle,
  isNameWordCharacter,
  particleAt,
  particleKind,
  shouldAddCallingI,
  shouldInflectNameParticle,
} from "./snsd-name-rewriter";

type LinderaToken = {
  surface?: string;
  partOfSpeechTag?: string;
  expression?: string;
};

type RewriteRequest = {
  requestId: number;
  paragraphs: string[];
  rules: NameReplacementRule[];
};

let tokenizerPromise: Promise<{ tokenize: (text: string) => LinderaToken[] }> | null = null;

function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      await init();
      const builder = new TokenizerBuilder();
      builder.setDictionary("embedded://ko-dic");
      builder.setKeepWhitespace(false);
      return builder.build();
    })();
  }
  return tokenizerPromise;
}

function analyzerRecognizesParticle(particle: string, tokens: LinderaToken[]) {
  const surfaces = tokens.map(token => token.surface ?? "");
  const suffixIndex = surfaces.findIndex(surface => surface === particle || surface.endsWith(particle));
  if (suffixIndex < 0) return false;

  const pos = tokens
    .slice(suffixIndex)
    .map(token => `${token.partOfSpeechTag ?? ""} ${token.expression ?? ""}`)
    .join(" ");
  const kind = particleKind(particle);
  if (kind === "topic") return /(?:^| )JX(?: |$)/u.test(pos);
  if (kind === "subject") return /(?:^| )JK[SCV](?: |$)/u.test(pos);
  if (kind === "object") return /(?:^| )JKO(?: |$)/u.test(pos);
  if (kind === "and" || kind === "with") return /(?:^| )JC(?: |$)/u.test(pos);
  if (kind === "instrumental") return /(?:^| )JKB(?: |$)/u.test(pos);
  if (kind === "vocative") return /(?:^| )JKV(?: |$)/u.test(pos);
  if (kind === "copula") return /VCP|XSN|EC|EF|UNA/u.test(pos);
  return false;
}

async function rewriteParagraph(
  paragraph: string,
  rules: NameReplacementRule[],
  tokenizer: { tokenize: (text: string) => LinderaToken[] },
) {
  const aliases = rules.flatMap(rule => [
    { from: rule.sourceFull, to: rule.targetFull, isGivenName: false },
    ...(rule.replaceGiven && rule.sourceGiven && rule.targetGiven
      ? [{ from: rule.sourceGiven, to: rule.targetGiven, isGivenName: true }]
      : []),
  ]).filter(alias => alias.from && alias.to).sort((a, b) => b.from.length - a.from.length);
  if (!aliases.length) return paragraph;

  let result = "";
  let cursor = 0;
  while (cursor < paragraph.length) {
    const before = paragraph[cursor - 1] ?? "";
    const alias = !isNameWordCharacter(before)
      ? aliases.find(candidate => paragraph.startsWith(candidate.from, cursor))
      : undefined;
    if (!alias) {
      result += paragraph[cursor];
      cursor += 1;
      continue;
    }

    const aliasEnd = cursor + alias.from.length;
    const particle = particleAt(paragraph, aliasEnd);
    if (!particle) {
      const addCallingI = !isNameWordCharacter(paragraph[aliasEnd])
        && shouldAddCallingI(alias.from, alias.to, alias.isGivenName);
      result += alias.to + (addCallingI ? "이" : "");
      cursor = aliasEnd;
      continue;
    }

    // Analyze only the name plus its attached ending. This keeps the WASM
    // work local and prevents unrelated prose from affecting the decision.
    const recognized = analyzerRecognizesParticle(particle, tokenizer.tokenize(`${alias.from}${particle}`));
    // Names configured by the reader can be nicknames or out-of-vocabulary
    // words, so Lindera may miss the vocative ending even when it is explicit.
    // particleAt already requires a boundary after the ending; trust 아/야 here.
    const shouldInflect = (recognized || particleKind(particle) === "vocative")
      && shouldInflectNameParticle(alias.from, alias.to);
    result += alias.to + (shouldInflect ? inflectParticle(particle, alias.to) : particle);
    cursor = aliasEnd + particle.length;
  }
  return result;
}

self.onmessage = async (event: MessageEvent<RewriteRequest>) => {
  const { requestId, paragraphs, rules } = event.data;
  try {
    const tokenizer = await getTokenizer();
    const rewritten = [];
    for (const paragraph of paragraphs) {
      rewritten.push(await rewriteParagraph(paragraph, rules, tokenizer));
    }
    self.postMessage({ requestId, paragraphs: rewritten });
  } catch {
    // The viewer keeps the synchronous fallback if WASM cannot initialize.
    self.postMessage({ requestId, paragraphs: null });
  }
};
