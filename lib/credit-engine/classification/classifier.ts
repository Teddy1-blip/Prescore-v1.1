import type { CanonicalTransaction } from "../contracts/transactions.ts";
import {
  ECONOMIC_CLASSIFICATION_VERSION,
  type ClassificationContext,
  type ClassificationSummary,
  type LegacyClassificationDiff,
  type TransactionClassification,
} from "../contracts/classification.ts";
import { buildTransactionSignals } from "./signals.ts";
import { CLASSIFICATION_RULE_REGISTRY } from "./registry.ts";
import { evaluateRule } from "./rules/core-rules.ts";
import { resolveClassification } from "./resolver.ts";
import { compareWithLegacy } from "./legacy-comparison.ts";

export function classifyEconomicTransaction(tx: CanonicalTransaction, context: ClassificationContext = {}): TransactionClassification {
  const signals = buildTransactionSignals(tx);
  const candidates = CLASSIFICATION_RULE_REGISTRY
    .map((rule) => evaluateRule(rule, tx, signals, context))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const classification = resolveClassification(candidates, tx, signals, context);
  const contextualTags = [
    ...(signals.isRelatedParty ? ["RELATED_PARTY" as const] : []),
    ...(signals.isReversalCandidate ? ["REVERSAL_CANDIDATE" as const] : []),
    ...(signals.isOwnAccount ? ["OWN_ACCOUNT" as const] : []),
    ...(signals.isFinancialInstitution ? ["FINANCIAL_INSTITUTION" as const] : []),
    ...(signals.isIndividualCounterparty ? ["INDIVIDUAL_COUNTERPARTY" as const] : []),
  ];
  return compareWithLegacy({ ...classification, tags: [...new Set([...classification.tags, ...contextualTags])] }, context.legacyCategory);
}

export function summarizeClassifications(items: Array<{ transaction: CanonicalTransaction; classification: TransactionClassification }>, diffLimit = 25): ClassificationSummary {
  const categoryCounts: Record<string, number> = {};
  for (const { classification } of items) categoryCounts[classification.primaryCategory] = (categoryCounts[classification.primaryCategory] ?? 0) + 1;
  const diffs: LegacyClassificationDiff[] = items
    .filter(({ classification }) => classification.legacyDiff)
    .sort((left, right) => (right.transaction.amount ?? 0) - (left.transaction.amount ?? 0))
    .map(({ transaction, classification }) => ({
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      purpose: transaction.purposeRaw,
      legacyCategory: classification.legacyCategory ?? "",
      newCategory: classification.primaryCategory,
      confidence: classification.confidence,
      ruleCode: classification.ruleCode,
      evidence: classification.evidence.slice(0, 6),
    }));
  const unknown = items.filter(({ classification }) => classification.family === "UNKNOWN").length;
  const warnings = [
    ...(unknown ? [`UNKNOWN_CLASSIFICATIONS:${unknown}`] : []),
    ...(diffs.length > diffLimit ? [`LEGACY_DIFFS_TRUNCATED:${diffs.length - diffLimit}`] : []),
  ];
  return {
    version: ECONOMIC_CLASSIFICATION_VERSION,
    total: items.length,
    highConfidence: items.filter(({ classification }) => classification.confidence === "HIGH").length,
    mediumConfidence: items.filter(({ classification }) => classification.confidence === "MEDIUM").length,
    lowConfidence: items.filter(({ classification }) => classification.confidence === "LOW").length,
    unknown,
    legacyDiffCount: diffs.length,
    categoryCounts,
    reviewRequiredCount: items.filter(({ classification }) => classification.requiresReview).length,
    warnings,
    materialDiffs: diffs.slice(0, diffLimit),
    diffsTruncated: diffs.length > diffLimit || undefined,
  };
}
