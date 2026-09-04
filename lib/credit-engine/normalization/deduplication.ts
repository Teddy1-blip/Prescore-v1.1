import type { CanonicalTransaction } from "../contracts/transactions.ts";

export const EXACT_DUPLICATE_RULE = "account+documentId+date+amount+currency+direction+counterpartyInn+normalizedPurpose";
export const PROBABLE_DUPLICATE_RULE = "cross-source+date+amount+currency+direction+counterparty+similarPurpose";

function normalized(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function exactFingerprint(item: CanonicalTransaction) {
  return [item.companyAccount, item.bankDocumentId, item.date, item.amount, item.currency, item.direction, item.counterparty.innNormalized, normalized(item.purposeNormalized)].join("|");
}

function probableFingerprint(item: CanonicalTransaction) {
  return [item.date, item.amount, item.currency, item.direction, item.counterparty.innNormalized || item.counterparty.nameNormalized].join("|");
}

function similarPurpose(left: string | null, right: string | null) {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return a === b;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aTokens = new Set(a.split(/[^а-яa-z0-9]+/i).filter((item) => item.length > 2));
  const bTokens = new Set(b.split(/[^а-яa-z0-9]+/i).filter((item) => item.length > 2));
  const intersection = [...aTokens].filter((item) => bTokens.has(item)).length;
  return intersection / Math.max(1, Math.min(aTokens.size, bTokens.size)) >= 0.8;
}

export type DeduplicationCandidate = {
  retainedId: string;
  duplicateId: string;
  rule: string;
  sourceRefs: string[];
};

export function deduplicateTransactions(items: CanonicalTransaction[]) {
  const retained: CanonicalTransaction[] = [];
  const exact = new Map<string, CanonicalTransaction>();
  const probable = new Map<string, CanonicalTransaction[]>();
  const candidates: DeduplicationCandidate[] = [];
  let candidatesTruncated = false;
  let exactDuplicateCount = 0;
  let probableDuplicateCount = 0;
  const record = (candidate: DeduplicationCandidate) => {
    if (candidates.length < 25) candidates.push(candidate);
    else candidatesTruncated = true;
  };

  for (const original of items) {
    const exactKey = exactFingerprint(original);
    const priorExact = exact.get(exactKey);
    if (priorExact) {
      original.duplicateStatus = "EXACT";
      original.duplicateOfTransactionId = priorExact.transactionId;
      exactDuplicateCount += 1;
      record({
        retainedId: priorExact.transactionId,
        duplicateId: original.transactionId,
        rule: EXACT_DUPLICATE_RULE,
        sourceRefs: [...new Set([priorExact.sourceFileName, original.sourceFileName])],
      });
      continue;
    }

    const probableKey = probableFingerprint(original);
    const priorProbable = (probable.get(probableKey) ?? []).find((candidate) =>
      candidate.sourceId !== original.sourceId &&
      !(candidate.bankDocumentId && original.bankDocumentId && candidate.bankDocumentId === original.bankDocumentId) &&
      similarPurpose(candidate.purposeNormalized, original.purposeNormalized));
    if (priorProbable) {
      original.duplicateStatus = "PROBABLE";
      original.duplicateOfTransactionId = priorProbable.transactionId;
      probableDuplicateCount += 1;
      record({
        retainedId: priorProbable.transactionId,
        duplicateId: original.transactionId,
        rule: PROBABLE_DUPLICATE_RULE,
        sourceRefs: [...new Set([priorProbable.sourceFileName, original.sourceFileName])],
      });
    }
    retained.push(original);
    exact.set(exactKey, original);
    const group = probable.get(probableKey) ?? [];
    group.push(original);
    probable.set(probableKey, group);
  }

  return { retained, candidates, candidatesTruncated, exactDuplicateCount, probableDuplicateCount };
}
