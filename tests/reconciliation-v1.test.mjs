import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { buildFacts, bankFacts, financialFacts, bkiFacts } from "../lib/credit-engine/reconciliation/facts.ts";
import { buildReconciliation, reconcileFacts, defaultRules } from "../lib/credit-engine/reconciliation/engine.ts";
import { buildReconciliationShadow, reconciliationForAnalysis } from "../lib/credit-engine/reconciliation/integration.ts";
import { compareLegacyReconciliation } from "../lib/credit-engine/reconciliation/legacy-comparison.ts";
import { calendarMonths, gapDays, monthBounds } from "../lib/credit-engine/reconciliation/periods.ts";
import { finding } from "../lib/credit-engine/reconciliation/common.ts";
import { normalizeSnapshot } from "../lib/credit-engine/financial-analysis/normalizer.ts";
import { annualPeriod, parseFinancialPeriod } from "../lib/credit-engine/financial-analysis/periods.ts";
import { buildFinancialAnalysis } from "../lib/credit-engine/financial-analysis/engine.ts";
import { buildBankStatementMetricsV2 } from "../lib/credit-engine/metrics/engine.ts";
import { analyzeBankStatement, analysisForStorage } from "../lib/prescore.ts";
import { analysisView } from "../lib/entitlements.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";

const inn = "7701234567";
const source = (sourceType = "BFO", changes = {}) => ({ sourceId: `${sourceType}:current`, sourceType, companyInn: inn, status: "READY", confidence: 95, receivedAt: "2026-04-01", warnings: [], contentHash: `${sourceType}-hash`, ...changes });
const base = analyzeBankStatement(block2StatementFixture(), "parity.txt");
const raw = { "1600": 10000, "1100": 4000, "1200": 6000, "1210": 1000, "1230": 2000, "1250": 3000, "1300": 5000, "1400": 2000, "1410": 1500, "1500": 3000, "1510": 500, "1520": 2500, "1700": 10000, "2110": 12000, "2120": -7000, "2100": 5000, "2200": 3000, "2330": -100, "2300": 2900, "2400": 2300 };
function snapshot(type = "BFO", period = annualPeriod(2025), values = {}, options = {}) {
  return normalizeSnapshot({ source: source(type), period, rawLines: { ...raw, ...values }, scale: 1, ...options });
}
function bank(from = "2025-01-01", to = "2025-12-31", receipts = 1000) {
  const b = structuredClone(base.metricsV2), months = calendarMonths(from, to) ?? [];
  b.period = { from, to, fullMonths: months.length, partialMonths: 0, missingMonths: 0, overlapMonths: 0 };
  b.quality = { ...b.quality, sourceIntegrityConfidence: 95, warnings: [] };
  for (const group of Object.values(b)) if (group && typeof group === "object" && !Array.isArray(group)) {
    for (const m of Object.values(group)) if (m && typeof m === "object" && "code" in m) Object.assign(m, { value: 0, status: "KNOWN", confidence: "HIGH", periodFrom: from, periodTo: to, warnings: [] });
  }
  b.operating.operatingCashReceipts.value = months.length * receipts;
  b.liquidity.endingBalance.value = 3000;
  b.debtService.loanPrincipalPaid.value = months.length * 80;
  b.debtService.interestPaid.value = months.length * 20;
  b.monthly = months.map(month => ({ month, coverage: "FULL", operatingReceipts: receipts, externalInflows: receipts + 10000, externalOutflows: 500, supplierPayments: 200, taxPayments: 10, payrollPayments: 10, debtService: 100, unclearIndividualAndCash: 0, unknownInflows: 500, warnings: [] }));
  return b;
}
function bki(changes = {}) {
  return { source: "БКИ", subjectType: "Юридическое лицо", subjectName: "Компания", subjectInn: inn, relationshipToCompany: "Компания-заёмщик", affectsCompanyDebt: true,
    reportDate: "2025-12-31", parserConfidence: 95, fileName: "credit.pdf", obligations: [], warnings: [],
    summary: { outstandingPrincipal: 2000, totalOutstanding: 2200, monthlyPayment: 100, overdueAmount: 0, guaranteeExposure: 90000,
      knownValues: { outstandingPrincipal: true, totalOutstanding: true, monthlyPayment: true, overdueAmount: true, guaranteeExposure: true } }, ...changes };
}
function input(changes = {}) {
  return { companyInn: inn, bank: bank(), snapshots: [snapshot()], manifest: { bankStatements: [source("BANK_STATEMENT")], bfo: source(), bki: source("BKI") }, ...changes };
}
const run = changes => buildReconciliation(input(changes));
const rule = (result, code) => result.findings.find(f => f.code === code);
const rev = changes => rule(run(changes), "REC-REV");
const cash = changes => rule(run(changes), "REC-CASH");
const stock = changes => rule(run({ bki: bki(), ...changes }), "REC-BKI-1");
const debt = changes => rule(run({ bank: bank("2025-10-01", "2025-12-31"), bki: bki(), ...changes }), "REC-BKI-2");
const fact = (facts, code) => facts.find(f => f.semanticCode === code);

test("bank adapter retains source IDs and metric code", () => { const f = fact(bankFacts(input()), "BANK_OPERATING_RECEIPTS"); assert.deepEqual(f.sourceIds, ["BANK_STATEMENT:current"]); assert.equal(f.sourceMetricCode, bank().operating.operatingCashReceipts.code); assert.equal(f.companyInn, inn); });
test("bank ending balance is a snapshot", () => assert.deepEqual(fact(bankFacts(input()), "BANK_ENDING_BALANCE").period, { kind: "SNAPSHOT", from: null, to: null, asOf: "2025-12-31" }));
test("bank monthly and overall receipts are distinct facts", () => { const f = bankFacts(input()); assert.equal(f.filter(f => f.semanticCode === "BANK_MONTHLY_OPERATING_RECEIPTS").length, 12); assert.equal(fact(f, "BANK_OPERATING_RECEIPTS").value, 12000); });
for (const code of ["BANK_FINANCING_INFLOWS", "BANK_LOAN_INFLOW", "BANK_OTHER_LOAN_INFLOW", "BANK_OWNER_LOAN_INFLOW", "BANK_FACTORING_INFLOW", "BANK_LOAN_PRINCIPAL_PAID", "BANK_INTEREST_PAID", "BANK_UNSPLIT_DEBT_SERVICE", "BANK_LEASING_PAID", "BANK_TAX_PAID"]) test(`bank canonical fact ${code} has provenance`, () => { const f = fact(bankFacts(input()), code); assert.equal(f.status, "KNOWN"); assert.ok(f.sourceMetricCode); assert.ok(f.calculationBasis); });
test("financial adapter raw code retained", () => assert.equal(fact(financialFacts(input()), "REVENUE").rawCode, "2110"));
test("financial adapter raw label retained without invented code", () => { const s = snapshot(); s.income.REVENUE.rawLabel = "Выручка"; delete s.income.REVENUE.rawCode; const f = fact(financialFacts(input({ snapshots: [s] })), "REVENUE"); assert.equal(f.rawLabel, "Выручка"); assert.equal(f.rawCode, undefined); });
test("FinancialAnalysisV2 accepted without duplicate snapshot input", () => { const s = snapshot(); const a = buildFinancialAnalysis([s]); const f = financialFacts({ companyInn: inn, financialAnalysis: a }); assert.equal(fact(f, "TOTAL_BORROWINGS").value, 2000); assert.ok(fact(f, "REVENUE").sourceMetricCode); });
test("financial missing borrowing not zero", () => assert.equal(fact(financialFacts(input({ snapshots: [snapshot("BFO", annualPeriod(2025), { "1510": undefined })] })), "TOTAL_BORROWINGS").value, null));
test("BKI known flags required for old serialized summary", () => { const r = bki(); delete r.summary.knownValues; assert.equal(fact(bkiFacts(input({ bki: r })), "BKI_MONTHLY_PAYMENT").status, "UNKNOWN"); });
test("BKI explicitly reported zero stays known", () => { const r = bki(); r.summary.monthlyPayment = 0; const f = fact(bkiFacts(input({ bki: r })), "BKI_MONTHLY_PAYMENT"); assert.equal(f.status, "KNOWN"); assert.equal(f.value, 0); });
test("BKI guarantees kept separate", () => { const f = bkiFacts(input({ bki: bki() })); assert.equal(fact(f, "BKI_OUTSTANDING_PRINCIPAL").value, 2000); assert.equal(fact(f, "BKI_GUARANTEE_EXPOSURE").value, 90000); });
test("failed financial source unavailable", () => { const s = snapshot(); s.source.status = "FAILED"; assert.equal(fact(financialFacts(input({ snapshots: [s] })), "REVENUE").value, null); });
test("failed BKI source unavailable", () => { const i = input({ bki: bki() }); i.manifest.bki.status = "FAILED"; assert.equal(fact(bkiFacts(i), "BKI_MONTHLY_PAYMENT").value, null); });
test("failed bank source unavailable", () => { const i = input(); i.manifest.bankStatements[0].status = "FAILED"; assert.equal(fact(bankFacts(i), "BANK_OPERATING_RECEIPTS").value, null); });

for (const [name, from, to, period, expected] of [
  ["FY", "2025-01-01", "2025-12-31", annualPeriod(2025), 12000],
  ["9M", "2025-01-01", "2025-09-30", parseFinancialPeriod("9 месяцев 2025"), 9000],
  ["6M", "2025-01-01", "2025-06-30", parseFinancialPeriod("6 месяцев 2025"), 6000],
  ["Q2", "2025-04-01", "2025-06-30", parseFinancialPeriod("2 квартал 2025"), 3000],
  ["subset of wider history", "2024-01-01", "2026-12-31", parseFinancialPeriod("9 месяцев 2025"), 9000],
]) test(`exact FULL month alignment ${name}`, () => { const f = rev({ bank: bank(from, to), snapshots: [snapshot("QUARTERLY", period)] }); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.equal(f.leftFacts[0].value, expected); assert.equal(f.comparability, "FULL_MONTH_ALIGNED"); });
for (const [name, mutate, reason] of [
  ["11 months", b => b.monthly.pop(), "MISSING_BANK_MONTH"],
  ["one partial", b => b.monthly[4].coverage = "PARTIAL", "PARTIAL_BANK_MONTH"],
  ["one missing", b => b.monthly[4].coverage = "MISSING", "MISSING_BANK_MONTH"],
  ["one overlap", b => b.monthly[4].coverage = "OVERLAP", "OVERLAP_BANK_MONTH"],
  ["duplicate month", b => b.monthly.push(structuredClone(b.monthly[0])), "OVERLAP_BANK_MONTH"],
  ["missing amount", b => b.monthly[0].operatingReceipts = undefined, "MISSING_NOT_ZERO"],
]) test(`bank alignment rejects ${name}`, () => { const b = bank(); mutate(b); const f = rev({ bank: b }); assert.equal(f.outcome, "INSUFFICIENT_DATA"); assert.ok(f.reasonCodes.includes(reason)); assert.equal(f.ratio, null); });
test("9M vs Jan-Aug is insufficient", () => assert.equal(rev({ bank: bank("2025-01-01", "2025-08-31"), snapshots: [snapshot("QUARTERLY", parseFinancialPeriod("9 месяцев 2025"))] }).outcome, "INSUFFICIENT_DATA"));
for (const [from, to] of [[null, null], ["2025-01-02", "2025-03-31"], ["2025-01-01", "2025-03-30"], ["2025-02-30", "2025-03-31"], ["2025-03-01", "2025-01-31"]]) test(`invalid or incomplete boundaries ${from}/${to}`, () => assert.equal(calendarMonths(from, to), null));
test("leap February is a complete month", () => assert.deepEqual(calendarMonths("2024-02-01", "2024-02-29"), ["2024-02"]));
test("invalid month rejected", () => assert.deepEqual(monthBounds("2025-13"), { from: null, to: null }));

function same(code, values = {}, options = {}) {
  const left = snapshot("BFO", annualPeriod(2025), {}, options.left), right = snapshot("QUARTERLY", options.period ?? annualPeriod(2025), values, options.right);
  return rule(run({ snapshots: [left, right], bank: undefined }), `REC-FIN-${code}`);
}
for (const field of ["REVENUE", "ASSETS_TOTAL", "NET_PROFIT", "CASH", "EQUITY", "LONG_TERM_BORROWINGS", "SHORT_TERM_BORROWINGS"]) test(`same accounting fact agreement ${field}`, () => assert.equal(same(field).outcome, "AGREES"));
test("rounding within technical tolerance", () => assert.equal(same("REVENUE", { "2110": 12005 }).outcome, "WITHIN_TOLERANCE"));
test("different normalized reporting scales agree", () => assert.equal(same("REVENUE", { "2110": 12 }, { right: { scale: 1000 } }).outcome, "AGREES"));
test("scale-aware rounding accepted", () => assert.equal(same("REVENUE", { "2110": 13 }, { right: { scale: 1000 } }).outcome, "WITHIN_TOLERANCE"));
for (const [field, code] of [["REVENUE", "2110"], ["ASSETS_TOTAL", "1600"]]) test(`same-fact material ${field} conflict requires data review`, () => { const f = same(field, { [code]: 20000 }); assert.equal(f.outcome, "CONFLICT"); assert.equal(f.requiresDataReview, true); });
test("negative profits compared with signs", () => { const f = same("NET_PROFIT", { "2400": -2300 }); assert.equal(f.absoluteDifference, 4600); assert.equal(f.outcome, "CONFLICT"); });
test("known zero same-fact agreement", () => { const l = snapshot("BFO", annualPeriod(2025), { "2110": 0 }), r = snapshot("QUARTERLY", annualPeriod(2025), { "2110": 0 }); assert.equal(rule(run({ snapshots: [l, r] }), "REC-FIN-REVENUE").outcome, "AGREES"); });
test("zero vs positive same-fact conflict", () => assert.equal(same("REVENUE", { "2110": 0 }).outcome, "CONFLICT"));
test("missing vs reported zero never agreement", () => { const l = snapshot("BFO", annualPeriod(2025), { "2110": undefined }), r = snapshot("QUARTERLY", annualPeriod(2025), { "2110": 0 }); assert.equal(rule(run({ snapshots: [l, r] }), "REC-FIN-REVENUE").outcome, "INSUFFICIENT_DATA"); });
test("annual vs 9M has one pair diagnostic, no field conflicts", () => { const r = run({ snapshots: [snapshot(), snapshot("QUARTERLY", parseFinancialPeriod("9 месяцев 2026"))] }); const f = r.findings.filter(f => f.code.startsWith("REC-FIN")); assert.equal(f.length, 1); assert.equal(f[0].outcome, "NOT_COMPARABLE"); });
test("same balance asOf but different income span", () => { const p = { ...parseFinancialPeriod("4 квартал 2025") }; assert.equal(same("ASSETS_TOTAL", {}, { period: p }).outcome, "AGREES"); assert.equal(same("REVENUE", {}, { period: p }), undefined); });
test("Q1 and exact 3M YTD income comparable", () => { const a = snapshot("BFO", parseFinancialPeriod("1 квартал 2025")), b = snapshot("QUARTERLY", parseFinancialPeriod("3 месяца 2025")); assert.equal(rule(run({ snapshots: [a, b] }), "REC-FIN-REVENUE").outcome, "AGREES"); });
test("reported net assets compared only to reported", () => assert.equal(same("REPORTED_NET_ASSETS", {}, { left: { reportedNetAssets: 5000 }, right: { reportedNetAssets: 5000 } }).outcome, "AGREES"));
test("equity proxy never emitted as reported net assets", () => { const r = run({ snapshots: [snapshot(), snapshot("QUARTERLY")] }); assert.equal(rule(r, "REC-FIN-REPORTED_NET_ASSETS"), undefined); assert.equal(r.facts.some(f => f.semanticCode.includes("PROXY")), false); });
test("code and label provenance survive same-fact finding", () => { const a = snapshot(), b = snapshot("QUARTERLY"); b.income.REVENUE.rawLabel = "Выручка"; delete b.income.REVENUE.rawCode; const f = rule(run({ snapshots: [a, b] }), "REC-FIN-REVENUE"); assert.equal(f.leftFacts[0].rawCode, "2110"); assert.equal(f.rightFacts[0].rawLabel, "Выручка"); assert.equal(f.rightFacts[0].rawCode, undefined); });

for (const [name, receipts, revenue, direction, ratio] of [["equal", 1000, 12000, "EQUAL", 1], ["bank lower", 500, 12000, "LEFT_BELOW_RIGHT", .5], ["bank higher", 2000, 12000, "LEFT_ABOVE_RIGHT", 2], ["accounting zero", 1000, 0, "LEFT_ABOVE_RIGHT", null], ["bank zero", 0, 12000, "LEFT_BELOW_RIGHT", 0], ["both zero", 0, 0, "EQUAL", null]]) test(`cash vs accrual ${name} is relationship only`, () => { const f = rev({ bank: bank(undefined, undefined, receipts), snapshots: [snapshot("BFO", annualPeriod(2025), { "2110": revenue })] }); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.equal(f.direction, direction); assert.equal(f.ratio, ratio); assert.equal(f.requiresDataReview, false); assert.ok(f.reasonCodes.includes("BANK_ACCOUNT_SET_NOT_PROVEN_COMPLETE")); });
for (const [name, metric] of [["factoring", "factoringInflow"], ["owner loan", "ownerLoanInflow"], ["financing", "financingCashInflow"]]) test(`${name} never replaces operating receipts`, () => { const b = bank(); b.financing[metric].value = 1000000; assert.equal(rev({ bank: b }).leftFacts[0].value, 12000); });
test("unknown inflows and gross external inflows excluded", () => { const b = bank(); b.cashFlow.grossExternalCashInflow.value = 9999999; b.monthly.forEach(m => m.unknownInflows = 90000); assert.equal(rev({ bank: b }).leftFacts[0].value, 12000); });
for (const [category, included] of [["SALE_PROCEEDS", true], ["MARKETPLACE_SETTLEMENT", true], ["ACQUIRING_SETTLEMENT", true], ["FACTORING_PROCEEDS", false], ["OWNER_LOAN_RECEIVED", false], ["BANK_LOAN_RECEIVED", false], ["REFUND_RECEIVED", false], ["UNKNOWN_INFLOW", false], ["INTERNAL_TRANSFER", false]]) test(`real Block 4 operating definition: ${category}`, () => {
  const s = source("BANK_STATEMENT"), transaction = { id: "canonical-1", canonicalTransactionId: "canonical-1", sourceId: s.sourceId, sourceFileName: "bank.txt", date: "2025-01-15", amount: 100,
    direction: "in", counterparty: "Компания", counterpartyInn: "7701111111", purpose: category, category: "other", account: "40702810000000000001", duplicateStatus: "NOT_DUPLICATE",
    classification: { version: "PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW", family: "OTHER", primaryCategory: category, confidence: "HIGH", ruleCode: "fixture", evidence: [], alternatives: [], tags: [], requiresReview: false, ambiguityReasons: [] } };
  const integrity = { ...structuredClone(base.integrity), confidence: 100, calendarCoverage: [{ month: "2025-01", status: "FULL", daysCovered: 31, calendarDays: 31, sourceIds: [s.sourceId], warnings: [] }] };
  const b = buildBankStatementMetricsV2({ transactions: [transaction], integrity, sourceManifest: { bankStatements: [s] }, periodFrom: "2025-01-01", periodTo: "2025-01-31", legacyMetrics: { endingBalance: 100 } }).metricsV2;
  const period = { ...parseFinancialPeriod("1 квартал 2025"), to: "2025-01-31", asOf: "2025-01-31", monthsCovered: 1 };
  const f = rev({ bank: b, snapshots: [snapshot("QUARTERLY", period)] });
  assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.equal(f.leftFacts[0].value, included ? 100 : 0);
});
test("large cash/accrual gap preserves source confidence", () => { const f = rev({ bank: bank(undefined, undefined, 1000000) }); assert.equal(f.evidenceConfidence, "HIGH"); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); });
for (const [name, bankValue, cashValue] of [["equal", 3000, 3000], ["lower", 1000, 3000], ["higher", 5000, 3000], ["accounting zero", 1000, 0], ["bank zero", 0, 3000]]) test(`cash stocks ${name} never conflict`, () => { const b = bank(); b.liquidity.endingBalance.value = bankValue; const f = cash({ bank: b, snapshots: [snapshot("BFO", annualPeriod(2025), { "1250": cashValue })] }); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.equal(f.absoluteDifference, Math.abs(bankValue - cashValue)); assert.ok(f.reasonCodes.includes("ACCOUNTING_CASH_MAY_INCLUDE_CASH_EQUIVALENTS")); });
test("cash asOf mismatch", () => assert.equal(cash({ bank: bank("2025-01-01", "2025-11-30") }).outcome, "NOT_COMPARABLE"));
test("unknown bank ending balance unavailable", () => { const b = bank(); b.liquidity.endingBalance.value = null; b.liquidity.endingBalance.status = "UNKNOWN"; assert.equal(cash({ bank: b }).outcome, "INSUFFICIENT_DATA"); });
test("unknown accounting cash unavailable", () => assert.equal(cash({ snapshots: [snapshot("BFO", annualPeriod(2025), { "1250": undefined })] }).outcome, "INSUFFICIENT_DATA"));

for (const [relationship, expected] of [["Компания-заёмщик", "RELATIONSHIP_OBSERVED"], ["ИП-заёмщик", "RELATIONSHIP_OBSERVED"], ["Собственник", "NOT_COMPARABLE"], ["Поручитель", "NOT_COMPARABLE"], ["Руководитель", "NOT_COMPARABLE"], ["Не указано", "NOT_COMPARABLE"]]) test(`BKI subject scope ${relationship}`, () => { const r = bki({ relationshipToCompany: relationship }); assert.equal(stock({ bki: r }).outcome, expected); assert.equal(debt({ bki: r }).outcome, expected); });
test("affectsCompanyDebt false rejects debt comparisons", () => { const f = debt({ bki: bki({ affectsCompanyDebt: false }) }); assert.equal(f.outcome, "NOT_COMPARABLE"); assert.ok(f.reasonCodes.includes("BKI_DOES_NOT_AFFECT_COMPANY_DEBT")); });
test("personal INN is not a company identity conflict", () => { const r = run({ bki: bki({ subjectInn: "123456789012", relationshipToCompany: "Собственник", affectsCompanyDebt: false }) }); assert.equal(r.findings.some(f => f.outcome === "CONFLICT"), false); });
test("company BKI INN mismatch is a factual identity conflict", () => { const r = run({ bki: bki({ subjectInn: "7709999999" }) }); assert.ok(r.findings.some(f => f.code === "REC-ID" && f.outcome === "CONFLICT")); assert.equal(rule(r, "REC-BKI-1").outcome, "NOT_COMPARABLE"); });
test("missing BKI subject INN never assumed company", () => assert.equal(stock({ bki: bki({ subjectInn: "" }) }).outcome, "NOT_COMPARABLE"));
test("conflicting bank envelope prevents cash relationship", () => { const i = input(); i.manifest.bankStatements[0].companyInn = "7709999999"; const r = buildReconciliation(i); assert.equal(rule(r, "REC-CASH").outcome, "NOT_COMPARABLE"); assert.ok(r.findings.some(f => f.code === "REC-ID" && f.outcome === "CONFLICT")); });
for (const days of [0, 1, 30, 45, 46, 100]) test(`BKI financial date gap ${days} days`, () => { const date = new Date(Date.parse("2025-12-31") + days * 86400000).toISOString().slice(0, 10); const f = stock({ bki: bki({ reportDate: date }) }); assert.equal(f.temporalGapDays, days); assert.equal(f.outcome, days <= 45 ? "RELATIONSHIP_OBSERVED" : "NOT_COMPARABLE"); assert.equal(f.comparability, days === 0 ? "EXACT_ASOF" : days <= 45 ? "NEAR_ASOF" : "NONE"); });
test("nearest financial snapshot chosen deterministically", () => { const f = stock({ snapshots: [snapshot("BFO", annualPeriod(2024)), snapshot("QUARTERLY", annualPeriod(2025))] }); assert.equal(f.rightFacts[0].sourceType, "QUARTERLY"); });
for (const [principal, borrowing] of [[0, 2000], [2000, 0], [0, 0]]) test(`BKI borrowing zero safety ${principal}/${borrowing}`, () => { const r = bki(); r.summary.outstandingPrincipal = principal; const f = stock({ bki: r, snapshots: [snapshot("BFO", annualPeriod(2025), { "1410": borrowing, "1510": 0 })] }); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.equal(f.ratio, borrowing > 0 ? principal / borrowing : null); });
test("unknown BKI outstanding unavailable", () => { const r = bki(); r.summary.knownValues.outstandingPrincipal = false; assert.equal(stock({ bki: r }).outcome, "INSUFFICIENT_DATA"); });
test("unknown accounting borrowings unavailable", () => assert.equal(stock({ snapshots: [snapshot("BFO", annualPeriod(2025), { "1410": undefined })] }).outcome, "INSUFFICIENT_DATA"));
test("BKI/accounting definition reasons retained", () => { const f = stock(); assert.ok(f.reasonCodes.includes("BKI_MAY_EXCLUDE_NON_BUREAU_BORROWINGS")); assert.ok(f.reasonCodes.includes("ACCOUNTING_BORROWINGS_MAY_INCLUDE_NON_BANK_LOANS")); assert.equal(f.leftFacts[0].value, 2000); });
for (const [months, from] of [[3, "2025-10-01"], [6, "2025-07-01"], [7, "2025-06-01"], [12, "2025-01-01"]]) test(`BKI payment historical span ${months} months`, () => assert.equal(debt({ bank: bank(from, "2025-12-31") }).outcome, months <= 6 ? "RELATIONSHIP_OBSERVED" : "NOT_COMPARABLE"));
for (const status of ["PARTIAL", "MISSING", "OVERLAP"]) test(`BKI debt comparison rejects ${status} month`, () => { const b = bank("2025-10-01", "2025-12-31"); b.monthly[0].coverage = status; const f = debt({ bank: b }); assert.equal(f.outcome, "INSUFFICIENT_DATA"); assert.ok(f.reasonCodes.includes(`${status}_BANK_MONTH`)); });
test("BKI payment rejects report gap above 45 days", () => assert.equal(debt({ bki: bki({ reportDate: "2026-03-01" }) }).outcome, "NOT_COMPARABLE"));
test("principal plus interest monthly observed", () => assert.equal(debt().rightFacts[0].value, 100));
test("unsplit included with warning and confidence cap", () => { const b = bank("2025-10-01", "2025-12-31"); b.debtService.unsplitDebtService.value = 60; const f = debt({ bank: b }); assert.equal(f.rightFacts[0].value, 120); assert.equal(f.evidenceConfidence, "MEDIUM"); assert.ok(f.reasonCodes.includes("UNSPLIT_DEBT_SERVICE_PRESENT")); });
test("leasing and factoring fees excluded from observed", () => { const b = bank("2025-10-01", "2025-12-31"); b.debtService.leasingPaid.value = 99999; b.debtService.factoringFeeAmount.value = 88888; b.debtService.debtServiceCashOutflow.value = 999999; assert.equal(debt({ bank: b }).rightFacts[0].value, 100); });
for (const [payment, reason] of [[200, "BKI_SCHEDULE_ABOVE_OBSERVED"], [50, "OBSERVED_ABOVE_BKI_SCHEDULE"], [100, "VALUES_EQUAL"], [0, "OBSERVED_ABOVE_BKI_SCHEDULE"]]) test(`BKI scheduled payment ${payment}`, () => { const r = bki(); r.summary.monthlyPayment = payment; const f = debt({ bki: r }); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.ok(f.reasonCodes.includes(reason)); });
test("positive BKI and bank zero is not absence of loan", () => { const b = bank("2025-10-01", "2025-12-31"); b.debtService.loanPrincipalPaid.value = 0; b.debtService.interestPaid.value = 0; const f = debt({ bank: b }); assert.equal(f.outcome, "RELATIONSHIP_OBSERVED"); assert.equal(f.ratio, null); assert.ok(f.reasonCodes.includes("BKI_PAYMENT_NOT_VISIBLE_IN_PROVIDED_STATEMENTS")); });
test("unknown BKI monthly payment never zero", () => { const r = bki(); r.summary.knownValues.monthlyPayment = false; assert.equal(debt({ bki: r }).outcome, "INSUFFICIENT_DATA"); });
for (const component of ["loanPrincipalPaid", "interestPaid", "unsplitDebtService"]) test(`every observed component required: ${component}`, () => { const b = bank("2025-10-01", "2025-12-31"); b.debtService[component].status = "UNKNOWN"; b.debtService[component].value = null; assert.equal(debt({ bank: b }).outcome, "INSUFFICIENT_DATA"); });

test("STALE lowers source confidence", () => { const s = snapshot(); s.source.status = "STALE"; assert.equal(rev({ snapshots: [s] }).evidenceConfidence, "MEDIUM"); });
test("unknown parser confidence propagates", () => { const s = snapshot(); s.quality.parserConfidence = null; assert.equal(rev({ snapshots: [s] }).evidenceConfidence, "UNKNOWN"); });
test("low BKI parser confidence bounds relation", () => assert.equal(stock({ bki: bki({ parserConfidence: 30 }) }).evidenceConfidence, "LOW"));
test("low financial fact bounds relation", () => { const s = snapshot(); s.income.REVENUE.confidence = "LOW"; assert.equal(rev({ snapshots: [s] }).evidenceConfidence, "LOW"); });
test("low bank metric bounds relation", () => { const b = bank(); b.operating.operatingCashReceipts.confidence = "LOW"; assert.equal(rev({ bank: b }).evidenceConfidence, "LOW"); });
test("same-fact conflict cannot promote confidence", () => { const a = snapshot(), b = snapshot("QUARTERLY", annualPeriod(2025), { "2110": 20000 }); a.income.REVENUE.confidence = "LOW"; const f = rule(run({ snapshots: [a, b] }), "REC-FIN-REVENUE"); assert.equal(f.outcome, "CONFLICT"); assert.equal(f.evidenceConfidence, "LOW"); });
test("unknown source status propagates", () => { const i = input(); i.manifest.bankStatements[0].status = "PROCESSING"; assert.equal(rev(i).outcome, "INSUFFICIENT_DATA"); });

test("no source gives diagnostics without crash or credit verdict", () => { const r = buildReconciliation({ companyInn: inn }); assert.equal(r.summary.sourceMissingCount, 4); assert.equal(r.summary.conflictCount, 0); });
test("one source gives no false cross-source conflict", () => { const r = run({ bank: undefined }); assert.equal(r.summary.conflictCount, 0); });
test("deterministic output and no input mutation", () => { const i = input({ bki: bki() }), before = structuredClone(i); assert.deepEqual(buildReconciliation(i), buildReconciliation(i)); assert.deepEqual(i, before); });
test("source and fact permutation preserves output", () => { const d = buildFacts(input()); assert.deepEqual(reconcileFacts(d), reconcileFacts({ ...d, facts: [...d.facts].reverse(), sources: [...d.sources].reverse() })); });
test("extension registry supports EIS without changing core", () => { const f = { ...fact(bankFacts(input()), "BANK_OPERATING_RECEIPTS"), factId: "eis:fact", sourceType: "EIS", sourceIds: ["eis:canonical"], semanticCode: "PROCUREMENT_COMPLETED_CONTRACT_VALUE" }; const custom = { code: "REC-EIS", evaluate: d => [finding("REC-EIS", "FLOW_VS_STOCK", [d.facts.find(x => x.semanticCode === f.semanticCode)], [], "INSUFFICIENT_DATA", "NONE", ["SOURCE_FIELD_UNKNOWN"], "Canonical future EIS extension")] }; const r = buildReconciliation(input({ extraFacts: [f] }), [...defaultRules, custom]); assert.ok(r.sources.sourceTypesPresent.includes("EIS")); assert.ok(rule(r, "REC-EIS")); });
test("shadow failure clears stale result and retains authoritative fields", () => { const failure = buildReconciliationShadow(input(), {}, [{ code: "throw", evaluate() { throw Error("fixture"); } }]); assert.equal(failure.reconciliationV1, undefined); assert.deepEqual(failure.reconciliationWarnings, ["RECONCILIATION_SHADOW_UNAVAILABLE"]); const attached = { ...base, ...failure }; assert.deepEqual(attached.metrics, base.metrics); assert.equal(attached.score, 872); });
test("duplicate registry codes fail closed", () => assert.deepEqual(buildReconciliationShadow(input(), {}, [defaultRules[0], defaultRules[0]]).reconciliationWarnings, ["RECONCILIATION_SHADOW_UNAVAILABLE"]));
test("old serialized analysis without reconciliation still loads", () => { const old = structuredClone(base); delete old.reconciliationV1; delete old.reconciliationComparison; delete old.reconciliationWarnings; assert.equal(analysisView(old, "FULL").score, 872); assert.equal(analysisForStorage(old).reconciliationV1, undefined); });
test("FREE projection unchanged and deep data absent", () => { const old = structuredClone(base); delete old.reconciliationV1; delete old.reconciliationComparison; delete old.reconciliationWarnings; const enriched = { ...old, ...buildReconciliationShadow(input({ bki: bki() })) }; assert.deepEqual(analysisView(enriched, "FREE"), analysisView(old, "FREE")); assert.equal(analysisView(enriched, "FREE").reconciliationV1, undefined); });
test("FULL and storage preserve optional reconciliation", () => { const a = { ...base, ...buildReconciliationShadow(input()) }; assert.deepEqual(analysisForStorage(a).reconciliationV1, a.reconciliationV1); assert.deepEqual(analysisView(a, "FULL").reconciliationV1, a.reconciliationV1); });
test("quarterly replacement excludes old content facts", () => { const old = snapshot("QUARTERLY"), replacement = snapshot("QUARTERLY", annualPeriod(2025), { "2110": 13000 }, { source: source("QUARTERLY", { sourceId: "q:new", contentHash: "new" }) }); const a = { ...base, companyInn: inn, financialStatementsV2: [old, replacement], sourceManifest: { bankStatements: [], quarterly: replacement.source } }; const r = reconciliationForAnalysis(a).reconciliationV1; assert.ok(r.sources.financialSourceIds.includes("q:new")); assert.equal(r.sources.financialSourceIds.includes(old.sourceId), false); });
test("BKI replacement has only current source provenance", () => { const a = { ...base, companyInn: inn, creditHistory: bki(), sourceManifest: { bankStatements: [], bki: source("BKI", { sourceId: "bki:new" }) }, reconciliationV1: run({ bki: bki() }) }; assert.deepEqual(reconciliationForAnalysis(a).reconciliationV1.sources.bkiSourceIds, ["bki:new"]); });
test("profile BFO joins existing analysis in memory", () => { const s = snapshot(), profile = { finances: { revenue: 12000 }, financialStatementsV2: [s], sourceManifest: { bfo: s.source } }; const a = { ...base, companyInn: inn, metricsV2: bank(), sourceManifest: { bankStatements: [source("BANK_STATEMENT")] } }; const before = structuredClone(profile); assert.ok(rule(reconciliationForAnalysis(a, profile).reconciliationV1, "REC-REV")); assert.deepEqual(profile, before); });
test("profile integration preserves lower Block 5 analyzed metric confidence", () => { const s = snapshot(), financialAnalysisV2 = buildFinancialAnalysis([s]); financialAnalysisV2.history[0].amounts.REVENUE.confidence = "LOW"; const profile = { finances: { revenue: 12000 }, financialStatementsV2: [s], financialAnalysisV2, sourceManifest: { bfo: s.source } }; const a = { ...base, companyInn: inn, metricsV2: bank(), sourceManifest: { bankStatements: [source("BANK_STATEMENT")] } }; assert.equal(rule(reconciliationForAnalysis(a, profile).reconciliationV1, "REC-REV").evidenceConfidence, "LOW"); });
test("source status replacement supersedes old snapshot envelope", () => { const s = snapshot("QUARTERLY"), a = { ...base, companyInn: inn, financialStatementsV2: [s], sourceManifest: { bankStatements: [], quarterly: { ...s.source, status: "FAILED" } } }; assert.equal(fact(reconciliationForAnalysis(a).reconciliationV1.facts, "REVENUE").value, null); });
test("legacy annualization compared but not used by new rule", () => { const r = run(), c = compareLegacyReconciliation(r, { avgMonthlyInflow: 5000, bfoRevenue: 12000 }); const f = c.comparisons.find(c => c.metric === "bankFlowAmount"); assert.equal(f.legacyValue, 60000); assert.equal(f.reconciliationValue, 12000); assert.ok(f.reasonCodes.includes("LEGACY_ANNUALIZATION_REMOVED")); });
test("legacy debt comparison retains old amount and alignment reasons", () => { const r = run({ bank: bank("2025-10-01", "2025-12-31"), bki: bki() }), c = compareLegacyReconciliation(r, { statementMonthlyDebtPayment: 500 }).comparisons.find(c => c.metric === "statementMonthlyDebtPayment"); assert.equal(c.legacyValue, 500); assert.equal(c.reconciliationValue, 100); assert.ok(c.reasonCodes.includes("LEASING_EXCLUDED")); });
test("authoritative baseline preserved after shadow attachment", () => { const a = { ...base, ...buildReconciliationShadow(input({ bki: bki() })) }; const strip = x => Object.fromEntries(Object.entries(x).filter(([key]) => !["reconciliationV1", "reconciliationComparison", "reconciliationWarnings"].includes(key))); assert.deepEqual(strip(a), strip(base)); assert.equal(a.score, 872); assert.equal(a.grade, "A"); assert.equal(a.readiness, "Высокая готовность"); assert.equal(a.metrics.estimatedLimitMin, 1283000); assert.equal(a.metrics.estimatedLimitMax, 2636000); });
test("Block 5 input results remain byte-identical", () => { const a = buildFinancialAnalysis([snapshot()]), before = JSON.stringify(a); buildReconciliation(input({ financialAnalysis: a })); assert.equal(JSON.stringify(a), before); });
test("Block 4 input remains byte-identical", () => { const b = bank(), before = JSON.stringify(b); run({ bank: b }); assert.equal(JSON.stringify(b), before); });
test("finite output on overflow", () => { const b = bank(); b.monthly.forEach(m => m.operatingReceipts = Number.MAX_VALUE); const r = run({ bank: b }); assert.ok(rule(r, "REC-REV").reasonCodes.includes("NON_FINITE_RESULT")); assert.equal(JSON.stringify(r).includes("Infinity"), false); });
test("invalid BKI date unavailable", () => assert.equal(stock({ bki: bki({ reportDate: "2025-02-30" }) }).outcome, "INSUFFICIENT_DATA"));
test("calendar gap rejects invalid date", () => assert.equal(gapDays("2025-02-30", "2025-03-01"), null));
test("100 companies with bank, six periods and BKI performance measurement", () => { const i = input({ bki: bki(), snapshots: [...[2021, 2022, 2023, 2024, 2025].map(y => snapshot("BFO", annualPeriod(y))), snapshot("QUARTERLY")] }); const start = performance.now(); let count = 0; for (let n = 0; n < 100; n++) count += buildReconciliation(i).findings.length; console.log(`Block 6 performance: 100 companies, 6 periods, BKI: ${(performance.now() - start).toFixed(1)} ms; ${count} findings`); assert.ok(count > 0); });

test("nearest known borrowings inside the window survive a closer incomplete balance", () => {
  const knownDate = {...annualPeriod(2025), asOf:"2025-12-15"};
  const comparable = snapshot("QUARTERLY", knownDate, {"1410":1200,"1510":300});
  const blank = snapshot("BFO", annualPeriod(2025), {"1410":undefined});
  const f = stock({snapshots:[blank, comparable]});
  assert.equal(f.outcome,"RELATIONSHIP_OBSERVED");
  assert.equal(f.temporalGapDays,16);
  assert.equal(f.leftFacts[0].value,2000);
  assert.equal(f.rightFacts[0].value,1500);
  assert.equal(f.absoluteDifference,500);
});

import {bankBfoComparisons} from "../lib/credit-engine/client-report/bank-bfo.ts";
const flowCard = changes => bankBfoComparisons(run(changes)).find(row => row.accounting.label.includes("выручка"));
test("X02 golden: facts, sources, period and conditional action survive serialization", () => {
  const b = bank(undefined, undefined, 800);
  b.operating.customerAdvanceAmount.value = 174;
  const r = run({bank:b});
  const row = bankBfoComparisons(JSON.parse(JSON.stringify(r))).find(x => x.difference === 2400);
  assert.equal(row.bank.value, 9600);
  assert.equal(row.accounting.value, 12000);
  assert.equal(row.direction, "LEFT_BELOW_RIGHT");
  assert.deepEqual(row.bank.sourceIds, ["BANK_STATEMENT:current"]);
  assert.deepEqual(row.accounting.sourceIds, ["BFO:current"]);
  assert.equal(row.bank.period.from, "2025-01-01");
  assert.deepEqual(row.context.map(f=>f.value).sort((a,b)=>a-b), [174,2000]);
  assert.match(row.action, /авансы/);
  assert.equal(rule(r,"REC-REV").requiresDataReview,false);
});
test("X02 equality has no attributed cause or follow-up", () => {
  const row = flowCard({});
  assert.equal(row.difference,0); assert.equal(row.action,null); assert.deepEqual(row.context,[]);
});
test("X02 evidence requires same period and reported positive value", () => {
  const b = bank(undefined,undefined,500); b.operating.customerAdvanceAmount.value=200;
  b.operating.customerAdvanceAmount.periodFrom="2024-01-01";
  const row = flowCard({bank:b,snapshots:[snapshot("BFO",annualPeriod(2025),{"1230":undefined})]});
  assert.deepEqual(row.context,[]); assert.doesNotMatch(row.action,/аванс|дебитор/);
});
test("X02 and X03 reject unsupported units even in previously serialized sources", () => {
  const s=snapshot(); s.currency="USD";
  const rows=bankBfoComparisons(run({snapshots:[s]})); assert.equal(rows.length,2);
  for(const row of rows){assert.equal(row.difference,null);assert.equal(row.accounting.value,null);assert.equal(row.action,null);}
  const b=bank();b.operating.operatingCashReceipts.unit="COUNT";b.liquidity.endingBalance.unit="RATIO";
  assert.ok(bankBfoComparisons(run({bank:b})).every(row=>row.difference===null));
});
test("X03 compares reported dates and preserves unknown account coverage", () => {
  const b=bank();b.liquidity.endingBalance.periodTo="2025-12-30";
  assert.equal(cash({bank:b}).absoluteDifference,null);
  b.liquidity.endingBalance.periodTo="2025-12-31";b.liquidity.endingBalance.warnings=["INCOMPLETE_ACCOUNT_OR_BALANCE_COVERAGE"];
  assert.equal(cash({bank:b}).absoluteDifference,null);
});
test("X02 partial months and mixed company monthly facts cannot produce a comparison", () => {
  const data=buildFacts(input());
  const month=data.facts.find(f=>f.semanticCode==="BANK_MONTHLY_OPERATING_RECEIPTS");
  month.period.to="2025-01-29"; assert.equal(rule(reconcileFacts(data),"REC-REV").ratio,null);
  month.period.to="2025-01-31";month.companyInn="9900002999";
  assert.ok(!bankBfoComparisons(reconcileFacts(data)).some(row=>row.accounting.label.includes("выручка")));
});
test("bank-only does not fabricate a joint profile",()=>assert.deepEqual(bankBfoComparisons(run({snapshots:[]})),[]));

import {parseQuarterlyReportText} from "../lib/quarterly-report.ts";
for(const [declaration,scale] of [
  ["Код по ОКЕИ 383",1],["ОКЕИ 384",1000],["Код по ОКЕИ 385",1000000],
  ["Единица измерения: тыс. руб.\nОКЕИ 383",null],
  ["Единица измерения: тыс. USD\nСправочно: тыс. руб.",null],
  ["Валюта отчётности: BYN\nЕдиница измерения: тыс. руб.",null],
]) test("BFO units before normalization: "+declaration,()=>{
  const text="Бухгалтерская отчетность за 2025 год\nИНН "+inn+"\n"+declaration+
    "\nБаланс 1600 4000\nОборотные активы 1200 3200\nКапитал и резервы 1300 2100\nДенежные средства 1250 500\nВыручка 2110 1200\nПрибыль от продаж 2200 350\nЧистая прибыль 2400 300";
  const m=parseQuarterlyReportText(text,"synthetic.csv").financialMetadataV2;
  assert.equal(m.scaleConfirmed,scale!==null);
  if(scale!==null)assert.equal(m.rawScale,scale);
});
