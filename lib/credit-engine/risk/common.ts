import type { RiskFact, RiskConfidence, RiskDataset, RiskRuleEvaluationResult, RiskThreshold } from "../contracts/risk.ts";
import { RISK_METHODOLOGY } from "../contracts/risk.ts";
// Reuse deterministic scalar/value primitives without changing the portfolio engine.
export { id, stable, validDate, finite, unique, weakest, adequate } from "../credit-portfolio/common.ts";
import { id, validDate, finite, weakest, adequate } from "../credit-portfolio/common.ts";
// Explicit adapter freshness limits; data applicability, never credit policy.
export const RISK_SOURCE_FRESHNESS_DAYS = Object.freeze({ legal: 30, bank: 90, bki: 90, annual: 550, interim: 270, newObligation: 90 });
export const FACT_UNITS: Readonly<Record<string, RiskFact["unit"]>> = Object.freeze({
  FIN_EQUITY: "RUB", FIN_REPORTED_NET_ASSETS: "RUB", FIN_NET_ASSETS_PROXY: "RUB", FIN_CURRENT_ASSETS: "RUB", FIN_WORKING_CAPITAL: "RUB", FIN_ANNUAL_NET_PROFIT: "RUB", FIN_PRIOR_ANNUAL_NET_PROFIT: "RUB", FIN_ANNUAL_REVENUE: "RUB",
  FIN_CURRENT_RATIO: "RATIO", FIN_INTEREST_COVERAGE: "RATIO", FIN_ANNUAL_REVENUE_CHANGE: "PERCENT", FIN_CONSECUTIVE_ANNUAL_LOSSES: "COUNT",
  BANK_DEBT_SERVICE_RATIO: "RATIO", BANK_TOP1: "RATIO", BANK_CONCENTRATION_COVERAGE: "RATIO", BANK_IDENTITY_COVERAGE: "RATIO", BANK_INTERMEDIATED_SHARE: "RATIO", BANK_UNCLEAR_CASH_SHARE: "RATIO", BANK_UNKNOWN_INFLOW_SHARE: "RATIO", BANK_LOW_LIQUIDITY_SHARE: "RATIO", BANK_OPERATING_TREND: "PERCENT", BANK_NEGATIVE_RECONSTRUCTED_DAYS: "DAYS", BANK_COVERAGE_ADEQUATE: "BOOLEAN",
  LEGAL_LIFECYCLE: "TEXT", LEGAL_ADDRESS_UNRELIABLE: "BOOLEAN", LEGAL_ACTIVE_ENFORCEMENT_AMOUNT: "RUB", LEGAL_ENFORCEMENT_REVENUE_RATIO: "RATIO", BKI_OVERDUE: "RUB", BKI_HISTORY_DAYS: "DAYS",
});
export const threshold = (operator: RiskThreshold["operator"], value: number | string | null, methodology = RISK_METHODOLOGY): RiskThreshold => ({ operator, value, methodology });
export function fact(companyInn: string, semanticCode: string, domain: RiskFact["domain"], value: RiskFact["value"], extras: Partial<RiskFact> = {}): RiskFact {
  const f: RiskFact = { factId: "", semanticCode, domain, companyInn, value, unit: FACT_UNITS[semanticCode] ?? (typeof value === "boolean" ? "BOOLEAN" : typeof value === "number" ? "COUNT" : "TEXT"), status: value == null ? "UNKNOWN" : "KNOWN", confidence: value == null ? "UNKNOWN" : "HIGH",
    period: { from: null, to: null, asOf: null }, origin: "REPORTED", sourceTypes: [], sourceIds: [], evidence: [], calculationBasis: semanticCode, warnings: [], ...extras };
  if (typeof f.value === "number" && !finite(f.value)) { f.value = null; f.status = "UNKNOWN"; f.confidence = "UNKNOWN"; f.warnings = [...f.warnings, "NON_FINITE_VALUE"]; }
  if (f.status === "UNKNOWN" || f.status === "NOT_APPLICABLE") f.value = null;
  f.factId = extras.factId ?? id("risk-fact", companyInn, semanticCode, f.portfolioObligationId ?? f.subjectKey, f.period, f.sourceIds, f.value, f.status);
  if (!f.evidence.length) f.evidence = [{ evidenceId: id("risk-evidence", f.factId), sourceId: f.sourceIds[0] ?? null, sourceType: f.sourceTypes[0] ?? null,
    metricCode: f.sourceMetricCode ?? null, factCode: semanticCode, portfolioObligationId: f.portfolioObligationId ?? null, reconciliationFindingId: f.sourceFindingId ?? null,
    value: f.value, unit: f.unit, periodFrom: f.period.from, periodTo: f.period.to, asOf: f.period.asOf, confidence: f.confidence, calculationBasis: f.calculationBasis }];
  f.confidence = weakest(f.confidence, ...f.evidence.map(e => e.confidence)); return f;
}
export function get(d: RiskDataset, code: string): RiskFact | undefined {
  const items = (d.byCode.get(code) ?? []).filter(f => !d.obligationId || (f.portfolioObligationId ?? f.subjectKey) === d.obligationId);
  if (items.length !== 1) return undefined; return items[0];
}
export const usable = (f?: RiskFact): f is RiskFact & { value: NonNullable<RiskFact["value"]> } => !!f && f.status === "KNOWN" && f.value !== null && adequate(f.confidence) && !f.warnings.includes("DATA_CONFLICT");
export const result = (status: RiskRuleEvaluationResult["status"], facts: Array<RiskFact | undefined>, reasonCodes: string[] = []): RiskRuleEvaluationResult => ({ status, facts: facts.filter((f): f is RiskFact => !!f), reasonCodes });
export const missing = (facts: Array<RiskFact | undefined>, reasons = ["INSUFFICIENT_DATA", "MISSING_NOT_ZERO"]) => result(facts.some(f => f?.status === "NOT_APPLICABLE") ? "NOT_APPLICABLE" : "INSUFFICIENT_DATA", facts, reasons);
export function freshness(date: string | null | undefined, asOf: string, maxDays: number): boolean { return validDate(date) && validDate(asOf) && date <= asOf && (Date.parse(asOf) - Date.parse(date)) / 86400000 <= maxDays; }
export function sourceConfidence(n: number | null | undefined): RiskConfidence { return finite(n) ? n >= 85 ? "HIGH" : n >= 60 ? "MEDIUM" : "LOW" : "UNKNOWN"; }
