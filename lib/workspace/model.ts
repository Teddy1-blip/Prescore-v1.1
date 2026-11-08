import {legalRegistryView} from "../legal-registry.ts";
import {financialSources} from "../credit-engine/financial-analysis/source-selection.ts";
import type { AnalysisResult } from "../prescore.ts";
import type { BankStatementMetricsV2, MetricResult } from "../credit-engine/contracts/metrics.ts";
import type { SourceStatus } from "../credit-engine/contracts/sources.ts";

export const WORKSPACE_MODEL_V1 = "PRESCORE-WORKSPACE-MODEL-1.0.0";

export type WorkspaceModelStateV1 = "READY_BASIC" | "READY_FULL" | "NOT_FOUND" | "UNAVAILABLE";
export type WorkspaceAvailabilityV1 = "READY" | "LOCKED" | "UNAVAILABLE" | "UNKNOWN";
export type WorkspaceAccessRoleV1 = "OWNER" | "ASSIGNED_BROKER" | "ADMIN";
export type WorkspaceFactV1 = {
  code?: string;
  value: number | null;
  unit: MetricResult["unit"];
  status: MetricResult["status"];
  confidence: MetricResult["confidence"];
  periodFrom: string | null;
  periodTo: string | null;
};

export type WorkspaceOperationalStateV1 = {
  documents: { status: "AVAILABLE" | "NONE" | "UNKNOWN"; count: number | null; analysisCount: number | null };
  applications: {
    status: "AVAILABLE" | "NONE" | "UNKNOWN";
    count: number | null;
    activeCount: number | null;
    statuses: Array<{ status: string; count: number }> | null;
  };
};

export type WorkspaceBasicV1 = {
  checko?:import("../external/checko-cache.ts").CheckoState;
  coverageGaps?:ReturnType<typeof import("../credit-engine/credit-assessment/coverage.ts").bankCoverageGaps>;
  legalRegistry?: import("../legal-registry.ts").LegalRegistryV1;
  financingRequest?: import("./financing-request.ts").FinancingRequestV1;
  analysis: {
    id: string;
    company: { name: string; inn: string };
    createdAt: string;
    period: { from: string; to: string };
  };
  sources: {
    statements: { status: SourceStatus | "UNKNOWN"; count: number | null; bankNames: string[] | null; accountCount: number | null; periodFrom: string | null; periodTo: string | null };
    completeness: number | null;
    missingSources: string[] | null;
    availability: Array<{ source: string; status: SourceStatus | "UNKNOWN"; periodFrom: string | null; periodTo: string | null; confidence?: number | null; reportDate?: string | null }>;
  };
  bankingFacts: {
    operationListTruncated?:boolean;
    balanceCheck?: import("../credit-engine/metrics/statement-balances.ts").BalanceCheck;
    grossInflow: WorkspaceFactV1;
    grossOutflow: WorkspaceFactV1;
    netCashFlow: WorkspaceFactV1;
    operatingInflow: WorkspaceFactV1;
    observedMonthlyOperatingAverage: WorkspaceFactV1;
    fullMonthOperatingAverage: WorkspaceFactV1;
    seasonality?: {status:string;trend:WorkspaceFactV1;volatility:WorkspaceFactV1;peakToAverage:WorkspaceFactV1};
    debtService:WorkspaceFactV1;
    loanPrincipalPayments: WorkspaceFactV1;
    interestPayments: WorkspaceFactV1;
    unsplitDebtPayments: WorkspaceFactV1;
    leasingPayments: WorkspaceFactV1;
    taxPayments: WorkspaceFactV1;
    socialContributions: WorkspaceFactV1;
    transfersToIndividuals: WorkspaceFactV1;
    endingBalance: WorkspaceFactV1;
    averageDailyBalance: WorkspaceFactV1;
    minimumDailyBalance: WorkspaceFactV1;
    lowLiquidityDays: WorkspaceFactV1;
    directCustomerTop1: WorkspaceFactV1;
    directCustomerTop3: WorkspaceFactV1;
    topCounterparties: Array<{ name: string; amount: number; share: number }> | null;
    monthly: Array<{
      month: string;
      coverage: import("../credit-engine/contracts/sources.ts").MonthCoverageStatus;
      otherReceipts?: number | null;
      nonOperatingReceipts?: number | null;
      unknownInflows?: number | null;
      principal?: number | null;
      interest?: number | null;
      unsplit?: number | null;
      leasing?: number | null;
      taxOnly?: number | null;
      social?: number | null;
      netExternal?: number|null;
      individualBusiness?: number|null;
      operatingReceipts: number | null;
      externalInflows: number | null;
      externalOutflows: number | null;
      taxPayments: number | null;
      debtService: number | null;
    }> | null;
  };
  operations: WorkspaceOperationalStateV1;
};

export type WorkspaceModelV1 = {
  version: typeof WORKSPACE_MODEL_V1;
  state: WorkspaceModelStateV1;
  analysisId: string;
  access: { role: WorkspaceAccessRoleV1; readOnly: boolean };
  entitlement: "BASIC" | "FULL";
  basic: WorkspaceBasicV1;
  fullAvailability: WorkspaceAvailabilityV1;
  full?: {
    revisionAvailable?: boolean;
    /** Source identity/period only; never exposed to BASIC or forwarded to the analyst. */
    bankingSources?: Array<{sourceId:string;periodFrom:string|null;periodTo:string|null}>;
    policyRequirements?: { debtCapacityMinFullMonths: number };
    report: import("../credit-engine/contracts/client-report.ts").ClientReportModelV1;
    canonical: {
      prescoreIndex: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["prescoreIndex"];
      financingReadiness: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["financingReadiness"];
      creditAssessment: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["creditAssessment"];
      debtCapacity: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["debtCapacity"];
      productSelection: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["productSelection"];
      recommendations: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["recommendationSet"];
      actionPlan: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["actionPlan"];
      explainability: import("../credit-engine/production/orchestrator.ts").CanonicalCreditAnalysisV1["explainability"];
      expertise: NonNullable<import("../credit-engine/contracts/client-report.ts").ClientReportModelV1["expertise"]> | null;
    };
  };
  limitations?: { code: "CANONICAL_REPORT_UNAVAILABLE" };
  /** Safe operational status, not an analytical result or an entitlement grant. */
  diagnostic?: import("../credit-engine/production/diagnostics.ts").CanonicalDiagnosticV1;
};

export type WorkspaceOperationalInput = WorkspaceOperationalStateV1;

function fact(metric: MetricResult | undefined, unit: MetricResult["unit"] = "RUB"): WorkspaceFactV1 {
  if (!metric) return { value: null, unit, status: "UNKNOWN", confidence: "UNKNOWN", periodFrom: null, periodTo: null };
  return {
    code: metric.code,
    value: metric.status === "UNKNOWN" ? null : metric.value,
    unit: metric.unit,
    status: metric.status,
    confidence: metric.confidence,
    periodFrom: metric.periodFrom,
    periodTo: metric.periodTo,
  };
}

function sourceAvailability(analysis: AnalysisResult): WorkspaceBasicV1["sources"]["availability"] {
  const manifest = analysis.sourceManifest;
  const sources = [
    ...(Array.isArray(manifest?.bankStatements) ? manifest.bankStatements.map((item) => ({ source: "BANK_STATEMENTS", item })) : []),
    ...financialSources(manifest).map(item => ({source: item.sourceType === "BFO" ? "FINANCIAL_STATEMENTS" : "QUARTERLY_REPORT", item})),
    ...(manifest?.bki ? [{ source: "CREDIT_HISTORY", item: manifest.bki }] : []),
    ...(Array.isArray(manifest?.external) ? manifest.external.map((item) => ({ source: item.sourceId.startsWith("client-request-") ? "CLIENT_DECLARATION" : "EXTERNAL_SOURCE", item })) : []),
  ];
  // Report date is source evidence, never the upload timestamp or a contractual due date.
  const reported = analysis.creditHistory?.reportDate;
  const reportDate = analysis.creditHistory?.subjectInn === analysis.companyInn
    && typeof reported === "string" && /^\d{4}-\d{2}-\d{2}$/.test(reported)
    && Number.isFinite(Date.parse(reported)) && new Date(reported).toISOString().slice(0, 10) === reported
      ? reported : null;
  return sources.map(({ source, item }) => ({
    source,
    status: item.status,
    ...(Number.isFinite(item.confidence) ? { confidence:item.confidence } : {}),
    periodFrom: item.periodFrom ?? null,
    periodTo: item.periodTo ?? null,
    ...(source === "CREDIT_HISTORY" ? { reportDate } : {}),
  }));
}

import {bankCoverageGaps} from '../credit-engine/credit-assessment/coverage.ts';
export function projectWorkspaceBasic(
  analysis: AnalysisResult,
  operations: WorkspaceOperationalInput = {
    documents: { status: "UNKNOWN", count: null, analysisCount: null },
    applications: { status: "UNKNOWN", count: null, activeCount: null, statuses: null },
  },
): WorkspaceBasicV1 {
  const metrics: BankStatementMetricsV2 | undefined = analysis.metricsV2;
  const statements = analysis.sourceManifest?.bankStatements;
  const statementPeriodFrom = metrics?.period.from ?? (statements?.length ? statements.map((item) => item.periodFrom).filter((value): value is string => !!value).sort()[0] ?? null : null);
  const statementPeriodTo = metrics?.period.to ?? (statements?.length ? statements.map((item) => item.periodTo).filter((value): value is string => !!value).sort().at(-1) ?? null : null);
  return {
    coverageGaps:bankCoverageGaps(analysis),
    ...(analysis.checkoAttempt?{checko:analysis.checkoAttempt}:{}),
    ...(analysis.legalRegistryV1 ? {legalRegistry: legalRegistryView(analysis)} : {}),
    financingRequest: analysis.financingRequestV1 ? structuredClone(analysis.financingRequestV1) : undefined,
    analysis: {
      id: analysis.id,
      company: { name: analysis.companyName, inn: analysis.companyInn },
      createdAt: analysis.createdAt,
      period: { from: statementPeriodFrom ?? analysis.periodFrom, to: statementPeriodTo ?? analysis.periodTo },
    },
    sources: {
      statements: {
        status: statements?.some((item) => item.status === "READY") ? "READY" : statements?.length ? statements[0].status : "UNKNOWN",
        count: Array.isArray(statements) ? statements.length : null,
        bankNames: Array.isArray(analysis.bankNames) ? [...analysis.bankNames] : null,
        accountCount: Number.isSafeInteger(analysis.metrics?.accounts) ? analysis.metrics.accounts : null,
        periodFrom: statementPeriodFrom,
        periodTo: statementPeriodTo,
      },
      completeness: analysis.integrity?.completeness ?? null,
      missingSources: analysis.integrity ? [...analysis.integrity.missingSources] : null,
      availability: sourceAvailability(analysis),
    },
    bankingFacts: {
      ...(analysis.transactionsTruncated ? {operationListTruncated:true} : {}),
      ...(analysis.statementBalanceCheck ? {balanceCheck:analysis.statementBalanceCheck} : {}),
      grossInflow: fact(metrics?.cashFlow.grossExternalCashInflow),
      grossOutflow: fact(metrics?.cashFlow.grossExternalCashOutflow),
      netCashFlow: fact(metrics?.cashFlow.netExternalCashFlow),
      operatingInflow: fact(metrics?.operating.operatingCashReceipts),
      observedMonthlyOperatingAverage: fact(metrics?.operating.observedMonthlyOperatingAverage),
      fullMonthOperatingAverage: fact(metrics?.operating.fullMonthOperatingAverage),
      seasonality: {status:metrics?.operating.seasonalityStatus??'INSUFFICIENT_HISTORY',trend:fact(metrics?.operating.operatingReceiptsTrend,'RATIO'),volatility:fact(metrics?.operating.operatingReceiptsVolatility,'RATIO'),peakToAverage:fact(metrics?.operating.peakToAverageRatio,'RATIO')},
      debtService:fact(metrics?.debtService.debtServiceCashOutflow),
      loanPrincipalPayments: fact(metrics?.debtService.loanPrincipalPaid),
      interestPayments: fact(metrics?.debtService.interestPaid),
      unsplitDebtPayments: fact(metrics?.debtService.unsplitDebtService),
      leasingPayments: fact(metrics?.debtService.leasingPaid),
      taxPayments: fact(metrics?.tax.taxPaymentsAmount),
      socialContributions: fact(metrics?.tax.socialContributionsAmount),
      transfersToIndividuals: fact(metrics?.individualAndCash.individualBusinessAmount),
      endingBalance: fact(metrics?.liquidity.endingBalance),
      averageDailyBalance: fact(metrics?.liquidity.averageDailyBalance),
      minimumDailyBalance: fact(metrics?.liquidity.minimumDailyBalance),
      lowLiquidityDays: fact(metrics?.liquidity.lowLiquidityDays),
      directCustomerTop1: fact(metrics?.customers.directCustomerTop1),
      directCustomerTop3: fact(metrics?.customers.directCustomerTop3),
      topCounterparties: Array.isArray(analysis.topCounterparties)
        ? analysis.topCounterparties.map(({ name, amount, share }) => ({ name, amount, share }))
        : null,
      monthly: metrics ? metrics.monthly.map((item) => ({
        month: item.month,
        coverage: item.coverage,
        otherReceipts: item.coverage === "MISSING" ? null : item.otherReceipts ?? null,
        nonOperatingReceipts: item.coverage === "MISSING" ? null : item.nonOperatingReceipts ?? null,
        unknownInflows: item.coverage === "MISSING" ? null : item.unknownInflows ?? null,
        principal: item.coverage === "MISSING" ? null : item.principal ?? null,
        interest: item.coverage === "MISSING" ? null : item.interest ?? null,
        unsplit: item.coverage === "MISSING" ? null : item.unsplit ?? null,
        leasing: item.coverage === "MISSING" ? null : item.leasing ?? null,
        taxOnly: item.coverage === "MISSING" ? null : item.taxOnly ?? null,
        netExternal:item.coverage==="MISSING"?null:item.netExternal??null,
        individualBusiness:item.coverage==="MISSING"?null:item.individualBusiness??null,
        social: item.coverage === "MISSING" ? null : item.social ?? null,
        operatingReceipts: item.coverage === "MISSING" ? null : item.operatingReceipts,
        externalInflows: item.coverage === "MISSING" ? null : item.externalInflows,
        externalOutflows: item.coverage === "MISSING" ? null : item.externalOutflows,
        taxPayments: item.coverage === "MISSING" ? null : item.taxPayments,
        debtService: item.coverage === "MISSING" ? null : item.debtService,
      })) : null,
    },
    operations: structuredClone(operations),
  };
}
