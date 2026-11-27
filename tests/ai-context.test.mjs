import assert from "node:assert/strict";
import test from "node:test";
import { AI_ANALYST_SYSTEM_PROMPT, buildSanitizedCreditContext } from "../lib/ai-credit-analyst.ts";

test("builds a question-specific AI context without company identifiers or internal weights", () => {
  const analysis = {
    id: "analysis-safe-id", companyInn: "7701234567", companyName: "ООО СЕКРЕТ", methodologyVersion: "CORE-1",
    periodFrom: "2026-01-01", periodTo: "2026-06-30", score: 650, grade: "B", factors: [], strengths: [],
    metrics: { avgMonthlyInflow: 2_000_000, grossInflow: 13_000_000, nonOperatingInflow: 1_000_000, monthlyTrend: 4, volatility: .15, topOneConcentration: .43, topThreeConcentration: .72, debtServiceShare: .11, liquidityDays: 18, cashGapDays: 2, dataQuality: 86, estimatedLimitMin: 1_000_000, estimatedLimitMax: 3_000_000, currentMonthlyDebtPayment: 100_000 },
    recommendations: [{ title: "Снизить долговую нагрузку", rationale: "Платежи составляют 11% потока", action: "Сверить график", priority: "medium" }],
    productFits: [{ product: "Оборотная линия", status: "recommended" }],
  };
  const profile = { company: { name: "ООО СЕКРЕТ", registrationDate: "2020-01-01", okved: "Оптовая торговля" }, legal: { enforcements: 15, legalCases: 4 }, contracts: { totalCount: 19, totalAmount: 100_000_000 }, finances: { latestYear: "2025", revenue: 24_000_000, revenueGrowth: 3, profit: 1_200_000, currentLiquidity: 1.4, equity: 5_000_000, debtToEquity: .5, interestCoverage: 3 } };
  const risk = {
    version: "RISK-1", readiness: { code: "PREPARE" }, finalConclusion: { verdict: "Нужна подготовка", confidence: 82, hardStop: false, limitMin: 2_000_000, limitMax: 4_000_000, product: null },
    globalStops: [{ code: "RISK-LEGAL-TERMINATED", title: "Ликвидация по реестру", evidence: "Внешний публичный профиль", source: "Правовой контур", action: "Проверить ЕГРЮЛ" }],
    manualReview: [
      { code: "RISK-CF-CUSTOMER-CONCENTRATION", title: "Концентрация покупателей", evidence: "TOP-1 43%", source: "Выписки", action: "Подтвердить договоры" },
      { code: "CONTRACT-CONCENTRATION", title: "Концентрация госконтрактов", evidence: "Контракты 19", source: "Правовой контур", action: "Проверить реестр" },
    ],
    strengths: [{ title: "Публичная сильная сторона", evidence: "ЕГРЮЛ", source: "Правовой контур" }],
    actionPlan: [{ horizon: 7, items: [{ title: "Проверить публичные контракты", reason: "Внешний реестр", action: "Проверить реестр", result: "Сверено" }] }],
  };
  const context = buildSanitizedCreditContext("Почему высокая концентрация покупателей?", analysis, profile, risk);
  const serialized = JSON.stringify(context);
  assert.doesNotMatch(serialized, /7701234567|ООО СЕКРЕТ|ЕГРЮЛ|ликвидац|внешний публичный профиль|контракт|регистрац|оптовая торговля/i);
  assert.doesNotMatch(serialized, /weight|вес|threshold|порог/i);
  assert.match(serialized, /TOP-1 43%/);
  assert.doesNotMatch(serialized, /credit_history/);
  assert.doesNotMatch(serialized, /company_profile|risk_factors|stop_factors/);
  assert.match(AI_ANALYST_SYSTEM_PROMPT, /не используй.*публичные сведения/i);
  assert.match(AI_ANALYST_SYSTEM_PROMPT, /не раскрывай.*формул/i);
});
