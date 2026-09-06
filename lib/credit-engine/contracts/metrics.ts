import type { ClassificationConfidence, EconomicCategory } from "./classification.ts";
import type { MonthCoverageStatus } from "./sources.ts";

export type MetricStatus = "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE";
export type MetricConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type MetricUnit = "RUB" | "RATIO" | "PERCENT" | "COUNT" | "DAYS" | "MONTHS";

export type MetricConfidenceBreakdown = {
  highConfidenceAmount: number;
  mediumConfidenceAmount: number;
  lowConfidenceAmount: number;
  unknownConfidenceAmount: number;
};

export type MetricResult = {
  code: string;
  version: string;
  value: number | null;
  unit: MetricUnit;
  status: MetricStatus;
  confidence: MetricConfidence;
  periodFrom: string | null;
  periodTo: string | null;
  transactionCount: number;
  sourceCount: number;
  calculationBasis: string;
  includedCategories: EconomicCategory[];
  excludedCategories?: EconomicCategory[];
  confidenceBreakdown?: MetricConfidenceBreakdown;
  evidence?: string[];
  warnings: string[];
};

export type MonthlyCashFlowV2 = {
  month: string;
  coverage: MonthCoverageStatus;
  operatingReceipts: number;
  externalInflows: number;
  externalOutflows: number;
  supplierPayments: number;
  taxPayments: number;
  payrollPayments: number;
  debtService: number;
  unclearIndividualAndCash: number;
  unknownInflows: number;
  warnings: string[];
};

export type ConcentrationGroup = {
  key: string;
  displayName: string;
  inn: string | null;
  amount: number;
  share: number;
  identityConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

export type BankStatementMetricsV2 = {
  version: string;
  mode: "SHADOW";
  period: {
    from: string | null;
    to: string | null;
    fullMonths: number;
    partialMonths: number;
    missingMonths: number;
    overlapMonths: number;
  };
  cashFlow: {
    grossExternalCashInflow: MetricResult;
    grossExternalCashOutflow: MetricResult;
    netExternalCashFlow: MetricResult;
  };
  operating: {
    operatingCashReceipts: MetricResult;
    saleProceedsAmount: MetricResult;
    customerAdvanceAmount: MetricResult;
    acquiringSettlementAmount: MetricResult;
    marketplaceSettlementAmount: MetricResult;
    supplierPayments: MetricResult;
    rentPayments: MetricResult;
    employeeReimbursements: MetricResult;
    individualBusinessPayments: MetricResult;
    observedMonthlyOperatingAverage: MetricResult;
    fullMonthOperatingAverage: MetricResult;
    operatingReceiptsTrend: MetricResult;
    operatingReceiptsVolatility: MetricResult;
    peakToAverageRatio: MetricResult;
    seasonalityEligibility: MetricResult;
    trendStatus: "AVAILABLE" | "INSUFFICIENT_DATA";
    seasonalityStatus: "ELIGIBLE" | "INSUFFICIENT_HISTORY";
  };
  financing: {
    financingCashInflow: MetricResult;
    bankLoanInflow: MetricResult;
    otherLoanInflow: MetricResult;
    ownerLoanInflow: MetricResult;
    factoringInflow: MetricResult;
  };
  ownerFunding: {
    ownerContributionAmount: MetricResult;
    ownerFundingUnspecifiedAmount: MetricResult;
  };
  otherInflows: {
    loanRepaymentReceivedAmount: MetricResult;
    taxRefundAmount: MetricResult;
    refundReceivedAmount: MetricResult;
    subsidyGrantAmount: MetricResult;
    insurancePayoutAmount: MetricResult;
    assetSaleProceedsAmount: MetricResult;
    otherInflowAmount: MetricResult;
    unknownInflowAmount: MetricResult;
    unknownInflowShare: MetricResult;
    unknownInflowCount: MetricResult;
  };
  debtService: {
    loanPrincipalPaid: MetricResult;
    interestPaid: MetricResult;
    unsplitDebtService: MetricResult;
    leasingPaid: MetricResult;
    debtServiceCashOutflow: MetricResult;
    debtServiceToOperatingReceipts: MetricResult;
    factoringFeeAmount: MetricResult;
  };
  tax: {
    taxPaymentsAmount: MetricResult;
    socialContributionsAmount: MetricResult;
    taxAndSocialAmount: MetricResult;
    taxPaymentMonths: MetricResult;
    taxPaymentMonthShare: MetricResult;
    taxToOperatingCashReceipts: MetricResult;
  };
  payroll: {
    payrollAmount: MetricResult;
    payrollMonths: MetricResult;
    payrollToOperatingReceipts: MetricResult;
  };
  individualAndCash: {
    individualBusinessAmount: MetricResult;
    unclearIndividualAmount: MetricResult;
    cashWithdrawalAmount: MetricResult;
    unclearIndividualAndCashShare: MetricResult;
  };
  otherOutflows: {
    otherOutflowAmount: MetricResult;
    unknownOutflowAmount: MetricResult;
    unknownOutflowShare: MetricResult;
  };
  fees: { bankFeeAmount: MetricResult; acquiringFeeAmount: MetricResult };
  ownerOutflows: { dividendAmount: MetricResult; ownerWithdrawalAmount: MetricResult };
  investing: { assetPurchaseAmount: MetricResult; assetSaleProceedsAmount: MetricResult };
  lending: { loanIssuedAmount: MetricResult };
  refunds: { refundReceivedAmount: MetricResult; customerRefundAmount: MetricResult };
  customers: {
    directCustomerTop1: MetricResult;
    directCustomerTop3: MetricResult;
    directCustomerTop5: MetricResult;
    directCustomerConcentrationCoverage: MetricResult;
    directCustomerIdentityCoverage: MetricResult;
    intermediatedOperatingShare: MetricResult;
    marketplaceShare: MetricResult;
    acquiringShare: MetricResult;
    platformTop1: MetricResult;
    platformTop3: MetricResult;
    top3OperatingReceiptsShare: MetricResult;
    directGroups: ConcentrationGroup[];
    platformGroups: ConcentrationGroup[];
  };
  suppliers: {
    supplierPaymentAmount: MetricResult;
    supplierTop1: MetricResult;
    supplierTop3: MetricResult;
    supplierTop5: MetricResult;
    supplierPaymentMonths: MetricResult;
    identityCoverage: MetricResult;
    groups: ConcentrationGroup[];
  };
  liquidity: {
    endingBalance: MetricResult;
    averageDailyBalance: MetricResult;
    minimumDailyBalance: MetricResult;
    lowLiquidityDays: MetricResult;
    nearZeroBalanceDays: MetricResult;
    negativeReconstructedBalanceDays: MetricResult;
  };
  quality: {
    sourceIntegrityConfidence: number | null;
    unknownInflowShare: number | null;
    classificationAmounts: Record<ClassificationConfidence, number>;
    warnings: string[];
  };
  monthly: MonthlyCashFlowV2[];
};

export type MetricsComparisonReasonCode =
  | "FACTORING_EXCLUDED_FROM_OPERATING"
  | "OWNER_LOAN_EXCLUDED"
  | "MARKETPLACE_INTERMEDIARY"
  | "ACQUIRING_INTERMEDIARY"
  | "PARTIAL_MONTH_EXCLUDED"
  | "MISSING_MONTH_NOT_ZERO"
  | "UNKNOWN_INFLOW_EXCLUDED"
  | "DEBT_SPLIT_REFINED"
  | "INTERNAL_TRANSFER_RECONCILED"
  | "COUNTERPARTY_AGGREGATION_CHANGED"
  | "DEFINITION_CHANGED";

export type MetricComparison = {
  metric: string;
  legacyValue: number | null;
  v2Value: number | null;
  absoluteDiff: number | null;
  relativeDiff: number | null;
  reasonCodes: MetricsComparisonReasonCode[];
  definitionChanged: boolean;
};

export type MetricsComparisonSummary = {
  version: string;
  totalCompared: number;
  materialDifferenceCount: number;
  comparisons: MetricComparison[];
  materialDifferences: MetricComparison[];
  materialDifferencesTruncated?: boolean;
};

export const BANK_STATEMENT_METRICS_VERSION = "PRESCORE-BANK-METRICS-2.0.0-SHADOW";
