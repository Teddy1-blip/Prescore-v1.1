import type { AnalysisResult } from "../prescore.ts";
import { analysisView } from "../entitlements.ts";
import type { ClientReportModelV1 } from "../credit-engine/contracts/client-report.ts";

export const WORKSPACE_MODEL_VERSION = "PRESCORE-WORKSPACE-MODEL-1.0.0";

export type WorkspaceAccessRole = "owner" | "agent" | "admin";
export type WorkspaceTier = "FREE" | "FULL";

export type WorkspaceBasicV1 = {
  company: { name: string; inn: string };
  analysis: {
    id: string;
    createdAt: string;
    periodFrom: string;
    periodTo: string;
  };
  sources: {
    statements: number;
    accounts: number;
    transactions: number;
    banks: string[];
    transactionsTruncated: boolean;
    storedTransactionCount: number | null;
    originalTransactionCount: number | null;
  };
  cashFlow: {
    grossInflow: number;
    operatingInflow: number;
    nonOperatingInflow: number;
    unknownInflow: number;
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    averageMonthlyInflow: number;
    monthlyTrend: number;
  };
  concentration: {
    topOne: number;
    topThree: number;
    topFive: number;
  };
  liquidity: {
    endingBalance: number | null;
    averageDailyBalance: number | null;
    minimumDailyBalance: number | null;
    cashGapDays: number | null;
    negativeBalanceDays: number | null;
    liquidityDays: number | null;
  };
  observedOutflows: {
    taxPayments: number;
    creditPayments: number;
    leasingPayments: number;
    personalTransfers: number;
  };
  monthly: Array<{ month: string; inflow: number; outflow: number }>;
  topCounterparties: Array<{ name: string; amount: number; share: number }>;
  largestRecipients: Array<{ name: string; amount: number; share: number }>;
  warnings: string[];
};

export type WorkspaceFullV1 =
  | { status: "LOCKED" }
  | { status: "READY"; model: ClientReportModelV1 }
  | { status: "UNAVAILABLE"; diagnostic: { id: string; version: string; stage: string; reason: string; category: string } };

export type WorkspaceModelV1 = {
  version: typeof WORKSPACE_MODEL_VERSION;
  analysisId: string;
  tier: WorkspaceTier;
  accessRole: WorkspaceAccessRole;
  readOnly: boolean;
  basic: WorkspaceBasicV1;
  full: WorkspaceFullV1;
};

type FreeAnalysisProjection = {
  id: string;
  companyName: string;
  companyInn: string;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
  bankNames: string[];
  transactionsTruncated?: boolean;
  storedTransactionCount?: number;
  originalTransactionCount?: number;
  metrics: {
    statements: number;
    accounts: number;
    transactions: number;
    grossInflow: number;
    operatingInflow: number;
    nonOperatingInflow: number;
    unknownInflow: number;
    inflow: number;
    outflow: number;
    avgMonthlyInflow: number;
    monthlyTrend: number;
    topOneConcentration: number;
    topThreeConcentration: number;
    topFiveConcentration: number;
    endingBalance: number | null;
    averageDailyBalance: number | null;
    minimumDailyBalance: number | null;
    cashGapDays: number | null;
    negativeBalanceDays: number | null;
    liquidityDays: number | null;
  };
  monthly: Array<{ month: string; inflow: number; outflow: number }>;
  topCounterparties: Array<{ name: string; amount: number; share: number }>;
  freeFacts: {
    netCashFlow: number;
    taxPayments: number;
    creditPayments: number;
    leasingPayments: number;
    personalTransfers: number;
    largestRecipients: Array<{ name: string; amount: number; share: number }>;
  };
  warnings: string[];
};

export function buildWorkspaceBasicV1(analysis: AnalysisResult): WorkspaceBasicV1 {
  // Reuse the already-established FREE entitlement projection, then allowlist only
  // product facts needed by the workspace. No legacy score/grade/readiness/limits
  // can cross this boundary.
  const free = analysisView(analysis, "FREE") as FreeAnalysisProjection;
  return {
    company: { name: free.companyName, inn: free.companyInn },
    analysis: {
      id: free.id,
      createdAt: free.createdAt,
      periodFrom: free.periodFrom,
      periodTo: free.periodTo,
    },
    sources: {
      statements: free.metrics.statements,
      accounts: free.metrics.accounts,
      transactions: free.metrics.transactions,
      banks: [...free.bankNames],
      transactionsTruncated: free.transactionsTruncated === true,
      storedTransactionCount: free.storedTransactionCount ?? null,
      originalTransactionCount: free.originalTransactionCount ?? null,
    },
    cashFlow: {
      grossInflow: free.metrics.grossInflow,
      operatingInflow: free.metrics.operatingInflow,
      nonOperatingInflow: free.metrics.nonOperatingInflow,
      unknownInflow: free.metrics.unknownInflow,
      totalInflow: free.metrics.inflow,
      totalOutflow: free.metrics.outflow,
      netCashFlow: free.freeFacts.netCashFlow,
      averageMonthlyInflow: free.metrics.avgMonthlyInflow,
      monthlyTrend: free.metrics.monthlyTrend,
    },
    concentration: {
      topOne: free.metrics.topOneConcentration,
      topThree: free.metrics.topThreeConcentration,
      topFive: free.metrics.topFiveConcentration,
    },
    liquidity: {
      endingBalance: free.metrics.endingBalance,
      averageDailyBalance: free.metrics.averageDailyBalance,
      minimumDailyBalance: free.metrics.minimumDailyBalance,
      cashGapDays: free.metrics.cashGapDays,
      negativeBalanceDays: free.metrics.negativeBalanceDays,
      liquidityDays: free.metrics.liquidityDays,
    },
    observedOutflows: {
      taxPayments: free.freeFacts.taxPayments,
      creditPayments: free.freeFacts.creditPayments,
      leasingPayments: free.freeFacts.leasingPayments,
      personalTransfers: free.freeFacts.personalTransfers,
    },
    monthly: free.monthly.map(item => ({ ...item })),
    topCounterparties: free.topCounterparties.map(item => ({ ...item })),
    largestRecipients: free.freeFacts.largestRecipients.map(item => ({ ...item })),
    warnings: [...free.warnings],
  };
}
