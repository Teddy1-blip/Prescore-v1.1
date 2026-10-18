import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceRuntime } from "./fixtures/workspace-runtime.mjs";
import { statementFixture } from "./fixtures/block1-statements.mjs";
import { corporateBkiFile, financialFile } from "./fixtures/polish-sources.mjs";

async function createAnalysis(rt) {
  const response = await rt.request("/api/analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ statements: [{ fileName: "golden-company-statement.txt", text: statementFixture() }] }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const { analysis } = await response.json();
  await rt.full(analysis.id);
  await rt.assign(analysis);
  return analysis;
}

async function upload(rt, analysis, sourceType, file) {
  const form = new FormData();
  form.set("analysisId", analysis.id);
  form.set("sourceType", sourceType);
  form.set("relationship", "Компания-заёмщик");
  form.set("file", file);
  const response = await rt.request("/api/source-documents", { method: "POST", body: form });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

async function workspace(rt, analysis, user = rt.owner) {
  const response = await rt.request(`/api/workspace-model?analysisId=${analysis.id}`, {}, user);
  assert.equal(response.status, 200, await response.clone().text());
  const model = await response.json();
  assert.equal(model.state, "READY_FULL");
  return model;
}

function metrics(period) {
  return Object.fromEntries(period.groups.flatMap((group) => group.metrics).map((metric) => [metric.key, metric]));
}

function period(model, kind, to) {
  const matches = model.full.report.financialAnalysis.history.filter((item) => item.period.kind === kind && item.period.to === to);
  assert.equal(matches.length, 1, `${kind} ${to} must have one authoritative snapshot`);
  return matches[0];
}

function checkoProfile(rt, inn) {
  const receivedAt = "2026-08-03T00:00:00.000Z";
  const bfoSource = {
    sourceId: `bfo:${inn}:golden-checko`,
    sourceType: "BFO",
    status: "READY",
    companyInn: inn,
    sourceName: "Официальная бухгалтерская отчётность",
    periodFrom: "2025-01-01",
    periodTo: "2025-12-31",
    receivedAt,
    parserVersion: "PRESCORE-BFO-NORMALIZER-1",
    integrityVersion: "PRESCORE-INTEGRITY-1",
    confidence: 100,
    warnings: [],
    rawReference: "external:/finances:golden-company",
  };
  const externalSource = {
    sourceId: `external:company:${inn}:golden-checko`,
    sourceType: "CHECKO",
    status: "READY",
    companyInn: inn,
    sourceName: "Официальные и открытые источники /company",
    receivedAt,
    parserVersion: "PRESCORE-EXTERNAL-NORMALIZER-1",
    integrityVersion: "PRESCORE-INTEGRITY-1",
    confidence: null,
    warnings: [],
    rawReference: "external:/company:golden-company",
  };
  const rawFinances = {
    meta: { currency: "RUB", scale: 1 },
    data: {
      "2025": {
        "1100": 1_000_000,
        "1200": 4_000_000,
        "1230": 1_000_000,
        "1250": 500_000,
        "1600": 5_000_000,
        "1300": 3_000_000,
        "1400": 1_000_000,
        "1410": 500_000,
        "1500": 1_000_000,
        "1510": 500_000,
        "1520": 500_000,
        "1700": 5_000_000,
        "2110": 9_900_000,
        "2200": 1_500_000,
        "2330": 100_000,
        "2400": 990_000,
      },
    },
  };
  const shadow = rt.load("lib/credit-engine/financial-analysis/integration.ts")
    .checkoFinancialShadow(rawFinances, bfoSource, {});
  return {
    inn,
    source: "Официальные и открытые источники",
    fetchedAt: receivedAt,
    cached: true,
    failedMethods: [],
    company: {
      name: "ООО СИТИМЭЙТС",
      fullName: "Общество с ограниченной ответственностью СИТИМЭЙТС",
      ogrn: "1205000000000",
      kpp: "503201001",
      status: "Действующее",
      registrationDate: "2020-01-01",
      region: "Московская область",
      address: "Московская область",
      addressUnreliable: false,
      okvedCode: "62.01",
      okved: "Разработка программного обеспечения",
      capital: 10_000,
      managers: [{ name: "Иванов Иван", position: "Генеральный директор", inn: "" }],
      foundersCount: 1,
    },
    finances: {
      latestYear: "2025",
      years: ["2025"],
      revenue: 9_900_000,
      revenueGrowth: null,
      profit: 990_000,
      assets: 5_000_000,
      currentAssets: 4_000_000,
      equity: 3_000_000,
      currentLiabilities: 1_000_000,
      receivables: 1_000_000,
      cash: 500_000,
      payables: 500_000,
      currentLiquidity: 4,
      autonomy: 60,
      returnOnSales: 10,
      nonCurrentAssets: 1_000_000,
      inventories: null,
      inputVat: null,
      longTermLiabilities: 1_000_000,
      longTermBorrowings: 500_000,
      shortTermBorrowings: 500_000,
      costOfSales: null,
      grossProfit: null,
      operatingProfit: 1_500_000,
      interestExpense: 100_000,
      profitBeforeTax: null,
      workingCapital: 3_000_000,
      debtToEquity: 0.33,
      interestCoverage: 15,
      fieldsPresent: ["1100", "1200", "1230", "1250", "1600", "1300", "1400", "1410", "1500", "1510", "1520", "1700", "2110", "2200", "2330", "2400"],
    },
    legal: { legalCases: 0, enforcements: 0, enforcementDebt: 0, inspections: 0, bankruptcyMessages: 0 },
    sourceManifest: { bfo: bfoSource, external: [externalSource] },
    sourceStatus: [
      { endpoint: "/company", status: "available", retrievedAt: receivedAt },
      { endpoint: "/finances", status: "available", retrievedAt: receivedAt },
    ],
    signals: [{ severity: "info", title: "Критические сигналы не обнаружены", detail: "Синтетический профиль" }],
    ...shadow,
  };
}

async function seedChecko(rt, analysis) {
  const profile = checkoProfile(rt, analysis.companyInn);
  await rt.db.prepare(`INSERT INTO checko_profiles (inn, payload, raw_payload, fetched_at, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(inn) DO UPDATE SET payload = excluded.payload,
    raw_payload = excluded.raw_payload, fetched_at = excluded.fetched_at, updated_at = excluded.updated_at`)
    .bind(analysis.companyInn, JSON.stringify(profile), JSON.stringify({ synthetic: true }), profile.fetchedAt, profile.fetchedAt).run();
}

test("Golden Company V1: statement → Checko → annual BFO → corporate BKI → quarterly → one canonical result", async () => {
  const rt = await createWorkspaceRuntime();
  try {
    const analysis = await createAnalysis(rt);
    const bankOnly = await workspace(rt, analysis);
    const bankFacts = structuredClone(bankOnly.basic.bankingFacts);
    assert.equal(bankFacts.grossInflow.value, 100_000);
    assert.equal(bankFacts.grossOutflow.value, 0);
    assert.equal(bankFacts.netCashFlow.value, 100_000);
    assert.equal(bankFacts.operatingInflow.value, 100_000);
    assert.equal(bankFacts.endingBalance.value, 150_000);
    assert.equal(bankFacts.directCustomerTop1.value, 1);

    await seedChecko(rt, analysis);
    const openData = await workspace(rt, analysis);
    assert.ok(openData.basic.sources.availability.some((source) => source.source === "EXTERNAL_SOURCE" && source.status === "READY"));
    const checkoAnnual = metrics(period(openData, "ANNUAL", "2025-12-31"));
    assert.equal(checkoAnnual.REVENUE.value, 9_900_000, "Checko BFO is used as fallback before client BFO upload");

    await upload(rt, analysis, "BFO", financialFile(analysis.companyInn, "csv", { period: "2025 год", revenue: 1300, profit: 130 }));
    const annualModel = await workspace(rt, analysis);
    const annual = period(annualModel, "ANNUAL", "2025-12-31");
    const annualMetrics = metrics(annual);
    assert.equal(annualMetrics.REVENUE.value, 1_300_000, "client-uploaded BFO must override external BFO for the same period");
    assert.equal(annualMetrics.NET_PROFIT.value, 130_000);
    assert.equal(annualMetrics.ASSETS_TOTAL.value, 1_000_000);
    assert.equal(annualMetrics.EQUITY.value, 600_000);
    assert.equal(annualMetrics.TOTAL_BORROWINGS.value, 200_000);
    assert.equal(annualMetrics.currentRatio.value, 3);
    assert.equal(annualMetrics.equityRatio.value, 0.6);
    assert.deepEqual(annualModel.basic.bankingFacts, bankFacts, "BFO must not alter confirmed bank facts");
    const sourceOps = rt.load("app/components/workspace/source-operations.tsx");
    assert.equal(sourceOps.buildSourceDelta("BFO", openData, annualModel).next.code, "BKI");

    await upload(rt, analysis, "BKI", corporateBkiFile(analysis.companyInn));
    const bkiModel = await workspace(rt, analysis);
    const obligation = bkiModel.full.report.analysisV3.portfolio[0];
    assert.equal(obligation.creditor.value, "Тест Банк");
    assert.equal(obligation.limit.value, 200_000);
    assert.equal(obligation.reportedPrincipal.value, 120_000);
    assert.equal(obligation.reportedPrincipal.asOf, "2026-08-02");
    assert.equal(obligation.principal.value, null, "dated reported balance must not become an invented current balance");
    assert.equal(obligation.payment.value, 9_000);
    assert.equal(obligation.overdue.value, 0);
    assert.equal(obligation.overdue.knowledge, "KNOWN");
    assert.equal(sourceOps.buildSourceDelta("BKI", annualModel, bkiModel).next.code, "QUARTERLY");

    await upload(rt, analysis, "QUARTERLY", financialFile(analysis.companyInn, "csv", {
      period: "Январь - Март 2026 г.",
      revenue: 300,
      profit: 30,
    }));
    const final = await workspace(rt, analysis);
    assert.equal(final.full.report.financialAnalysis.history.length, 2, "one annual and one interim period must remain active");
    const finalAnnual = period(final, "ANNUAL", "2025-12-31");
    const finalInterim = period(final, "INTERIM", "2026-03-31");
    const finalAnnualMetrics = metrics(finalAnnual);
    const interimMetrics = metrics(finalInterim);
    assert.equal(finalAnnualMetrics.REVENUE.value, 1_300_000);
    assert.equal(interimMetrics.REVENUE.value, 300_000);
    assert.equal(interimMetrics.NET_PROFIT.value, 30_000);
    assert.equal(finalInterim.period.flowPeriodType, "CUMULATIVE_YTD");
    assert.equal(finalInterim.period.monthsCovered, 3);
    assert.deepEqual(
      final.full.report.financialAnalysis.history.map((item) => metrics(item).REVENUE.value).sort((left, right) => left - right),
      [300_000, 1_300_000],
      "annual and cumulative quarterly revenue must stay separate and must never be summed",
    );
    assert.deepEqual(final.basic.bankingFacts, bankFacts, "all enrichment must preserve the bank ledger");
    assert.equal(sourceOps.buildSourceDelta("QUARTERLY", bkiModel, final).next.code, "ANALYSIS");

    for (const source of ["BANK_STATEMENTS", "FINANCIAL_STATEMENTS", "CREDIT_HISTORY", "QUARTERLY_REPORT", "EXTERNAL_SOURCE"]) {
      assert.ok(final.basic.sources.availability.some((item) => item.source === source && item.status === "READY"), `${source} must be visible in the final source set`);
    }

    const broker = await workspace(rt, analysis, rt.broker);
    assert.deepEqual(broker.full, final.full, "CLIENT and BROKER must read the same canonical result");
    assert.deepEqual((await workspace(rt, analysis)).full, final.full, "repeat reads must be deterministic");

    const decision = rt.load("app/components/workspace/client-decision-route.tsx");
    const beforeDecision = JSON.stringify(final);
    const route = decision.resolveClientDecisionRoute(final);
    assert.ok(["READY_FOR_FINANCING", "NEEDS_PREPARATION", "INSUFFICIENT_DATA"].includes(route.code));
    assert.ok(route.cta.label.length > 0);
    assert.ok(route.tasks.length <= 3);
    assert.equal(JSON.stringify(final), beforeDecision, "client route must not mutate or recalculate canonical results");
  } finally {
    await rt.close();
  }
});
