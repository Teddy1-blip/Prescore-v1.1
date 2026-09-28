import type { SourceEnvelope } from "./sources.ts";

export const FINANCIAL_ANALYSIS_VERSION = "PRESCORE-FINANCIAL-ANALYSIS-2.0.0-SHADOW";
export const FS_NORMALIZATION_VERSION = "PRESCORE-FS-NORMALIZER-2.0.0-SHADOW";
export type FinancialValueStatus = "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE";
export type FinancialConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type FinancialValueOrigin = "REPORTED" | "DERIVED" | "PROXY";
export type FinancialPeriodKind = "ANNUAL" | "INTERIM" | "SNAPSHOT" | "UNKNOWN";
export type FinancialFlowPeriodType = "FULL_YEAR" | "CUMULATIVE_YTD" | "STANDALONE_PERIOD" | "UNKNOWN";
export type AccountingStandard = "RAS" | "UNKNOWN";

export const BALANCE_CODES = {
  ASSETS_TOTAL: "1600", NON_CURRENT_ASSETS: "1100", INTANGIBLE_ASSETS: "1110", FIXED_ASSETS: "1150",
  CURRENT_ASSETS: "1200", INVENTORIES: "1210", INPUT_VAT: "1220", RECEIVABLES: "1230",
  SHORT_TERM_FIN_INVESTMENTS: "1240", CASH: "1250", OTHER_CURRENT_ASSETS: "1260",
  EQUITY: "1300", RETAINED_EARNINGS: "1370", LONG_TERM_LIABILITIES: "1400", LONG_TERM_BORROWINGS: "1410",
  SHORT_TERM_LIABILITIES: "1500", SHORT_TERM_BORROWINGS: "1510", PAYABLES: "1520",
  OTHER_SHORT_TERM_LIABILITIES: "1550", BALANCE_TOTAL: "1700",
} as const;
export const INCOME_CODES = {
  REVENUE: "2110", COST_OF_SALES: "2120", GROSS_PROFIT: "2100", SELLING_EXPENSES: "2210",
  ADMIN_EXPENSES: "2220", OPERATING_PROFIT: "2200", INTEREST_INCOME: "2320", INTEREST_EXPENSE: "2330",
  OTHER_INCOME: "2340", OTHER_EXPENSES: "2350", PROFIT_BEFORE_TAX: "2300", INCOME_TAX_EXPENSE: "2410", NET_PROFIT: "2400",
} as const;
export type BalanceField = keyof typeof BALANCE_CODES;
export type IncomeField = keyof typeof INCOME_CODES;
export type FinancialStatementValue = {
  value: number | null; status: FinancialValueStatus; confidence: FinancialConfidence; origin: FinancialValueOrigin;
  rawCode?: string; rawLabel?: string; rawValue?: number | null;
  sourceId: string; sourceType: "BFO" | "QUARTERLY"; warnings: string[];
};
export type FinancialPeriod = {
  kind: FinancialPeriodKind; from: string | null; to: string | null; asOf: string | null;
  year: number | null; monthsCovered: number | null; flowPeriodType: FinancialFlowPeriodType;
  confidence: FinancialConfidence;
};
export type FinancialStatementSnapshot = {
  snapshotId: string; version: string; companyInn: string; sourceId: string; sourceType: "BFO" | "QUARTERLY";
  source: SourceEnvelope; accountingStandard: AccountingStandard; currency: "RUB";
  confirmedScale: number | null; period: FinancialPeriod;
  balance: Record<BalanceField, FinancialStatementValue>;
  income: Record<IncomeField, FinancialStatementValue>;
  reportedNetAssets: FinancialStatementValue;
  equityNetAssetsProxy: FinancialStatementValue;
  quality: { parserConfidence: number | null; completeness: number; warnings: string[] };
};
// Optional parser metadata only; legacy values, ratios and verdicts remain untouched.
export type QuarterlyFinancialMetadata = {
  scaleConfirmed: boolean; rawScale: number | null; rawLines: Record<string, number | null>;
  reportedNetAssets: number | null; period: FinancialPeriod;
  labelValues?: Record<string, { rawLabel: string; rawValue: number }>;
  reportedNetAssetsLabel?: string;
};
export type PeriodComparability = "COMPARABLE_ANNUAL_YOY" | "COMPARABLE_INTERIM_YOY" | "COMPARABLE_SEQUENTIAL" | "NOT_COMPARABLE" | "INSUFFICIENT_DATA";
export type FinancialMetricResult = {
  code: string; version: string; value: number | null; unit: "RUB" | "RATIO" | "PERCENT" | "DAYS" | "COUNT";
  status: FinancialValueStatus; confidence: FinancialConfidence; origin: FinancialValueOrigin;
  periodFrom: string | null; periodTo: string | null; asOf: string | null;
  calculationBasis: string; dependencies: string[]; sourceIds: string[]; warnings: string[];
};
export type FinancialPeriodQuality = {
  coreBalanceFieldCoverage: number; coreIncomeFieldCoverage: number;
  balanceReconciled: boolean | null; incomeReconciled: boolean | null;
  periodConfidence: FinancialConfidence; confidence: FinancialConfidence; warnings: string[];
};
export type FinancialTrend = {
  metric: string; currentSnapshotId: string; previousSnapshotId: string | null;
  comparability: PeriodComparability; absoluteChange: FinancialMetricResult; relativeChange: FinancialMetricResult;
};
export type FinancialPeriodAnalysis = {
  snapshot: FinancialStatementSnapshot;
  amounts: Record<string, FinancialMetricResult>; liquidity: Record<string, FinancialMetricResult>;
  capitalStructure: Record<string, FinancialMetricResult>; profitability: Record<string, FinancialMetricResult>;
  activity: Record<string, FinancialMetricResult>; composition: Record<string, FinancialMetricResult>;
  quality: FinancialPeriodQuality;
  observations: { equitySign: "POSITIVE" | "ZERO" | "NEGATIVE" | "UNKNOWN"; netProfitSign: "PROFIT" | "ZERO" | "LOSS" | "UNKNOWN"; workingCapitalSign: "POSITIVE" | "ZERO" | "NEGATIVE" | "UNKNOWN" };
};
export type FinancialAnalysisV2 = {
  version: string; mode: "SHADOW"; sources: SourceEnvelope[];
  latestAnnual?: FinancialPeriodAnalysis; latestInterim?: FinancialPeriodAnalysis;
  history: FinancialPeriodAnalysis[]; trends: FinancialTrend[];
  quality: { annualHistoryYears: number; interimPeriods: number; warnings: string[] };
};
export const FINANCIAL_COMPARISON_REASONS = [
  "MISSING_NOT_ZERO", "DEFINITION_CHANGED", "AVERAGE_DENOMINATOR_USED", "ENDING_DENOMINATOR_FALLBACK",
  "INTERIM_NOT_ANNUALIZED", "PERIOD_NOT_COMPARABLE", "EXPENSE_SIGN_NORMALIZED",
  "NON_POSITIVE_EQUITY_DENOMINATOR", "ZERO_DENOMINATOR", "SOURCE_FIELD_MISSING", "PROXY_VALUE_EXCLUDED", "MULTI_YEAR_HISTORY_USED",
] as const;
export type FinancialMetricsComparisonSummary = {
  version: string; comparisons: Array<{
    metric: string; sourceId: string; snapshotId: string; legacyValue: number | null; v2Value: number | null;
    absoluteDiff: number | null; relativeDiff: number | null; definitionChanged: boolean; reasonCodes: string[];
  }>;
};
