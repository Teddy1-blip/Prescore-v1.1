import assert from "node:assert/strict";
import test from "node:test";
import { AI_ANALYST_SYSTEM_PROMPT, buildSanitizedCreditContext } from "../lib/ai-credit-analyst.ts";

test("builds a question-specific AI context without company identifiers or internal weights", () => {
  const analysis = {
    id: "analysis-safe-id", companyInn: "7701234567", companyName: "ООО СЕКРЕТ", methodologyVersion: "CORE-1",
    periodFrom: "2026-01-01", periodTo: "2026-06-30", score: 650, grade: "B", factors: [], strengths: [],
    metrics: { avgMonthlyInflow: 2_000_000, grossInflow: 13_000_000, nonOperatingInflow: 1_000_000, monthlyTrend: 4, volatility: .15, topOneConcentration: .43, topThreeConcentration: .72, debtServiceShare: .11, liquidityDays: 18, cashGapDays: 2 },
  };
  const profile = { company: { registrationDate: "2020-01-01", okved: "Оптовая торговля" }, finances: { latestYear: "2025", revenue: 24_000_000, revenueGrowth: 3, profit: 1_200_000, currentLiquidity: 1.4, equity: 5_000_000, debtToEquity: .5, interestCoverage: 3 } };
  const risk = {
    version: "RISK-1", readiness: { code: "PREPARE" }, finalConclusion: { verdict: "Нужна подготовка", confidence: 82, hardStop: false, limitMin: 2_000_000, limitMax: 4_000_000, product: null },
    globalStops: [], manualReview: [{ title: "Концентрация покупателей", evidence: "TOP-1 43%", source: "Выписки", action: "Подтвердить договоры" }], strengths: [],
    actionPlan: [{ horizon: 7, items: [{ title: "Проверить дебиторку", reason: "Высокая концентрация", action: "Добавить реестр", result: "Сверено" }] }],
  };
  const context = buildSanitizedCreditContext("Почему высокая концентрация покупателей?", analysis, profile, risk);
  const serialized = JSON.stringify(context);
  assert.doesNotMatch(serialized, /7701234567|ООО СЕКРЕТ/);
  assert.doesNotMatch(serialized, /weight|вес|threshold|порог/i);
  assert.match(serialized, /TOP-1 43%/);
  assert.doesNotMatch(serialized, /credit_history/);
  assert.match(AI_ANALYST_SYSTEM_PROMPT, /не раскрывай.*формул/i);
});
