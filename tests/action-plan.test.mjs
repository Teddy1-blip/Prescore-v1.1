import assert from "node:assert/strict";
import test from "node:test";
import { buildActionPlan } from "../lib/action-plan.ts";

const analysis = {
  companyInn: "7701234567",
  sourceFiles: ["bank.txt"],
  bankNames: ["Т-Банк"],
  topCounterparties: [{ name: "ООО Вайлдберриз", amount: 4_000_000, share: .62 }],
  transactions: [],
  factors: [{ severity: "warning", title: "Концентрация", detail: "" }],
  creditHistory: undefined,
  quarterlyReport: undefined,
  metrics: {
    months: 4,
    liquidityDays: 8,
    taxRegularity: .4,
    topOneConcentration: .62,
    debtServiceShare: .24,
    riskyOutflowShare: .15,
    monthlyTrend: -12,
    baseMonthlyPaymentCapacity: 300_000,
  },
};

test("creates auditable actions for 7, 30 and 60 days", () => {
  const plan = buildActionPlan(analysis);
  assert.deepEqual(plan.map((phase) => phase.horizon), [7, 30, 60]);
  assert.ok(plan.every((phase) => phase.items.length >= 3));
  assert.ok(plan[0].items.some((item) => /маркетплейс/i.test(item.title)));
  assert.ok(plan.flatMap((phase) => phase.items).every((item) => item.result && item.owner));
  const customerActions = plan.flatMap((phase) => phase.items).map((item) => `${item.title} ${item.action}`).join(" ");
  assert.doesNotMatch(customerActions, /Сбер|ВТБ|Альфа-Банк|Т-Банк|подать заявку|куда податься/i);
});
