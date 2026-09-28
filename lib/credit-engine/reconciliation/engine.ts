import { RECONCILIATION_VERSION, type ReconciliationDataset, type ReconciliationRule, type CrossSourceReconciliationV1, type ReconciliationInput } from "../contracts/reconciliation.ts";
import { buildFacts } from "./facts.ts";
import { finding, unique, weakest } from "./common.ts";
import { identityRule } from "./rules/identity.ts";
import { financialSameFactRule } from "./rules/financial-same-fact.ts";
import { bankRevenueRule } from "./rules/bank-vs-revenue.ts";
import { bankCashRule } from "./rules/bank-vs-cash.ts";
import { bkiBorrowingsRule } from "./rules/bki-vs-borrowings.ts";
import { bkiDebtServiceRule } from "./rules/bki-vs-debt-service.ts";

export const defaultRules: readonly ReconciliationRule[] = Object.freeze([identityRule, financialSameFactRule, bankRevenueRule, bankCashRule, bkiBorrowingsRule, bkiDebtServiceRule]);
// Registry injection is the extension point for EIS and future canonical fact families.
export function reconcileFacts(input: ReconciliationDataset, rules: readonly ReconciliationRule[] = defaultRules): CrossSourceReconciliationV1 {
  if (new Set(rules.map(r => r.code)).size !== rules.length) throw new Error("DUPLICATE_RECONCILIATION_RULE");
  const data = { ...input, facts: [...input.facts].sort((a, b) => a.factId.localeCompare(b.factId)) };
  const findings = rules.flatMap(rule => rule.evaluate(data));
  const present = [...new Set(data.facts.map(f => f.sourceType))].sort();
  for (const sourceType of ["BANK_STATEMENT", "BFO", "QUARTERLY", "BKI"] as const) {
    if (!present.includes(sourceType)) findings.push(finding(`REC-SOURCE-${sourceType}`, "SOURCE_COVERAGE", [], [], "SOURCE_MISSING", "NONE", ["SOURCE_MISSING"], `${sourceType} unavailable; no credit inference`));
  }
  findings.sort((a, b) => a.findingId.localeCompare(b.findingId));
  const count = (outcome: string) => findings.filter(f => f.outcome === outcome).length;
  const ids = (types: string[]) => unique(data.facts.filter(f => types.includes(f.sourceType)).flatMap(f => f.sourceIds));
  return { version: RECONCILIATION_VERSION, mode: "SHADOW", companyInn: data.companyInn,
    sources: { bankStatementSourceIds: ids(["BANK_STATEMENT"]), financialSourceIds: ids(["BFO", "QUARTERLY"]), bkiSourceIds: ids(["BKI"]), sourceTypesPresent: present },
    facts: data.facts, findings, summary: { evaluatedRuleCount: rules.length, agreementCount: count("AGREES"), withinToleranceCount: count("WITHIN_TOLERANCE"),
      conflictCount: count("CONFLICT"), relationshipCount: count("RELATIONSHIP_OBSERVED"), notComparableCount: count("NOT_COMPARABLE"), insufficientDataCount: count("INSUFFICIENT_DATA"), sourceMissingCount: count("SOURCE_MISSING"),
      dataReviewRequiredCount: findings.filter(f => f.requiresDataReview).length, sourceFamilyCount: present.length,
      confidence: weakest(...findings.filter(f => !["SOURCE_MISSING", "NOT_COMPARABLE"].includes(f.outcome)).map(f => f.evidenceConfidence)), warnings: unique(findings.flatMap(f => f.warnings)) } };
}
export const buildReconciliation = (input: ReconciliationInput, rules: readonly ReconciliationRule[] = defaultRules) => reconcileFacts(buildFacts(input), rules);
