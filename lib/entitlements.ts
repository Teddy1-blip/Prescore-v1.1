import type { AnalysisResult, NormalizedTransaction } from "./prescore";

export type AnalysisTier = "FREE" | "FULL";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
};

export type EntitlementDatabase = {
  prepare: (query: string) => Statement;
};

export type LockedSummary = {
  riskCount: number;
  visibleRiskCount: number;
  recommendationCount: number;
  productCount: number;
  hasCreditHistory: boolean;
  hasQuarterlyReport: boolean;
};

export async function ensureEntitlementSchema(db: EntitlementDatabase) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS analysis_entitlements (
    analysis_id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL DEFAULT '',
    company_inn TEXT NOT NULL DEFAULT '',
    tier TEXT NOT NULL DEFAULT 'FREE',
    payment_order_id TEXT NOT NULL DEFAULT '',
    granted_by TEXT NOT NULL DEFAULT 'SYSTEM',
    granted_at TEXT NOT NULL DEFAULT '',
    revoked_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function ensureFreeEntitlement(db: EntitlementDatabase, analysisId: string, userEmail: string, companyInn: string) {
  await ensureEntitlementSchema(db);
  await db.prepare(`INSERT OR IGNORE INTO analysis_entitlements
    (analysis_id, user_email, company_inn, tier, granted_by, updated_at)
    VALUES (?, ?, ?, 'FREE', 'SYSTEM', ?)`).bind(analysisId, userEmail.toLowerCase(), companyInn, new Date().toISOString()).run();
}

export async function grantFullEntitlement(db: EntitlementDatabase, input: { analysisId: string; userEmail: string; companyInn: string; orderId?: string; grantedBy?: string }) {
  await ensureEntitlementSchema(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO analysis_entitlements
    (analysis_id, user_email, company_inn, tier, payment_order_id, granted_by, granted_at, revoked_at, updated_at)
    VALUES (?, ?, ?, 'FULL', ?, ?, ?, '', ?)
    ON CONFLICT(analysis_id) DO UPDATE SET
      user_email = excluded.user_email, company_inn = excluded.company_inn, tier = 'FULL',
      payment_order_id = excluded.payment_order_id, granted_by = excluded.granted_by,
      granted_at = excluded.granted_at, revoked_at = '', updated_at = excluded.updated_at`)
    .bind(input.analysisId, input.userEmail.toLowerCase(), input.companyInn, input.orderId ?? "", input.grantedBy ?? "ADMIN", now, now).run();
}

export async function setAnalysisTier(db: EntitlementDatabase, analysisId: string, tier: AnalysisTier, actor = "ADMIN") {
  await ensureEntitlementSchema(db);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE analysis_entitlements SET tier = ?, granted_by = ?,
    granted_at = CASE WHEN ? = 'FULL' THEN ? ELSE granted_at END,
    revoked_at = CASE WHEN ? = 'FREE' THEN ? ELSE '' END, updated_at = ? WHERE analysis_id = ?`)
    .bind(tier, actor, tier, now, tier, now, now, analysisId).run();
}

export async function resolveAnalysisTier(db: EntitlementDatabase, input: { analysisId: string; userEmail: string; companyInn: string; privileged?: boolean }) {
  if (input.privileged) return "FULL" as const;
  await ensureFreeEntitlement(db, input.analysisId, input.userEmail, input.companyInn);
  const row = await db.prepare("SELECT tier FROM analysis_entitlements WHERE analysis_id = ? AND user_email = ? LIMIT 1")
    .bind(input.analysisId, input.userEmail.toLowerCase()).first<{ tier?: string }>();
  if (row?.tier === "FULL") return "FULL" as const;

  // Backward compatibility: a previously paid active access opens the matching stored analysis.
  try {
    const legacy = await db.prepare(`SELECT id FROM subscriptions WHERE company_inn = ? AND user_email = ? AND status = 'Активна'
      AND ? = (SELECT id FROM analyses WHERE company_inn = ? AND owner_email = ? ORDER BY created_at DESC LIMIT 1) LIMIT 1`)
      .bind(input.companyInn, input.userEmail.toLowerCase(), input.analysisId, input.companyInn, input.userEmail.toLowerCase()).first<{ id?: string }>();
    if (legacy?.id) {
      await grantFullEntitlement(db, { ...input, orderId: legacy.id, grantedBy: "LEGACY_MIGRATION" });
      return "FULL" as const;
    }
  } catch { /* legacy table may not exist */ }
  return "FREE" as const;
}

function sumCategory(transactions: NormalizedTransaction[], category: NormalizedTransaction["category"]) {
  return transactions.filter((item) => item.direction === "out" && item.category === category).reduce((sum, item) => sum + item.amount, 0);
}

function largestRecipients(transactions: NormalizedTransaction[]) {
  const totals = new Map<string, number>();
  for (const item of transactions) {
    if (item.direction !== "out" || item.category === "internal") continue;
    const name = item.counterparty || "Получатель не указан";
    totals.set(name, (totals.get(name) ?? 0) + item.amount);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()].map(([name, amount]) => ({ name, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);
}

export function analysisView(result: AnalysisResult, tier: AnalysisTier) {
  const lockedSummary: LockedSummary = {
    riskCount: result.factors.length,
    visibleRiskCount: 0,
    recommendationCount: result.recommendations.length,
    productCount: result.productFits.length,
    hasCreditHistory: Boolean(result.creditHistory),
    hasQuarterlyReport: Boolean(result.quarterlyReport),
  };
  if (tier === "FULL") return { ...result, viewTier: tier, lockedSummary };

  const transactions = result.transactions ?? [];
  const metrics = result.metrics;
  return {
    id: result.id,
    companyName: result.companyName,
    companyInn: result.companyInn,
    fileName: result.fileName,
    sourceFiles: result.sourceFiles,
    bankNames: result.bankNames,
    sourceManifest: result.sourceManifest,
    integrity: result.integrity,
    screeningResults: result.screeningResults,
    deduplication: result.deduplication,
    infrastructureVersions: result.infrastructureVersions,
    transactionsTruncated: result.transactionsTruncated,
    storedTransactionCount: result.storedTransactionCount,
    originalTransactionCount: result.originalTransactionCount,
    periodFrom: result.periodFrom,
    periodTo: result.periodTo,
    createdAt: result.createdAt,
    viewTier: tier,
    lockedSummary,
    metrics: {
      months: metrics.months, statements: metrics.statements, accounts: metrics.accounts,
      transactions: metrics.transactions, grossInflow: metrics.grossInflow,
      operatingInflow: metrics.operatingInflow, nonOperatingInflow: metrics.nonOperatingInflow,
      unknownInflow: metrics.unknownInflow, inflow: metrics.inflow, outflow: metrics.outflow,
      avgMonthlyInflow: metrics.avgMonthlyInflow, monthlyTrend: metrics.monthlyTrend,
      topOneConcentration: metrics.topOneConcentration, topThreeConcentration: metrics.topThreeConcentration,
      topFiveConcentration: metrics.topFiveConcentration, taxRegularity: metrics.taxRegularity,
      endingBalance: metrics.endingBalance, averageDailyBalance: metrics.averageDailyBalance,
      minimumDailyBalance: metrics.minimumDailyBalance, cashGapDays: metrics.cashGapDays,
      negativeBalanceDays: metrics.negativeBalanceDays, liquidityDays: metrics.liquidityDays,
    },
    monthly: result.monthly,
    topCounterparties: result.topCounterparties,
    freeFacts: {
      netCashFlow: metrics.inflow - metrics.outflow,
      taxPayments: sumCategory(transactions, "tax"),
      creditPayments: sumCategory(transactions, "debt"),
      leasingPayments: sumCategory(transactions, "leasing"),
      personalTransfers: sumCategory(transactions, "personal"),
      largestRecipients: largestRecipients(transactions),
    },
    factors: [], topRisks: [], strengths: [], evidence: [], recommendations: [], productFits: [],
    warnings: result.warnings,
  };
}

export function isFullTier(tier: AnalysisTier) {
  return tier === "FULL";
}
