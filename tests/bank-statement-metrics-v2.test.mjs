import assert from "node:assert/strict";
import test from "node:test";

import { buildBankStatementMetricsV2 } from "../lib/credit-engine/metrics/engine.ts";
import { BANK_STATEMENT_METRICS_VERSION } from "../lib/credit-engine/contracts/metrics.ts";
import { analyzeBankStatement } from "../lib/prescore.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";

function tx(id, category, amount = 100, options = {}) {
  const direction = options.direction ?? (category.endsWith("RECEIVED") || category.endsWith("INFLOW") || [
    "SALE_PROCEEDS", "CUSTOMER_ADVANCE", "ACQUIRING_SETTLEMENT", "MARKETPLACE_SETTLEMENT", "FACTORING_PROCEEDS",
    "OWNER_CONTRIBUTION", "OWNER_FUNDING_UNSPECIFIED", "TAX_REFUND", "SUBSIDY_GRANT", "INSURANCE_PAYOUT",
    "ASSET_SALE_PROCEEDS", "REFUND_RECEIVED", "UNKNOWN_INFLOW",
  ].includes(category) ? "in" : "out");
  return {
    id,
    canonicalTransactionId: id,
    date: options.date ?? "2026-01-15",
    amount,
    direction,
    counterparty: options.name ?? `Counterparty ${id}`,
    counterpartyInn: options.inn ?? `${7700000000 + Number(id.replace(/\D/g, "") || 1)}`,
    purpose: options.purpose ?? category,
    category: "other",
    account: "40702810000000000001",
    sourceId: options.sourceId ?? "source-1",
    sourceFileName: options.sourceFileName ?? "statement.txt",
    duplicateStatus: options.duplicateStatus ?? "NOT_DUPLICATE",
    duplicateOfTransactionId: options.duplicateOfTransactionId,
    classification: {
      version: "PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW",
      family: "OTHER",
      primaryCategory: category,
      confidence: options.confidence ?? "HIGH",
      ruleCode: `TEST-${id}`,
      evidence: [],
      alternatives: [],
      tags: options.tags ?? [],
      requiresReview: false,
      ambiguityReasons: [],
      ...(options.components ? { components: options.components } : {}),
    },
  };
}

function coverage(rows = [{ month: "2026-01", status: "FULL" }]) {
  return rows.map((row) => ({
    month: row.month,
    status: row.status,
    daysCovered: row.status === "MISSING" ? 0 : 31,
    calendarDays: 31,
    sourceIds: row.status === "MISSING" ? [] : ["source-1"],
    warnings: [],
  }));
}

function run(transactions, coverageRows, options = {}) {
  return buildBankStatementMetricsV2({
    transactions,
    periodFrom: options.periodFrom ?? "2026-01-01",
    periodTo: options.periodTo ?? "2026-12-31",
    sourceManifest: {
      bankStatements: [{
        sourceId: "source-1", sourceType: "BANK_STATEMENT", status: "READY", companyInn: "7700000000",
        receivedAt: "2026-01-01T00:00:00.000Z", confidence: 100, warnings: [],
        fieldAvailability: { openingBalance: options.balanceKnown === false ? "UNKNOWN" : "KNOWN", endingBalance: options.balanceKnown === false ? "UNKNOWN" : "KNOWN" },
      }],
    },
    integrity: {
      confidence: options.integrityConfidence ?? 100,
      completeness: 100,
      missingSources: [], failedSources: [], staleSources: [], warnings: [], integrityVersion: "PRESCORE-INTEGRITY-1",
      calendarCoverage: coverageRows ?? coverage(),
      dataQuality: {
        confidence: 100, completeness: 100, fullMonths: 1, partialMonths: 0, missingMonths: 0, overlapMonths: 0,
        sourceCount: 1, knownFieldsRate: 1,
        fieldKnownRates: { direction: 1, counterparty: 1, counterpartyInn: 1, purpose: 1, account: 1, source: 1 },
        parserConfidence: 100, unknownClassificationRate: 0, warnings: [],
      },
    },
    legacyMetrics: { endingBalance: options.endingBalance ?? 1_000, ...(options.legacyMetrics ?? {}) },
  });
}

const categoryCases = [
  ["sale", "SALE_PROCEEDS", (m) => m.operating.saleProceedsAmount.value, 100],
  ["customer advance", "CUSTOMER_ADVANCE", (m) => m.operating.customerAdvanceAmount.value, 100],
  ["acquiring", "ACQUIRING_SETTLEMENT", (m) => m.operating.acquiringSettlementAmount.value, 100, ["ACQUIRING", "PAYMENT_INTERMEDIARY"]],
  ["marketplace", "MARKETPLACE_SETTLEMENT", (m) => m.operating.marketplaceSettlementAmount.value, 100, ["MARKETPLACE", "PAYMENT_INTERMEDIARY"]],
  ["bank loan", "BANK_LOAN_RECEIVED", (m) => m.financing.bankLoanInflow.value, 100],
  ["other loan", "OTHER_LOAN_RECEIVED", (m) => m.financing.otherLoanInflow.value, 100],
  ["owner loan", "OWNER_LOAN_RECEIVED", (m) => m.financing.ownerLoanInflow.value, 100],
  ["owner contribution", "OWNER_CONTRIBUTION", (m) => m.ownerFunding.ownerContributionAmount.value, 100],
  ["factoring proceeds", "FACTORING_PROCEEDS", (m) => m.financing.factoringInflow.value, 100],
  ["loan repayment received", "LOAN_REPAYMENT_RECEIVED", (m) => m.otherInflows.loanRepaymentReceivedAmount.value, 100],
  ["tax refund", "TAX_REFUND", (m) => m.otherInflows.taxRefundAmount.value, 100],
  ["subsidy", "SUBSIDY_GRANT", (m) => m.otherInflows.subsidyGrantAmount.value, 100],
  ["insurance payout", "INSURANCE_PAYOUT", (m) => m.otherInflows.insurancePayoutAmount.value, 100],
  ["asset sale", "ASSET_SALE_PROCEEDS", (m) => m.investing.assetSaleProceedsAmount.value, 100],
  ["unknown inflow", "UNKNOWN_INFLOW", (m) => m.otherInflows.unknownInflowAmount.value, 100],
  ["supplier", "SUPPLIER_PAYMENT", (m) => m.operating.supplierPayments.value, 100],
  ["rent", "RENT_PAYMENT", (m) => m.operating.rentPayments.value, 100],
  ["payroll", "PAYROLL", (m) => m.payroll.payrollAmount.value, 100],
  ["employee reimbursement", "EMPLOYEE_REIMBURSEMENT", (m) => m.operating.employeeReimbursements.value, 100],
  ["business individual", "INDIVIDUAL_BUSINESS_PAYMENT", (m) => m.individualAndCash.individualBusinessAmount.value, 100],
  ["unclear individual", "INDIVIDUAL_UNCLEAR_PAYMENT", (m) => m.individualAndCash.unclearIndividualAmount.value, 100],
  ["cash withdrawal", "CASH_WITHDRAWAL", (m) => m.individualAndCash.cashWithdrawalAmount.value, 100],
  ["tax", "TAX_PAYMENT", (m) => m.tax.taxPaymentsAmount.value, 100],
  ["social", "SOCIAL_CONTRIBUTION", (m) => m.tax.socialContributionsAmount.value, 100],
  ["bank fee", "BANK_FEE", (m) => m.fees.bankFeeAmount.value, 100],
  ["acquiring fee", "ACQUIRING_FEE", (m) => m.fees.acquiringFeeAmount.value, 100],
  ["principal", "LOAN_PRINCIPAL_PAYMENT", (m) => m.debtService.loanPrincipalPaid.value, 100],
  ["interest", "INTEREST_PAYMENT", (m) => m.debtService.interestPaid.value, 100],
  ["unsplit debt", "DEBT_SERVICE_UNSPLIT", (m) => m.debtService.unsplitDebtService.value, 100],
  ["leasing", "LEASING_PAYMENT", (m) => m.debtService.leasingPaid.value, 100],
  ["factoring fee", "FACTORING_FEE", (m) => m.debtService.factoringFeeAmount.value, 100],
  ["loan issued", "LOAN_ISSUED", (m) => m.lending.loanIssuedAmount.value, 100],
  ["dividend", "DIVIDEND", (m) => m.ownerOutflows.dividendAmount.value, 100],
  ["owner withdrawal", "OWNER_WITHDRAWAL", (m) => m.ownerOutflows.ownerWithdrawalAmount.value, 100],
  ["asset purchase", "ASSET_PURCHASE", (m) => m.investing.assetPurchaseAmount.value, 100],
  ["customer refund", "CUSTOMER_REFUND", (m) => m.refunds.customerRefundAmount.value, 100],
  ["unknown outflow", "UNKNOWN_OUTFLOW", (m) => m.otherOutflows.unknownOutflowAmount.value, 100],
];

for (const [label, category, read, expected, tags = []] of categoryCases) {
  test(`controlled category: ${label}`, () => {
    const { metricsV2 } = run([tx("1", category, expected, { tags })]);
    assert.equal(read(metricsV2), expected);
    if (!["SALE_PROCEEDS", "CUSTOMER_ADVANCE", "ACQUIRING_SETTLEMENT", "MARKETPLACE_SETTLEMENT"].includes(category)) {
      assert.equal(metricsV2.operating.operatingCashReceipts.value, 0);
    }
  });
}

test("own transfer is excluded from company external cash flow", () => {
  const { metricsV2 } = run([tx("38", "INTERNAL_TRANSFER", 500, { direction: "in", tags: ["OWN_ACCOUNT"] })]);
  assert.equal(metricsV2.cashFlow.grossExternalCashInflow.value, 0);
});

test("paired multi-bank transfers are excluded in both directions", () => {
  const { metricsV2 } = run([tx("39a", "INTERNAL_TRANSFER", 500, { direction: "in" }), tx("39b", "INTERNAL_TRANSFER", 500, { direction: "out" })]);
  assert.equal(metricsV2.cashFlow.netExternalCashFlow.value, 0);
  assert.equal(metricsV2.cashFlow.grossExternalCashOutflow.value, 0);
});

test("exact duplicate is counted once", () => {
  const { metricsV2 } = run([tx("40a", "SALE_PROCEEDS", 100), tx("40b", "SALE_PROCEEDS", 100, { duplicateStatus: "EXACT", duplicateOfTransactionId: "40a" })]);
  assert.equal(metricsV2.operating.operatingCashReceipts.value, 100);
});

test("probable duplicate is retained", () => {
  const { metricsV2 } = run([tx("41a", "SALE_PROCEEDS", 100), tx("41b", "SALE_PROCEEDS", 100, { duplicateStatus: "PROBABLE", duplicateOfTransactionId: "41a" })]);
  assert.equal(metricsV2.operating.operatingCashReceipts.value, 200);
});

test("same buyer and INN aggregates", () => {
  const { metricsV2 } = run([tx("42a", "SALE_PROCEEDS", 60, { inn: "7701000001", name: "ООО Ромашка" }), tx("42b", "SALE_PROCEEDS", 40, { inn: "7701000001", name: "Ромашка ООО" })]);
  assert.equal(metricsV2.customers.directGroups.length, 1);
  assert.equal(metricsV2.customers.directCustomerTop1.value, 1);
});

test("same name with different INNs remains separate", () => {
  const { metricsV2 } = run([tx("43a", "SALE_PROCEEDS", 60, { inn: "7701000001", name: "Ромашка" }), tx("43b", "SALE_PROCEEDS", 40, { inn: "7701000002", name: "Ромашка" })]);
  assert.equal(metricsV2.customers.directGroups.length, 2);
  assert.equal(metricsV2.customers.directCustomerTop1.value, 0.6);
});

test("missing INN lowers concentration confidence", () => {
  const { metricsV2 } = run([tx("44", "SALE_PROCEEDS", 100, { inn: "", name: "ООО Ромашка" })]);
  assert.equal(metricsV2.customers.directGroups[0].identityConfidence, "MEDIUM");
  assert.notEqual(metricsV2.customers.directCustomerTop1.confidence, "HIGH");
});

test("placeholder customer without INN lowers identity coverage and never creates fake Top-1", () => {
  const { metricsV2 } = run([tx("44-placeholder-customer", "SALE_PROCEEDS", 100, { inn: "", name: "Контрагент не указан" })]);
  assert.equal(metricsV2.customers.directGroups.length, 0);
  assert.equal(metricsV2.customers.directCustomerIdentityCoverage.value, 0);
  assert.equal(metricsV2.customers.directCustomerTop1.value, null);
  assert.equal(metricsV2.customers.directCustomerTop1.status, "PARTIAL");
});

test("placeholder supplier without INN lowers identity coverage and never creates fake Top-1", () => {
  const { metricsV2 } = run([tx("44-placeholder-supplier", "SUPPLIER_PAYMENT", 100, { inn: "", name: "Контрагент не указан" })]);
  assert.equal(metricsV2.suppliers.groups.length, 0);
  assert.equal(metricsV2.suppliers.identityCoverage.value, 0);
  assert.equal(metricsV2.suppliers.supplierTop1.value, null);
  assert.equal(metricsV2.suppliers.supplierTop1.status, "PARTIAL");
});

test("acquiring bank is excluded from direct customer concentration", () => {
  const { metricsV2 } = run([tx("45", "ACQUIRING_SETTLEMENT", 100, { tags: ["ACQUIRING", "PAYMENT_INTERMEDIARY"], name: "Банк Эквайер" })]);
  assert.equal(metricsV2.customers.acquiringShare.value, 1);
  assert.equal(metricsV2.customers.directCustomerTop1.value, null);
});

test("acquiring category remains intermediary even when classifier tags are absent", () => {
  const { metricsV2 } = run([tx("45-no-tags", "ACQUIRING_SETTLEMENT", 100, { tags: [], name: "Банк Эквайер" })]);
  assert.equal(metricsV2.customers.directCustomerConcentrationCoverage.value, 0);
  assert.equal(metricsV2.customers.directCustomerTop1.value, null);
  assert.equal(metricsV2.customers.acquiringShare.value, 1);
  assert.equal(metricsV2.customers.intermediatedOperatingShare.value, 1);
  assert.equal(metricsV2.customers.platformTop1.value, 1);
});

test("marketplace category remains intermediary even when classifier tags are absent", () => {
  const { metricsV2 } = run([tx("46-no-tags", "MARKETPLACE_SETTLEMENT", 100, { tags: [], name: "Wildberries" })]);
  assert.equal(metricsV2.customers.directCustomerConcentrationCoverage.value, 0);
  assert.equal(metricsV2.customers.directCustomerTop1.value, null);
  assert.equal(metricsV2.customers.marketplaceShare.value, 1);
  assert.equal(metricsV2.customers.intermediatedOperatingShare.value, 1);
  assert.equal(metricsV2.customers.platformGroups[0].displayName, "Wildberries");
});

test("Wildberries is platform dependency, not final buyer", () => {
  const { metricsV2 } = run([tx("46", "MARKETPLACE_SETTLEMENT", 800, { tags: ["MARKETPLACE", "PAYMENT_INTERMEDIARY"], name: "Wildberries" }), tx("46b", "SALE_PROCEEDS", 200, { name: "Direct buyer" })]);
  assert.equal(metricsV2.customers.marketplaceShare.value, 0.8);
  assert.equal(metricsV2.customers.directCustomerConcentrationCoverage.value, 0.2);
  assert.equal(metricsV2.customers.directCustomerTop1.value, 1);
});

test("marketplace appears in platform concentration", () => {
  const { metricsV2 } = run([tx("47", "MARKETPLACE_SETTLEMENT", 100, { tags: ["MARKETPLACE", "PAYMENT_INTERMEDIARY"], name: "Ozon", inn: "" })]);
  assert.equal(metricsV2.customers.platformGroups[0].displayName, "Ozon");
  assert.equal(metricsV2.customers.platformTop1.value, 1);
});

test("direct concentration coverage reflects intermediary share", () => {
  const rows = [tx("48a", "MARKETPLACE_SETTLEMENT", 800, { tags: ["MARKETPLACE", "PAYMENT_INTERMEDIARY"] }), ...[1, 2, 3, 4].map((n) => tx(`48d${n}`, "SALE_PROCEEDS", 50))];
  assert.equal(run(rows).metricsV2.customers.directCustomerConcentrationCoverage.value, 0.2);
});

test("missing month is represented as missing, not an observed zero", () => {
  const c = coverage([{ month: "2026-01", status: "FULL" }, { month: "2026-02", status: "MISSING" }, { month: "2026-03", status: "FULL" }]);
  const rows = [tx("49a", "SALE_PROCEEDS", 100, { date: "2026-01-15" }), tx("49b", "SALE_PROCEEDS", 100, { date: "2026-03-15" })];
  const { metricsV2 } = run(rows, c);
  assert.equal(metricsV2.monthly[1].coverage, "MISSING");
  assert.equal(metricsV2.operating.observedMonthlyOperatingAverage.value, 100);
});

test("partial month is excluded from full-month average", () => {
  const c = coverage([{ month: "2026-01", status: "FULL" }, { month: "2026-02", status: "FULL" }, { month: "2026-03", status: "PARTIAL" }]);
  const rows = [tx("50a", "SALE_PROCEEDS", 100, { date: "2026-01-15" }), tx("50b", "SALE_PROCEEDS", 100, { date: "2026-02-15" }), tx("50c", "SALE_PROCEEDS", 20, { date: "2026-03-25" })];
  assert.equal(run(rows, c).metricsV2.operating.fullMonthOperatingAverage.value, 100);
});

test("overlap month is one calendar observation and deduplicated cash", () => {
  const c = coverage([{ month: "2026-01", status: "OVERLAP" }]);
  const rows = [tx("51a", "SALE_PROCEEDS", 100), tx("51b", "SALE_PROCEEDS", 100, { duplicateStatus: "EXACT", duplicateOfTransactionId: "51a" })];
  const { metricsV2 } = run(rows, c);
  assert.equal(metricsV2.monthly.length, 1);
  assert.equal(metricsV2.monthly[0].operatingReceipts, 100);
});

test("fewer than four FULL months makes trend unavailable", () => {
  const c = coverage([1, 2, 3].map((n) => ({ month: `2026-0${n}`, status: "FULL" })));
  const rows = [1, 2, 3].map((n) => tx(`52${n}`, "SALE_PROCEEDS", n * 100, { date: `2026-0${n}-15` }));
  assert.equal(run(rows, c).metricsV2.operating.trendStatus, "INSUFFICIENT_DATA");
});

test("four FULL months produce deterministic trend", () => {
  const c = coverage([1, 2, 3, 4].map((n) => ({ month: `2026-0${n}`, status: "FULL" })));
  const rows = [1, 2, 3, 4].map((n) => tx(`53${n}`, "SALE_PROCEEDS", n <= 2 ? 100 : 200, { date: `2026-0${n}-15` }));
  assert.equal(run(rows, c).metricsV2.operating.operatingReceiptsTrend.value, 100);
});

test("fewer than three FULL months makes volatility unavailable", () => {
  const c = coverage([1, 2].map((n) => ({ month: `2026-0${n}`, status: "FULL" })));
  const rows = [1, 2].map((n) => tx(`54${n}`, "SALE_PROCEEDS", 100, { date: `2026-0${n}-15` }));
  assert.equal(run(rows, c).metricsV2.operating.operatingReceiptsVolatility.value, null);
});

test("seasonality eligibility requires twelve FULL months", () => {
  const c = coverage(Array.from({ length: 12 }, (_, index) => ({ month: `2026-${String(index + 1).padStart(2, "0")}`, status: "FULL" })));
  const rows = c.map((item, index) => tx(`55${index}`, "SALE_PROCEEDS", 100, { date: `${item.month}-15` }));
  assert.equal(run(rows, c).metricsV2.operating.seasonalityStatus, "ELIGIBLE");
});

test("confirmed absence of debt produces known zero", () => {
  const metric = run([tx("56", "SALE_PROCEEDS", 100)]).metricsV2.debtService.debtServiceCashOutflow;
  assert.equal(metric.value, 0);
  assert.equal(metric.status, "KNOWN");
});

test("zero operating receipts makes debt ratio null", () => {
  const ratio = run([tx("57", "LOAN_PRINCIPAL_PAYMENT", 100)]).metricsV2.debtService.debtServiceToOperatingReceipts;
  assert.equal(ratio.value, null);
  assert.equal(ratio.status, "NOT_APPLICABLE");
});

test("valid debt components are split without double counting", () => {
  const components = [{ category: "LOAN_PRINCIPAL_PAYMENT", amount: 900, confidence: "HIGH" }, { category: "INTEREST_PAYMENT", amount: 100, confidence: "HIGH" }];
  const metrics = run([tx("58", "DEBT_SERVICE_UNSPLIT", 1_000, { components })]).metricsV2.debtService;
  assert.equal(metrics.loanPrincipalPaid.value, 900);
  assert.equal(metrics.interestPaid.value, 100);
  assert.equal(metrics.unsplitDebtService.value, 0);
  assert.equal(metrics.debtServiceCashOutflow.value, 1_000);
  assert.equal(metrics.loanPrincipalPaid.transactionCount, 1);
  assert.equal(metrics.interestPaid.confidenceBreakdown.highConfidenceAmount, 100);
});

test("invalid debt component split is rejected", () => {
  const components = [{ category: "LOAN_PRINCIPAL_PAYMENT", amount: 900, confidence: "HIGH" }, { category: "INTEREST_PAYMENT", amount: 200, confidence: "HIGH" }];
  const metrics = run([tx("59", "DEBT_SERVICE_UNSPLIT", 1_000, { components })]).metricsV2.debtService;
  assert.equal(metrics.unsplitDebtService.value, 1_000);
  assert.ok(metrics.unsplitDebtService.warnings.some((warning) => warning.startsWith("INVALID_DEBT_COMPONENT_SPLIT")));
});

test("large LOW-confidence amount reduces metric confidence", () => {
  const metric = run([tx("60a", "SALE_PROCEEDS", 20), tx("60b", "SALE_PROCEEDS", 80, { confidence: "LOW" })]).metricsV2.operating.operatingCashReceipts;
  assert.equal(metric.confidence, "LOW");
  assert.equal(metric.confidenceBreakdown.lowConfidenceAmount, 80);
});

test("large UNKNOWN inflow share reduces quality confidence", () => {
  const result = run([tx("61a", "SALE_PROCEEDS", 20), tx("61b", "UNKNOWN_INFLOW", 80, { confidence: "UNKNOWN" })]).metricsV2;
  assert.equal(result.quality.unknownInflowShare, 0.8);
  assert.ok(result.quality.warnings.includes("MATERIAL_UNKNOWN_INFLOW_SHARE"));
  assert.equal(result.operating.operatingCashReceipts.confidence, "LOW");
});

test("Block 4 stays shadow-only and preserves the authoritative projection", () => {
  const result = analyzeBankStatement(block2StatementFixture(), "block4-shadow.txt");
  assert.equal(result.metricsV2?.version, BANK_STATEMENT_METRICS_VERSION);
  assert.equal(result.metricsV2?.mode, "SHADOW");
  assert.equal(result.score, 872);
  assert.equal(result.grade, "A");
  assert.equal(result.readiness, "Высокая готовность");
  assert.equal(result.metrics.estimatedLimitMin, 1_283_000);
  assert.equal(result.metrics.estimatedLimitMax, 2_636_000);
});

test("metric codes are stable and unique", () => {
  const { metricsV2 } = run([tx("codes", "SALE_PROCEEDS", 100)]);
  const codes = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.code === "string" && value.code.startsWith("BSM-")) codes.push(value.code);
    for (const child of Object.values(value)) walk(child);
  };
  walk(metricsV2);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.length >= 60);
});

test("10,000 transactions across 30 sources and 12 months remain linear-scale", () => {
  const c = coverage(Array.from({ length: 12 }, (_, index) => ({ month: `2026-${String(index + 1).padStart(2, "0")}`, status: "FULL" })));
  const rows = Array.from({ length: 10_000 }, (_, index) => tx(`perf-${index}`, index % 10 === 0 ? "MARKETPLACE_SETTLEMENT" : "SALE_PROCEEDS", 100 + index % 50, {
    date: `${c[index % 12].month}-${String(index % 27 + 1).padStart(2, "0")}`,
    sourceId: `source-${index % 30}`,
    tags: index % 10 === 0 ? ["MARKETPLACE", "PAYMENT_INTERMEDIARY"] : [],
  }));
  const started = performance.now();
  const { metricsV2 } = run(rows, c);
  const elapsed = performance.now() - started;
  assert.equal(metricsV2.cashFlow.grossExternalCashInflow.transactionCount, 10_000);
  assert.ok(elapsed < 10_000, `metrics calculation took ${elapsed.toFixed(1)}ms`);
});
