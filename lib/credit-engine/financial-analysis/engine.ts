import type { CurrentRatioExpression } from '../experimental/contracts.ts';
import { FINANCIAL_ANALYSIS_VERSION, type FinancialAnalysisV2, type FinancialMetricResult, type FinancialPeriodAnalysis, type FinancialStatementSnapshot, type FinancialTrend } from "../contracts/financial-statements.ts";
import { analyzeFinancialPeriod } from "./metrics.ts";
import { comparePeriods } from "./periods.ts";
import { weakest } from "./normalizer.ts";

const trendFields = ["REVENUE", "NET_PROFIT", "ASSETS_TOTAL", "EQUITY", "TOTAL_BORROWINGS", "RECEIVABLES", "INVENTORIES", "PAYABLES"];
function trend(current: FinancialPeriodAnalysis, previous: FinancialPeriodAnalysis | undefined, field: string, index: number): FinancialTrend {
  const comparability = comparePeriods(current.snapshot, previous?.snapshot);
  const comparable = comparability === "COMPARABLE_ANNUAL_YOY" || comparability === "COMPARABLE_INTERIM_YOY";
  const a = current.amounts[field], b = previous?.amounts[field];
  const known = comparable && a.value !== null && b?.value !== undefined && b.value !== null;
  const absolute = known ? a.value! - b!.value! : null;
  const signChange = known && a.value! * b!.value! < 0;
  const relative = known && b!.value! > 0 && !signChange ? (a.value! / b!.value! - 1) * 100 : null;
  const warnings = [...new Set([
    ...a.warnings, ...(b?.warnings ?? []),
    ...(!comparable ? ["PERIOD_NOT_COMPARABLE"] : []),
    ...(comparable && !known ? ["SOURCE_FIELD_MISSING"] : []),
  ])];
  const result = (value: number | null, relativeMetric: boolean): FinancialMetricResult => {
    const more = relativeMetric && known ? signChange ? ["SIGN_CHANGE_RELATIVE_GROWTH_NOT_MEANINGFUL"] : b!.value === 0 ? ["ZERO_DENOMINATOR"] : b!.value! < 0 ? ["NON_POSITIVE_BASE_RELATIVE_GROWTH_NOT_MEANINGFUL"] : [] : [];
    const finite = value !== null && Number.isFinite(value) ? value : null;
    return {
      code: `FSM-TREND-${String(index * 2 + (relativeMetric ? 2 : 1)).padStart(3, "0")}`,
      version: FINANCIAL_ANALYSIS_VERSION, value: finite, unit: relativeMetric ? "PERCENT" : "RUB", origin: "DERIVED",
      status: finite !== null ? "KNOWN" : known ? "NOT_APPLICABLE" : "UNKNOWN",
      confidence: finite === null ? "UNKNOWN" : weakest(a.confidence, b!.confidence, current.snapshot.period.confidence, previous!.snapshot.period.confidence),
      periodFrom: current.snapshot.period.from, periodTo: current.snapshot.period.to, asOf: current.snapshot.period.asOf,
      calculationBasis: relativeMetric ? "(current / positive prior-year comparable value - 1) * 100; no relative growth through zero or from non-positive base" : "Current minus prior-year comparable value; annual and interim flows never mixed",
      dependencies: [`${current.snapshot.snapshotId}:${field}`, ...(previous ? [`${previous.snapshot.snapshotId}:${field}`] : [])],
      sourceIds: [...new Set([...a.sourceIds, ...(b?.sourceIds ?? [])])], warnings: [...warnings, ...more, ...(value !== null && finite === null ? ["NON_FINITE_RESULT"] : [])],
    };
  };
  return { metric: field, currentSnapshotId: current.snapshot.snapshotId, previousSnapshotId: previous?.snapshot.snapshotId ?? null, comparability, absoluteChange: result(absolute, false), relativeChange: result(relative, true) };
}

export function buildFinancialAnalysis(snapshots: FinancialStatementSnapshot[], currentRatio?: CurrentRatioExpression): FinancialAnalysisV2 {
  if (new Set(snapshots.map(s => s.companyInn)).size > 1) throw new Error("FINANCIAL_COMPANY_MISMATCH");
  if (new Set(snapshots.map(s => s.snapshotId)).size !== snapshots.length) throw new Error("DUPLICATE_FINANCIAL_SNAPSHOT");
  const ordered = [...snapshots].sort((a, b) => (a.period.asOf ?? "").localeCompare(b.period.asOf ?? "") || a.snapshotId.localeCompare(b.snapshotId));
  const warnings: string[] = [];
  const history = ordered.map(s => {
    const opening = ordered.filter(p => p.snapshotId !== s.snapshotId && p.companyInn === s.companyInn && p.accountingStandard === s.accountingStandard && p.period.asOf && s.period.from && Date.parse(s.period.from) - Date.parse(p.period.asOf) === 86_400_000);
    if (opening.length > 1) warnings.push("AMBIGUOUS_OPENING_BALANCE");
    return analyzeFinancialPeriod(s, opening.length === 1 ? opening[0] : undefined, currentRatio);
  });
  const trends = history.flatMap(current => {
    const matches = history.filter(p => ["COMPARABLE_ANNUAL_YOY", "COMPARABLE_INTERIM_YOY"].includes(comparePeriods(current.snapshot, p.snapshot)));
    if (matches.length > 1) warnings.push("AMBIGUOUS_PRIOR_PERIOD");
    // A non-comparable previous period is kept for diagnostics, never for growth.
    const prior = matches.length === 1 ? matches[0] : matches.length > 1 ? undefined : history.filter(p => (p.snapshot.period.asOf ?? "") < (current.snapshot.period.asOf ?? "")).at(-1);
    return trendFields.map((field, i) => trend(current, prior, field, i));
  });
  const annual = history.filter(p => p.snapshot.period.kind === "ANNUAL"), interim = history.filter(p => p.snapshot.period.kind === "INTERIM");
  return {
    version: FINANCIAL_ANALYSIS_VERSION, mode: "SHADOW", sources: [...new Map(ordered.map(s => [s.sourceId, s.source])).values()],
    latestAnnual: annual.at(-1), latestInterim: interim.at(-1), history, trends,
    quality: { annualHistoryYears: new Set(annual.map(p => p.snapshot.period.year)).size, interimPeriods: interim.length, warnings: [...new Set([...warnings, ...history.flatMap(p => p.quality.warnings)])] },
  };
}
