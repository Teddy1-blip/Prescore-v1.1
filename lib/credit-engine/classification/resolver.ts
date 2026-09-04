import type { CanonicalTransaction } from "../contracts/transactions.ts";
import type { ClassificationCandidate, ClassificationContext, TransactionClassification, TransactionSignals } from "../contracts/classification.ts";
import { ECONOMIC_CLASSIFICATION_VERSION } from "../contracts/classification.ts";

const confidenceRank = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 } as const;

export function resolveClassification(candidates: ClassificationCandidate[], tx: CanonicalTransaction, signals: TransactionSignals, context: ClassificationContext): TransactionClassification {
  const ordered = [...candidates].sort((left, right) =>
    right.priority - left.priority || confidenceRank[right.confidence] - confidenceRank[left.confidence] || left.ruleCode.localeCompare(right.ruleCode));
  const selected = ordered[0];
  if (!selected) throw new Error(`Classification registry returned no fallback for ${tx.transactionId}`);
  const alternatives = ordered.slice(1, 6);
  const competing = alternatives.find((item) =>
    item.family !== selected.family && confidenceRank[item.confidence] >= confidenceRank.MEDIUM && item.priority >= 500);
  const ambiguityReasons = [...selected.ambiguityReasons];
  let confidence = selected.confidence;
  let requiresReview = selected.requiresReview;
  if (competing) {
    ambiguityReasons.push(`CONFLICTING_CANDIDATE:${competing.category}`);
    if (confidence === "HIGH") confidence = "MEDIUM";
    requiresReview = true;
  }
  if ((tx.amount ?? 0) >= (context.materialityThreshold ?? 1_000_000) && (selected.family === "UNKNOWN" || confidence === "LOW")) {
    ambiguityReasons.push("MATERIAL_TRANSACTION_REQUIRES_REVIEW");
    requiresReview = true;
  }
  return {
    version: ECONOMIC_CLASSIFICATION_VERSION,
    family: selected.family,
    primaryCategory: selected.category,
    confidence,
    ruleCode: selected.ruleCode,
    evidence: [...selected.evidence, ...selected.negativeEvidence],
    alternatives,
    tags: [...new Set(selected.tags)],
    requiresReview,
    ambiguityReasons: [...new Set(ambiguityReasons)],
    ...(selected.components ? { components: selected.components } : {}),
  };
}
