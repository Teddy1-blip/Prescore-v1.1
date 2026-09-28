import assert from "node:assert/strict";
import test from "node:test";

import { analyzeBankStatements } from "../lib/prescore.ts";
import { statementFixture } from "./fixtures/block1-statements.mjs";

function parityStatements() {
  return Array.from({ length: 6 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const lastDay = new Date(Date.UTC(2026, index + 1, 0)).getUTCDate();
    return {
      text: statementFixture({
        account: `4070281011111000000${index + 1}`,
        periodFrom: `01.${month}.2026`,
        periodTo: `${lastDay}.${month}.2026`,
        transactionDate: `15.${month}.2026`,
        amount: `${800000 + index * 50000}.00`,
        number: String(index + 1),
      }),
      fileName: `m${month}.txt`,
    };
  });
}

test("Block 1 preserves the version 29 credit result", () => {
  const result = analyzeBankStatements(parityStatements());
  assert.deepEqual({
    score: result.score,
    grade: result.grade,
    readiness: result.readiness,
    operatingInflow: result.metrics.operatingInflow,
    avgMonthlyInflow: result.metrics.avgMonthlyInflow,
    concentration: result.metrics.topOneConcentration,
    debtShare: result.metrics.debtServiceShare,
    estimatedLimitMin: result.metrics.estimatedLimitMin,
    estimatedLimitMax: result.metrics.estimatedLimitMax,
    stressLimitMax: result.metrics.stressLimitMax,
    factors: result.factors.map((item) => [item.code, item.severity, item.title]),
    productFits: result.productFits.map((item) => [item.product, item.status, item.amountMin, item.amountMax]),
  }, {
    score: 635,
    grade: "B",
    readiness: "Готовность с оговорками",
    operatingInflow: 5_550_000,
    avgMonthlyInflow: 925_000,
    concentration: 1,
    debtShare: 0,
    estimatedLimitMin: 1_665_000,
    estimatedLimitMax: 1_665_000,
    stressLimitMax: 1_665_000,
    factors: [
      ["B-008", "warning", "Критическая концентрация"],
      ["BANK-002", "warning", "Нерегулярные налоговые платежи"],
    ],
    productFits: [
      ["Возобновляемая кредитная линия", "recommended", 1_665_000, 1_665_000],
      ["Овердрафт", "conditional", 203_500.00000000003, 370_000],
      ["Факторинг", "recommended", 416_250, 740_000],
      ["Рефинансирование", "conditional", 0, 1_665_000],
      ["Банковская гарантия / контрактное финансирование", "conditional", 0, 1_665_000],
      ["Финансирование селлеров", "conditional", 0, 0],
      ["Лизинг", "conditional", 0, 1_665_000],
      ["МФО / краудлендинг", "not-now", 0, 1_665_000],
    ],
  });
});

