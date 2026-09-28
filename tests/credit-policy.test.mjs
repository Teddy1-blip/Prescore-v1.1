import assert from "node:assert/strict";
import test from "node:test";
import { creditPolicyLayerCounts, creditPolicyRules, creditPolicySummary } from "../lib/credit-policy.ts";

test("loads the complete credit-policy matrix", () => {
  assert.equal(creditPolicyRules.length, 171);
  assert.equal(new Set(creditPolicyRules.map((rule) => rule.code)).size, 171);
  assert.deepEqual(creditPolicyLayerCounts(), {
    "Данные": 12,
    "Выписки": 28,
    "БФО": 29,
    "Квартал": 16,
    "Правовой контур": 27,
    "БКИ": 20,
    "Контракты": 14,
    "Группа": 7,
    "Банк": 18,
  });
  assert.equal(creditPolicySummary.automated, 46);
  assert.equal(creditPolicySummary.partial, 10);
  assert.equal(creditPolicySummary.dataRequired, 115);
});

test("removes competitor terminology from every customer-facing rule", () => {
  const excludedTerm = new RegExp(["пас", "порт"].join(""), "i");
  assert.equal(creditPolicyRules.some((rule) => Object.values(rule).some((value) => excludedTerm.test(String(value)))), false);
});
