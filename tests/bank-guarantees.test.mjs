import assert from "node:assert/strict";
import test from "node:test";
import { guaranteePolicies, matchGuaranteePolicies } from "../lib/bank-guarantees.ts";

test("stores the supplied guarantee policies without inventing missing bank names", () => {
  assert.equal(guaranteePolicies.length, 17);
  assert.ok(guaranteePolicies.some((item) => item.provider === "ВТБ" && item.providerConfirmed));
  assert.ok(guaranteePolicies.some((item) => item.provider === "ББР Банк" && item.providerConfirmed));
  assert.ok(guaranteePolicies.some((item) => item.provider === "НОВИКОМ" && item.providerConfirmed));
  assert.ok(guaranteePolicies.filter((item) => !item.providerConfirmed).every((item) => /Партнёр БГ/.test(item.provider)));
});

test("filters guarantee routes by amount, law and guarantee type", () => {
  const matches = matchGuaranteePolicies({ amount: 5_000_000, law: "44-ФЗ", guaranteeType: "Исполнение контракта", opf: "ООО", ageMonths: 72, region: "Москва" });
  assert.ok(matches.filter((item) => item.eligible).length >= 5);
  const tooLarge = matchGuaranteePolicies({ amount: 900_000_000, law: "44-ФЗ", guaranteeType: "Исполнение контракта" });
  assert.equal(tooLarge.some((item) => item.eligible), false);
});
