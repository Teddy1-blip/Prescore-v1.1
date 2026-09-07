import { RECONCILIATION_VERSION, type ReconciliationConfidence as Confidence, type ReconciliationFact as Fact, type ReconciliationFinding as Finding, type ReconciliationNature, type ReconciliationOutcome, type ReconciliationComparability } from "../contracts/reconciliation.ts";
import type { SourceEnvelope } from "../contracts/sources.ts";

const levels: Confidence[] = ["UNKNOWN", "LOW", "MEDIUM", "HIGH"];
export const weakest = (...values: Confidence[]): Confidence => values.length ? levels[Math.min(...values.map(v => Math.max(0, levels.indexOf(v))))] : "UNKNOWN";
export const numericConfidence = (value: number | null | undefined): Confidence => value == null || !Number.isFinite(value) ? "UNKNOWN" : value >= 80 ? "HIGH" : value >= 60 ? "MEDIUM" : "LOW";
export const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const known = (f: Fact | undefined): f is Fact & { value: number } => Boolean(f && f.status === "KNOWN" && finite(f.value));
export const stableId = (...parts: unknown[]) => JSON.stringify(parts);
export const unique = (values: string[]) => [...new Set(values)].sort();
export function sourceBound(fact: Fact, sources: SourceEnvelope[]): Fact {
  const unavailable = !sources.length || sources.some(s => s.status !== "READY" && s.status !== "STALE");
  const stale = sources.some(s => s.status === "STALE");
  const invalid = fact.value === null || (typeof fact.value === "number" && !finite(fact.value));
  return { ...fact, sourceIds: unique(fact.sourceIds), value: unavailable || invalid ? null : fact.value,
    status: unavailable || invalid ? "UNKNOWN" : fact.status,
    confidence: unavailable || invalid ? "UNKNOWN" : weakest(fact.confidence, ...sources.map(s => numericConfidence(s.confidence)), stale ? "MEDIUM" : "HIGH"),
    warnings: unique([...fact.warnings, ...sources.flatMap(s => s.warnings), ...(unavailable ? ["SOURCE_NOT_READY"] : []), ...(stale ? ["SOURCE_STALE"] : []), ...(invalid ? ["SOURCE_FIELD_UNKNOWN", "MISSING_NOT_ZERO"] : [])]) };
}
export function finding(code: string, nature: ReconciliationNature, left: Fact[], right: Fact[], outcome: ReconciliationOutcome, comparability: ReconciliationComparability, reasons: string[], basis: string, gap: number | null = null): Finding {
  const numeric = !["NOT_COMPARABLE", "INSUFFICIENT_DATA", "SOURCE_MISSING"].includes(outcome) && known(left[0]) && known(right[0]);
  const a = numeric ? left[0].value as number : null, b = numeric ? right[0].value as number : null;
  const difference = a !== null && b !== null ? Math.abs(a - b) : null;
  const ratio = a !== null && b !== null && b > 0 ? a / b : null;
  const relative = difference !== null && b !== null && b !== 0 ? difference / Math.abs(b) : null;
  const overflow = [difference, ratio, relative].some(v => v !== null && !finite(v));
  return { findingId: stableId(code, left.map(f => f.factId), right.map(f => f.factId)), code, version: RECONCILIATION_VERSION,
    domain: code.split("-").slice(0, 2).join("-"), nature, outcome, comparability,
    direction: a === null || b === null ? "NOT_APPLICABLE" : a > b ? "LEFT_ABOVE_RIGHT" : a < b ? "LEFT_BELOW_RIGHT" : "EQUAL",
    leftFacts: left, rightFacts: right, absoluteDifference: finite(difference) ? difference : null,
    relativeDifference: finite(relative) ? relative : null, ratio: finite(ratio) ? ratio : null, temporalGapDays: gap,
    evidenceConfidence: weakest(...[...left, ...right].map(f => f.confidence)), requiresDataReview: outcome === "CONFLICT",
    calculationBasis: basis, reasonCodes: unique([...reasons, ...(numeric && b === 0 ? ["ZERO_DENOMINATOR"] : []), ...(overflow ? ["NON_FINITE_RESULT"] : [])]),
    warnings: unique([...left, ...right].flatMap(f => f.warnings)) };
}
export function scopeReason(companyInn: string, facts: Fact[]): string | null {
  if (facts.some(f => f.companyInn && f.companyInn !== companyInn)) return "COMPANY_IDENTITY_CONFLICT";
  for (const f of facts) {
    if (f.sourceType !== "BKI") continue;
    if (f.affectsCompanyDebt === false) return "BKI_DOES_NOT_AFFECT_COMPANY_DEBT";
    if (!["COMPANY", "IP"].includes(f.entityScope) || f.affectsCompanyDebt !== true) return "BKI_SUBJECT_SCOPE_NOT_COMPANY";
    if (!f.subjectInn) return "BKI_SUBJECT_IDENTITY_UNKNOWN";
    if (f.subjectInn !== companyInn) return "COMPANY_IDENTITY_CONFLICT";
  }
  return facts.some(f => !f.companyInn) ? "COMPANY_IDENTITY_UNKNOWN" : null;
}
