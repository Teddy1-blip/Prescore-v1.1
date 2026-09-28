import type { SourceEnvelope, SourceType, AnalysisSourceManifest, AnalysisIntegritySummary, MonthCoverageStatus } from "./sources.ts";
import type { BankStatementMetricsV2 } from "./metrics.ts";
import type { FinancialAnalysisV2, FinancialStatementSnapshot } from "./financial-statements.ts";
import type { CreditHistoryReport } from "../../credit-history.ts";

export const RECONCILIATION_VERSION = "PRESCORE-CROSS-SOURCE-RECONCILIATION-1.0.0-SHADOW";
export type ReconciliationFactStatus = "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE";
export type ReconciliationConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type ReconciliationEntityScope = "COMPANY" | "IP" | "OWNER" | "GUARANTOR" | "DIRECTOR" | "OTHER" | "UNKNOWN";
export type ReconciliationFact = {
  factId: string; semanticCode: string; sourceType: SourceType; sourceIds: string[];
  companyInn: string; subjectInn: string | null; entityScope: ReconciliationEntityScope; affectsCompanyDebt: boolean | null;
  value: number | string | null; unit: "RUB" | "RATIO" | "PERCENT" | "COUNT" | "TEXT";
  status: ReconciliationFactStatus; confidence: ReconciliationConfidence;
  period: { kind: "FLOW" | "SNAPSHOT" | "IDENTITY" | "UNKNOWN"; from: string | null; to: string | null; asOf: string | null };
  calculationBasis: string; sourceMetricCode?: string; rawCode?: string; rawLabel?: string; warnings: string[];
  // Adapter context, never provider-specific payloads.
  groupId?: string; sourceScale?: number | null; accountingStandard?: string;
  coverage?: MonthCoverageStatus; origin?: "REPORTED" | "DERIVED" | "PROXY";
  dependencyFactIds?: string[];
};
export type ReconciliationNature = "IDENTITY" | "SAME_FACT" | "CASH_VS_ACCRUAL" | "STOCK_VS_STOCK" | "SCHEDULED_VS_OBSERVED" | "FLOW_VS_STOCK" | "SOURCE_COVERAGE";
export type ReconciliationOutcome = "AGREES" | "WITHIN_TOLERANCE" | "CONFLICT" | "RELATIONSHIP_OBSERVED" | "NOT_COMPARABLE" | "INSUFFICIENT_DATA" | "SOURCE_MISSING";
export type ReconciliationComparability = "EXACT_PERIOD" | "EXACT_ASOF" | "NEAR_ASOF" | "FULL_MONTH_ALIGNED" | "PARTIAL" | "NONE";
export type ReconciliationFinding = {
  findingId: string; code: string; version: string; domain: string; nature: ReconciliationNature;
  outcome: ReconciliationOutcome; comparability: ReconciliationComparability;
  direction: "LEFT_ABOVE_RIGHT" | "LEFT_BELOW_RIGHT" | "EQUAL" | "NOT_APPLICABLE";
  leftFacts: ReconciliationFact[]; rightFacts: ReconciliationFact[];
  absoluteDifference: number | null; relativeDifference: number | null; ratio: number | null; temporalGapDays: number | null;
  evidenceConfidence: ReconciliationConfidence; requiresDataReview: boolean;
  calculationBasis: string; reasonCodes: string[]; warnings: string[];
};
export type ReconciliationDataset = {
  companyInn: string; facts: ReconciliationFact[]; sources: SourceEnvelope[];
  bankPeriod?: BankStatementMetricsV2["period"];
};
export type ReconciliationRule = { code: string; evaluate: (data: ReconciliationDataset) => ReconciliationFinding[] };
export type ReconciliationInput = {
  companyInn: string; bank?: BankStatementMetricsV2; manifest?: AnalysisSourceManifest; integrity?: AnalysisIntegritySummary;
  snapshots?: FinancialStatementSnapshot[]; financialAnalysis?: FinancialAnalysisV2;
  bki?: CreditHistoryReport; extraFacts?: ReconciliationFact[];
};
export type CrossSourceReconciliationV1 = {
  version: string; mode: "SHADOW"; companyInn: string;
  sources: { bankStatementSourceIds: string[]; financialSourceIds: string[]; bkiSourceIds: string[]; sourceTypesPresent: SourceType[] };
  facts: ReconciliationFact[]; findings: ReconciliationFinding[];
  summary: { evaluatedRuleCount: number; agreementCount: number; withinToleranceCount: number; conflictCount: number;
    relationshipCount: number; notComparableCount: number; insufficientDataCount: number; sourceMissingCount: number;
    dataReviewRequiredCount: number; sourceFamilyCount: number; confidence: ReconciliationConfidence; warnings: string[] };
};
export type ReconciliationComparisonSummary = {
  version: string; comparisons: Array<{ metric: string; findingId: string | null; legacyValue: number | null;
    reconciliationValue: number | null; absoluteDifference: number | null; reasonCodes: string[] }>;
};
export type ReconciliationShadowFields = {
  reconciliationV1?: CrossSourceReconciliationV1;
  reconciliationComparison?: ReconciliationComparisonSummary; reconciliationWarnings?: string[];
};
