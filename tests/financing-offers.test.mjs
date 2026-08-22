import assert from "node:assert/strict";
import test from "node:test";
import {
  financingOfferCounts,
  financingOffers,
  offerSupportsNeed,
} from "../lib/financing-offers.ts";

test("contains every offer row from the supplied product matrix", () => {
  assert.equal(financingOffers.length, 60);
  assert.deepEqual(financingOfferCounts, {
    bank: 22,
    mfo: 19,
    factoring: 5,
    seller: 3,
    leasing: 8,
    "secured-personal": 3,
  });
  assert.equal(new Set(financingOffers.map((item) => item.id)).size, financingOffers.length);
});

test("maps specific client needs to the right product families", () => {
  const seller = financingOffers.find((item) => item.id === "seller-capital");
  const factor = financingOffers.find((item) => item.id === "ksk-factor");
  const leasing = financingOffers.find((item) => item.id === "europlan");
  const contract = financingOffers.find((item) => item.id === "psb");
  assert.ok(seller && offerSupportsNeed(seller, "marketplace"));
  assert.ok(factor && offerSupportsNeed(factor, "receivables"));
  assert.ok(leasing && offerSupportsNeed(leasing, "equipment"));
  assert.ok(contract && offerSupportsNeed(contract, "government-contract"));
});

test("does not silently invent partner reward rates", () => {
  const missing = financingOffers.filter((item) => item.commissionRate == null);
  assert.ok(missing.length >= 10);
  assert.ok(missing.some((item) => item.kind === "leasing"));
});
