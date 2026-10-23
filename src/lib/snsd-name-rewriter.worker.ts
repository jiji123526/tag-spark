import { type NameReplacementRule, replaceReaderNames } from "./snsd-name-rewriter";

type RewriteRequest = {
  requestId: number;
  paragraphs: string[];
  rules: NameReplacementRule[];
};

self.onmessage = (event: MessageEvent<RewriteRequest>) => {
  const { requestId, paragraphs, rules } = event.data;
  self.postMessage({
    requestId,
    paragraphs: paragraphs.map(paragraph => replaceReaderNames(paragraph, rules)),
  });
};
