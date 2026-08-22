import assert from "node:assert/strict";
import test from "node:test";
import {
  averagePartnerCommissionRate,
  calculateAveragePartnerForecast,
  calculatePotentialCommission,
  partnerCommissions,
  recurringReferralPayment,
} from "../lib/partner-commissions.ts";

test("calculates recurring 30% payout from the 6,500 RUB subscription", () => {
  assert.equal(recurringReferralPayment, 1950);
});

test("calculates potential partner reward from limit and listed rate", () => {
  assert.equal(calculatePotentialCommission(9_500_000, 0.01), 95_000);
  assert.equal(calculatePotentialCommission(9_500_000, 0.005), 47_500);
  assert.equal(calculatePotentialCommission(9_500_000, 0.005, 25_000), 25_000);
});

test("uses one internal average rate for the pipeline forecast", () => {
  assert.ok(averagePartnerCommissionRate > 0);
  assert.equal(calculateAveragePartnerForecast(10_000_000), 10_000_000 * averagePartnerCommissionRate);
});

test("keeps distinct Alfa Bank product rates", () => {
  const alfa = partnerCommissions.filter((item) => item.bank === "Альфа-Банк");
  assert.deepEqual(alfa.map((item) => item.rate), [0.005, 0.0025]);
});

test("exposes every listed financing route to the agent funnel", () => {
  assert.equal(partnerCommissions.length, 60);
  assert.ok(partnerCommissions.some((item) => item.kind === "Лизинг" && item.rateAvailable === false));
  assert.ok(partnerCommissions.some((item) => item.bank === "Seller Capital"));
});
