import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBankRoutes } from "../lib/bank-offers.ts";

function analysis(transactions = []) {
  return {
    companyName: "ООО «Тест»",
    companyInn: "7701234567",
    score: 710,
    factors: [],
    topCounterparties: [],
    bankNames: ["Тест Банк"],
    transactions,
    metrics: {
      liquidityDays: 35,
      volatility: .9,
      topOneConcentration: .12,
      debtServiceShare: .08,
      estimatedLimitMax: 8_000_000,
    },
  };
}

test("shows a regular client only bank and alternative lending routes", () => {
  const result = evaluateBankRoutes(analysis(), null);
  assert.ok(result.routes.length > 0);
  assert.ok(result.routes.every((route) => ["bank", "mfo"].includes(route.kind)));
  assert.ok(result.excludedCount > 0);
});

test("does not unlock seller routes from a manual choice without marketplace evidence", () => {
  const result = evaluateBankRoutes(analysis(), null, "marketplace");
  assert.equal(result.routes.some((route) => route.kind === "seller"), false);
});

test("unlocks seller and leasing routes only when statements contain evidence", () => {
  const marketplace = evaluateBankRoutes(analysis([{ category: "revenue", counterparty: "Ozon", purpose: "Продажи на маркетплейсе" }]), null);
  const leasing = evaluateBankRoutes(analysis([{ category: "leasing", counterparty: "Лизинговая компания", purpose: "Лизинговый платёж за оборудование" }]), null);
  assert.equal(marketplace.routes.some((route) => route.kind === "seller"), true);
  assert.equal(leasing.routes.some((route) => route.kind === "leasing"), true);
});

test("detects government customers and recommends contract financing", () => {
  const result = evaluateBankRoutes(analysis([{ category: "revenue", counterparty: "ФКУ Государственный заказчик", purpose: "Оплата по контракту 44-ФЗ" }]), null);
  assert.equal(result.contractDetected, true);
  assert.ok(result.routes.some((route) => route.recommendedProduct === "Контрактный кредит / КИК"));
});

test("unlocks leasing for an asset-intensive activity", () => {
  const profile = {
    company: { registrationDate: "2020-01-01", region: "Москва", okvedCode: "41.20", okved: "Строительство жилых и нежилых зданий", status: "Действует", addressUnreliable: false },
    finances: { latestYear: "2025", assets: 10_000_000, revenue: 20_000_000, equity: 5_000_000, currentAssets: 8_000_000, currentLiabilities: 4_000_000, receivables: 1_000_000, profit: 1_000_000, revenueGrowth: 5, currentLiquidity: 2, autonomy: 50, returnOnSales: 5, cash: 1_000_000, payables: 1_000_000 },
    legal: { enforcements: 0, enforcementDebt: 0, bankruptcyMessages: 0, legalCases: 0, inspections: 0 },
    contracts: { activeCount: 0, activeAmount: 0 },
  };
  const result = evaluateBankRoutes(analysis(), profile);
  assert.equal(result.leasingDetected, true);
  assert.ok(result.routes.some((route) => route.kind === "leasing"));
});
