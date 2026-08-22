import test from "node:test";
import assert from "node:assert/strict";
import { analysisView } from "../lib/entitlements.ts";

const analysis = {
  id: "analysis-1", companyName: "ООО Тест", companyInn: "7700000000", fileName: "bank.txt",
  sourceFiles: ["bank.txt"], bankNames: ["Банк"], periodFrom: "2026-01-01", periodTo: "2026-03-31",
  createdAt: "2026-04-01T00:00:00.000Z", score: 712, grade: "B", readiness: "Приемлемая",
  metrics: {
    months: 3, statements: 1, accounts: 1, transactions: 2, grossInflow: 1_000_000,
    operatingInflow: 1_000_000, nonOperatingInflow: 0, unknownInflow: 0, inflow: 1_000_000,
    outflow: 700_000, avgMonthlyInflow: 333_333, monthlyTrend: 8, volatility: .2,
    topOneConcentration: .46, topThreeConcentration: .8, topFiveConcentration: .9, largeIncomingShare: .3,
    taxRegularity: .8, riskyOutflowShare: .03, debtServiceShare: .1, endingBalance: 300_000,
    liquidityDays: 12, averageDailyBalance: 200_000, minimumDailyBalance: 10_000, cashGapDays: 2,
    negativeBalanceDays: 0, seasonality: .1, supplierPaymentRegularity: .8, dataQuality: .9,
    estimatedLimitMin: 1_000_000, estimatedLimitMax: 3_000_000, stressLimitMax: 2_000_000,
    currentMonthlyDebtPayment: 50_000, baseMonthlyPaymentCapacity: 200_000,
    stressMonthlyPaymentCapacity: 120_000, stressMonthlyInflow: 250_000,
    referenceTermMonths: 24, referenceAnnualRate: .2, limitConfidence: 81,
  },
  monthly: [{ month: "2026-01", inflow: 1_000_000, outflow: 700_000 }],
  topCounterparties: [{ name: "Покупатель", amount: 460_000, share: .46 }],
  factors: [{ severity: "warning", title: "Концентрация", detail: "Экспертный вывод" }],
  topRisks: [{ title: "Риск", detail: "Скрытый", source: "Выписки", evidence: "46%" }],
  strengths: [{ title: "Сила", detail: "Скрытая", source: "Выписки", evidence: "Факт" }],
  evidence: [{ id: "e1", conclusion: "Скрыто", metric: "TOP-1", value: "46%", source: "Выписки", period: "3 мес." }],
  recommendations: [{ product: "Профиль", title: "Действие", rationale: "Скрыто", action: "Скрыто", priority: "high" }],
  productFits: [{ product: "Кредит", status: "recommended", statusLabel: "Подходит", amountMin: 1, amountMax: 2, why: ["Скрыто"], conditions: [] }],
  transactions: [
    { id: "1", date: "2026-01-01", amount: 70_000, direction: "out", counterparty: "ФНС", counterpartyInn: "", purpose: "Налог", category: "tax", account: "" },
    { id: "2", date: "2026-01-02", amount: 50_000, direction: "out", counterparty: "Банк", counterpartyInn: "", purpose: "Кредит", category: "debt", account: "" },
  ], warnings: [], methodologyVersion: "SECRET",
  creditHistory: { obligations: [{ id: "secret" }] }, quarterlyReport: { period: "Q1" },
};

test("FREE view keeps financial facts but removes the paid interpretation", () => {
  const view = analysisView(analysis, "FREE");
  assert.equal(view.viewTier, "FREE");
  assert.equal(view.metrics.inflow, 1_000_000);
  assert.equal(view.metrics.topOneConcentration, .46);
  assert.equal(view.freeFacts.taxPayments, 70_000);
  assert.equal(view.freeFacts.creditPayments, 50_000);
  assert.equal(view.lockedSummary.riskCount, 1);
  for (const forbidden of ["score", "grade", "readiness", "creditHistory", "quarterlyReport", "methodologyVersion", "transactions"]) {
    assert.equal(Object.hasOwn(view, forbidden), false, `${forbidden} must not be returned to FREE`);
  }
  assert.deepEqual(view.factors, []);
  assert.deepEqual(view.recommendations, []);
  assert.deepEqual(view.productFits, []);
  assert.equal(Object.hasOwn(view.metrics, "estimatedLimitMax"), false);
});

test("FULL view returns the same stored result with an entitlement marker", () => {
  const view = analysisView(analysis, "FULL");
  assert.equal(view.score, 712);
  assert.equal(view.metrics.estimatedLimitMax, 3_000_000);
  assert.equal(view.creditHistory.obligations[0].id, "secret");
  assert.equal(view.viewTier, "FULL");
});
