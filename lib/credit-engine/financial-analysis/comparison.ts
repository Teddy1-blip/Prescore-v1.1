import { FINANCIAL_ANALYSIS_VERSION, type FinancialAnalysisV2, type FinancialMetricResult, type FinancialMetricsComparisonSummary } from "../contracts/financial-statements.ts";

export function compareFinancialMetrics(analysis: FinancialAnalysisV2, legacy: Record<string, unknown>, sourceType: "BFO" | "QUARTERLY", snapshotId?: string): FinancialMetricsComparisonSummary {
  const period = snapshotId ? analysis.history.find(p => p.snapshot.snapshotId === snapshotId) : analysis.history.filter(p => p.snapshot.sourceType === sourceType).at(-1);
  if (!period) return { version: FINANCIAL_ANALYSIS_VERSION, comparisons: [] };
  const { liquidity: l, capitalStructure: c, profitability: p, composition: a } = period;
  const revenueTrend = analysis.trends.find(t => t.currentSnapshotId === period.snapshot.snapshotId && t.metric === "REVENUE");
  const mappings: Array<[string, FinancialMetricResult | undefined, number]> = sourceType === "BFO" ? [
    ["currentLiquidity", l.currentRatio, 1], ["autonomy", c.equityRatio, 100], ["returnOnSales", p.netMargin, 100],
    ["workingCapital", l.netWorkingCapital, 1], ["debtToEquity", c.debtToEquity, 1],
    ["interestCoverage", p.interestCoverageOperatingProfit, 1], ["revenueGrowth", revenueTrend?.relativeChange, 1],
  ] : [
    ["currentLiquidity", l.currentRatio, 1], ["autonomy", c.equityRatio, 100],
    ["receivablesToAssets", a.RECEIVABLES_TO_ASSETS, 1], ["payablesToRevenue", a.PAYABLES_TO_REVENUE, 1], ["netWorkingCapital", l.netWorkingCapital, 1],
  ];
  return { version: FINANCIAL_ANALYSIS_VERSION, comparisons: mappings.map(([name, metric, multiplier]) => {
    const raw = legacy[name];
    const legacyValue = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const scaled = metric?.value === null || metric?.value === undefined ? null : metric.value * multiplier;
    const v2Value = scaled !== null && Number.isFinite(scaled) ? scaled : null;
    const reasons = new Set(metric?.warnings ?? ["SOURCE_FIELD_MISSING"]);
    const unknownChanged = legacyValue !== null && v2Value === null;
    if (unknownChanged && reasons.has("SOURCE_FIELD_MISSING")) reasons.add("MISSING_NOT_ZERO");
    const definitionChanged = unknownChanged || name === "revenueGrowth" || (name === "debtToEquity" && metric?.warnings.includes("SOURCE_FIELD_MISSING") === true);
    if (definitionChanged) reasons.add("DEFINITION_CHANGED");
    if (name === "revenueGrowth" && analysis.quality.annualHistoryYears > 1) reasons.add("MULTI_YEAR_HISTORY_USED");
    const difference = legacyValue === null || v2Value === null ? null : v2Value - legacyValue;
    const absoluteDiff = difference !== null && Number.isFinite(difference) ? difference : null;
    const relative = absoluteDiff === null || legacyValue === null || legacyValue <= 0 || v2Value! * legacyValue < 0 ? null : absoluteDiff / legacyValue;
    const relativeDiff = relative !== null && Number.isFinite(relative) ? relative : null;
    if ((scaled !== null && v2Value === null) || (difference !== null && absoluteDiff === null) || (relative !== null && relativeDiff === null)) reasons.add("NON_FINITE_RESULT");
    return { metric: name, sourceId: period.snapshot.sourceId, snapshotId: period.snapshot.snapshotId, legacyValue, v2Value, absoluteDiff, relativeDiff, definitionChanged, reasonCodes: [...reasons] };
  }) };
}
