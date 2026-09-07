import type { FinancialAnalysisV2, FinancialMetricsComparisonSummary, FinancialStatementSnapshot } from "../contracts/financial-statements.ts";
import type { SourceEnvelope } from "../contracts/sources.ts";
import type { QuarterlyFinancialReport } from "../../quarterly-report.ts";
import { adaptCheckoBfo } from "./checko-bfo-adapter.ts";
import { adaptQuarterlyReport } from "./quarterly-adapter.ts";
import { buildFinancialAnalysis } from "./engine.ts";
import { compareFinancialMetrics } from "./comparison.ts";

export type FinancialShadowFields = {
  financialStatementsV2?: FinancialStatementSnapshot[];
  financialAnalysisV2?: FinancialAnalysisV2;
  financialMetricsComparison?: FinancialMetricsComparisonSummary;
  financialShadowWarnings?: string[];
};

// Failures in the additive shadow path never alter legacy processing/results.
export function checkoFinancialShadow(raw: unknown, source: SourceEnvelope | undefined, legacy: Record<string, unknown>): FinancialShadowFields {
  if (!source) return {};
  try {
    const snapshots = adaptCheckoBfo(raw, source);
    const analysis = buildFinancialAnalysis(snapshots);
    return { financialStatementsV2: snapshots, financialAnalysisV2: analysis, financialMetricsComparison: compareFinancialMetrics(analysis, legacy, "BFO") };
  } catch {
    return { financialShadowWarnings: ["FINANCIAL_SHADOW_SOURCE_UNAVAILABLE"] };
  }
}
export function quarterlyFinancialShadow(report: QuarterlyFinancialReport, source: SourceEnvelope, existing: FinancialStatementSnapshot[] = []): FinancialShadowFields {
  try {
    const snapshot = adaptQuarterlyReport(report, source);
    const snapshots = [...existing.filter(s => s.snapshotId !== snapshot.snapshotId), snapshot];
    const analysis = buildFinancialAnalysis(snapshots);
    return { financialStatementsV2: snapshots, financialAnalysisV2: analysis, financialMetricsComparison: compareFinancialMetrics(analysis, report.ratios, "QUARTERLY", snapshot.snapshotId), financialShadowWarnings: [] };
  } catch {
    // Clear stale shadow results; the authoritative report still succeeds.
    return { financialStatementsV2: undefined, financialAnalysisV2: undefined, financialMetricsComparison: undefined, financialShadowWarnings: ["FINANCIAL_SHADOW_SOURCE_UNAVAILABLE"] };
  }
}
