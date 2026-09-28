import assert from "node:assert/strict";
import test from "node:test";

import { analyzeBankStatement } from "../lib/prescore.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";

const expected = {
  score: 872,
  grade: "A",
  readiness: "Высокая готовность",
  metrics: {
    months: 6, statements: 1, accounts: 1, transactions: 44,
    grossInflow: 7720000, operatingInflow: 6900000, nonOperatingInflow: 750000, unknownInflow: 70000,
    inflow: 6900000, outflow: 4125000, avgMonthlyInflow: 1150000, monthlyTrend: 30, volatility: 0.15,
    topOneConcentration: 0.4348, topThreeConcentration: 0.8261, topFiveConcentration: 1, largeIncomingShare: 0.5652,
    taxRegularity: 1, riskyOutflowShare: 0.0073, debtServiceShare: 0.1565, endingBalance: 800000, liquidityDays: 35.4,
    averageDailyBalance: 3105171.84, minimumDailyBalance: 1535000, cashGapDays: 0, negativeBalanceDays: 0,
    seasonality: 1.22, supplierPaymentRegularity: 1, dataQuality: 100,
    estimatedLimitMin: 1283000, estimatedLimitMax: 2636000, stressLimitMax: 1283000,
    currentMonthlyDebtPayment: 180000, baseMonthlyPaymentCapacity: 142000, stressMonthlyPaymentCapacity: 69000,
    stressMonthlyInflow: 1038000, referenceTermMonths: 24, referenceAnnualRate: 0.26, limitConfidence: 96,
  },
  monthly: [
    { month: "янв 26", inflow: 900000, outflow: 665000 },
    { month: "фев 26", inflow: 1000000, outflow: 665000 },
    { month: "мар 26", inflow: 1100000, outflow: 665000 },
    { month: "апр 26", inflow: 1200000, outflow: 665000 },
    { month: "май 26", inflow: 1300000, outflow: 665000 },
    { month: "июн 26", inflow: 1400000, outflow: 800000 },
  ],
  topCounterparties: [
    { name: "ООО Альфа", amount: 3000000, share: 0.4348 },
    { name: "ООО Бета", amount: 1400000, share: 0.2029 },
    { name: "ООО Гамма", amount: 1300000, share: 0.1884 },
    { name: "ООО Дельта", amount: 1200000, share: 0.1739 },
  ],
  factors: [
    ["BANK-001", "info", "Неоперационные поступления исключены"],
    ["BANK-002", "info", "Поступления требуют подтверждения"],
  ],
  productFits: [
    ["Возобновляемая кредитная линия", "recommended", 1283215.5731440226, 2635752.044041357],
    ["Овердрафт", "conditional", 253000.00000000003, 460000],
    ["Факторинг", "recommended", 225000, 400000],
    ["Рефинансирование", "conditional", 0, 2635752.044041357],
    ["Банковская гарантия / контрактное финансирование", "conditional", 0, 2635752.044041357],
    ["Финансирование селлеров", "conditional", 0, 0],
    ["Лизинг", "conditional", 0, 2635752.044041357],
    ["МФО / краудлендинг", "not-now", 0, 2635752.044041357],
  ],
  recommendations: [
    ["Концентрация покупателей", "medium", "Снизить зависимость от крупнейшего покупателя"],
    ["Денежный поток", "medium", "Закрепить стабильность поступлений"],
    ["Диверсификация потока", "medium", "Раскрыть качество пяти крупнейших покупателей"],
    ["Полнота данных", "high", "Добавить выписки остальных банков"],
    ["Кредитное досье", "low", "Завершить доказательную часть профиля"],
  ],
  categories: { cash: 1, debt: 6, internal: 1, leasing: 6, loan_inflow: 1, other: 1, owner_funding: 1, payroll: 6, personal: 1, refund_in: 1, refund_out: 1, revenue: 6, supplier: 6, tax: 6 },
};

function projection(result) {
  return {
    score: result.score,
    grade: result.grade,
    readiness: result.readiness,
    metrics: result.metrics,
    monthly: result.monthly,
    topCounterparties: result.topCounterparties,
    factors: result.factors.map((item) => [item.code, item.severity, item.title]),
    productFits: result.productFits.map((item) => [item.product, item.status, item.amountMin, item.amountMax]),
    recommendations: result.recommendations.map((item) => [item.product, item.priority, item.title]),
    categories: Object.fromEntries([...new Set(result.transactions.map((item) => item.category))].sort().map((category) => [category, result.transactions.filter((item) => item.category === category).length])),
  };
}

test("Block 2 keeps the complete credit result identical to the Block 1 baseline", () => {
  const result = analyzeBankStatement(block2StatementFixture(), "block2.txt");
  assert.deepEqual(projection(result), expected);
  assert.equal(result.normalization?.version, "PRESCORE-TX-NORMALIZER-1");
  assert.equal(result.normalization?.originalCount, 44);
  assert.ok(result.transactions.every((item) => item.canonicalTransactionId && item.normalizationVersion === "PRESCORE-TX-NORMALIZER-1"));
});
