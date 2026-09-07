import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { adaptCheckoBfo } from "../lib/credit-engine/financial-analysis/checko-bfo-adapter.ts";
import { adaptQuarterlyReport } from "../lib/credit-engine/financial-analysis/quarterly-adapter.ts";
import { annualPeriod, parseFinancialPeriod, comparePeriods } from "../lib/credit-engine/financial-analysis/periods.ts";
import { normalizeSnapshot } from "../lib/credit-engine/financial-analysis/normalizer.ts";
import { parseQuarterlyReportText } from "../lib/quarterly-report.ts";
import { analyzeFinancialPeriod } from "../lib/credit-engine/financial-analysis/metrics.ts";
import { buildFinancialAnalysis } from "../lib/credit-engine/financial-analysis/engine.ts";
import { compareFinancialMetrics } from "../lib/credit-engine/financial-analysis/comparison.ts";
import { checkoFinancialShadow, quarterlyFinancialShadow } from "../lib/credit-engine/financial-analysis/integration.ts";
import { analyzeBankStatement, analysisForStorage } from "../lib/prescore.ts";
import { analysisView } from "../lib/entitlements.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";

const source = (overrides = {}) => ({ sourceId: "bfo:fixture", sourceType: "BFO", status: "READY", companyInn: "7701234567", receivedAt: "2026-01-01", confidence: 98, warnings: [], rawReference: "fixture:raw", contentHash: "fixture-hash", fieldAvailability: { revenue: "KNOWN" }, ...overrides });
const rows = { "1600": 1000, "1100": 400, "1110": 10, "1150": 390, "1200": 600, "1210": 150, "1220": 0, "1230": 300, "1240": 50, "1250": 100, "1260": 0, "1300": 500, "1370": 100, "1400": 200, "1410": 100, "1500": 300, "1510": 100, "1520": 200, "1550": 0, "1700": 1000, "2110": 2000, "2120": -1200, "2100": 800, "2210": -200, "2220": -100, "2200": 500, "2320": 0, "2330": -50, "2340": 0, "2350": -50, "2300": 400, "2410": -80, "2400": 320 };
const snap = (changes = {}, year = 2025, extra = {}) => normalizeSnapshot({ source: source(), period: annualPeriod(year), rawLines: { ...rows, ...changes }, scale: 1, ...extra });
const quarterlyText = (period = "9 месяцев 2026", unit = "тыс. руб.") => `Бухгалтерская отчетность за ${period} года\nЕдиница измерения: ${unit}\nИНН 7701234567\nБАЛАНС Актив 1600 1000\nВнеоборотные активы 1100 400\nОборотные активы 1200 600\nКапитал и резервы 1300 500\nДолгосрочные обязательства 1400 200\nКраткосрочные обязательства 1500 300\nДебиторская задолженность 1230 300\nДенежные средства 1250 100\nВыручка 2110 2000\nЧистая прибыль 2400 320\nПроценты к уплате 2330 (50)\nКраткосрочные заемные средства 1510 -`;

test("reported value maps by RAS code", () => assert.equal(snap().income.REVENUE.value, 2000));
test("ordinary documented Checko response preserves exact RUB without unit metadata and legacy finances", () => {
  const raw = { data: { 2025: { ...rows, "1600": 987654321, "2110": 123456789.25 } }, meta: { status: "ok", today_request_count: 1, balance: 500 } };
  const s = adaptCheckoBfo(raw, source())[0];
  assert.equal(s.confirmedScale, 1); assert.equal(s.currency, "RUB");
  assert.equal(s.balance.ASSETS_TOTAL.value, 987654321); assert.equal(s.balance.ASSETS_TOTAL.status, "KNOWN");
  assert.equal(s.income.REVENUE.value, 123456789.25); assert.equal(s.income.REVENUE.status, "KNOWN");
  assert.equal(s.income.REVENUE.rawCode, "2110");
  const h = checkoRouteHarness();
  const before = h.latestFinances(raw); checkoFinancialShadow(raw, source(), before);
  assert.deepEqual(h.latestFinances(raw), before);
});
for (const meta of [{ scale: null }, { scale: 100 }, { currency: "USD" }]) test(`Checko explicit invalid metadata remains strict ${JSON.stringify(meta)}`, () => {
  assert.equal(adaptCheckoBfo({ data: { 2025: rows }, meta }, source())[0].income.REVENUE.status, "UNKNOWN");
});
test("Checko reported net assets uses actual line 3600", () => {
  const s = adaptCheckoBfo({ data: { 2025: { ...rows, "3600": 475 } } }, source())[0];
  assert.equal(s.reportedNetAssets.value, 475); assert.equal(s.reportedNetAssets.status, "KNOWN");
  assert.equal(s.reportedNetAssets.origin, "REPORTED"); assert.equal(s.reportedNetAssets.rawCode, "3600");
  assert.equal(s.reportedNetAssets.sourceId, source().sourceId); assert.deepEqual(s.source, source());
});
test("Checko absent net assets stays unknown without equity", () => {
  const s = adaptCheckoBfo({ data: { 2025: { "1600": 1000 } } }, source())[0];
  assert.equal(s.reportedNetAssets.status, "UNKNOWN"); assert.equal(s.reportedNetAssets.value, null);
});
test("Checko equity never substitutes for missing 3600", () => {
  const s = adaptCheckoBfo({ data: { 2025: rows } }, source())[0];
  assert.equal(s.reportedNetAssets.status, "UNKNOWN"); assert.equal(s.reportedNetAssets.value, null);
  assert.equal(s.equityNetAssetsProxy.value, 500); assert.equal(s.equityNetAssetsProxy.origin, "PROXY");
});
const labelText = `Бухгалтерская отчетность за 3 месяца 2026 года
Единица измерения: руб.
ИНН 7701234567
Активы всего 1000
Оборотные активы 600
Внеоборотные активы 400
Капитал и резервы 500
Долгосрочные обязательства 200
Краткосрочные обязательства 300
Дебиторская задолженность 300
Денежные средства 0
Выручка (нетто) 900
Чистая прибыль 100`;
for (const extension of ["pdf", "xlsx", "csv"]) test(`label-only readable ${extension} retains honest provenance`, () => {
  assert.doesNotMatch(labelText, /\b(?:1600|1200|1230|1250|1300|1500|2110)\b/);
  const r = parseQuarterlyReportText(labelText, `quarter.${extension}`);
  assert.equal(r.values.revenue, 900); assert.equal(r.values.assets, 1000);
  const s = adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" }));
  for (const [value, amount, label] of [[s.income.REVENUE, 900, "Выручка (нетто)"], [s.balance.CURRENT_ASSETS, 600, "Оборотные активы"], [s.balance.RECEIVABLES, 300, "Дебиторская задолженность"], [s.balance.CASH, 0, "Денежные средства"], [s.balance.EQUITY, 500, "Капитал и резервы"], [s.balance.SHORT_TERM_LIABILITIES, 300, "Краткосрочные обязательства"]]) {
    assert.equal(value.status, "KNOWN"); assert.equal(value.value, amount);
    assert.equal(value.origin, "REPORTED"); assert.equal(value.rawLabel, label.startsWith("Выручка") ? "Выручка" : label);
    assert.equal(Object.hasOwn(value, "rawCode"), false);
  }
  assert.equal(s.equityNetAssetsProxy.rawCode, undefined); assert.equal(s.equityNetAssetsProxy.rawLabel, "Капитал и резервы");
  assert.match(analyzeFinancialPeriod(s).amounts.REVENUE.calculationBasis, /raw label Выручка/);
});
test("quarterly actual codes retain code provenance and old metadata loads", () => {
  const r = parseQuarterlyReportText(quarterlyText(), "quarter.xlsx");
  delete r.financialMetadataV2.labelValues; delete r.financialMetadataV2.reportedNetAssetsLabel;
  const s = adaptQuarterlyReport(JSON.parse(JSON.stringify(r)), source({ sourceType: "QUARTERLY" }));
  assert.equal(s.income.REVENUE.rawCode, "2110"); assert.equal(s.income.REVENUE.rawLabel, undefined);
  assert.equal(s.income.REVENUE.value, 2_000_000);
});
test("plain Cyrillic revenue label is available in v2 without altering legacy matching", () => {
  const r = parseQuarterlyReportText(labelText.replace("Выручка (нетто)", "Выручка"), "q.csv");
  assert.equal(r.values.revenue, null); // Existing legacy Cyrillic word-boundary behavior.
  const s = adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" }));
  assert.equal(s.income.REVENUE.value, 900); assert.equal(s.income.REVENUE.rawLabel, "Выручка");
  assert.equal(s.income.REVENUE.rawCode, undefined);
});
for (const forms of [["1", "2", "3", "4"], ["I", "II", "III", "IV"]]) {
  for (let i = 0; i < 3; i++) test(`${forms[i]} to ${forms[i + 1]} quarter is sequential`, () => {
    const previous = snap({}, 2026, { period: parseFinancialPeriod(`за ${forms[i]} квартал 2026 года`) });
    const current = snap({}, 2026, { period: parseFinancialPeriod(`за ${forms[i + 1]} квартал 2026 года`) });
    assert.equal(previous.period.flowPeriodType, "STANDALONE_PERIOD");
    assert.equal(comparePeriods(current, previous), "COMPARABLE_SEQUENTIAL");
  });
}
test("three months remains YTD while third quarter is standalone", () => {
  assert.equal(parseFinancialPeriod("3 месяца 2026").flowPeriodType, "CUMULATIVE_YTD");
  assert.equal(parseFinancialPeriod("3 квартал 2026").from, "2026-07-01");
  assert.equal(parseFinancialPeriod("первый квартал 2026").flowPeriodType, "STANDALONE_PERIOD");
});
test("missing raw line remains UNKNOWN", () => assert.equal(snap({ "1510": undefined }).balance.SHORT_TERM_BORROWINGS.status, "UNKNOWN"));
test("reported zero stays KNOWN", () => assert.equal(snap({ "1510": 0 }).balance.SHORT_TERM_BORROWINGS.value, 0));
test("negative expense normalized and raw retained", () => { const v = snap().income.COST_OF_SALES; assert.equal(v.value, 1200); assert.equal(v.rawValue, -1200); });
test("positive expense remains positive", () => assert.equal(snap({ "2120": 1200 }).income.COST_OF_SALES.value, 1200));
test("profit retains negative sign", () => assert.equal(snap({ "2400": -500 }).income.NET_PROFIT.value, -500));
test("RUB scale preserved", () => assert.equal(snap().balance.ASSETS_TOTAL.value, 1000));
test("explicit thousand scale", () => assert.equal(snap({}, 2025, { scale: 1000 }).balance.ASSETS_TOTAL.value, 1_000_000));
test("unsupported scale is not guessed", () => assert.equal(snap({}, 2025, { scale: 100 }).balance.ASSETS_TOTAL.value, null));
test("missing scale is not guessed", () => assert.equal(snap({}, 2025, { scale: null }).balance.ASSETS_TOTAL.value, null));
test("SourceEnvelope provenance retained", () => assert.deepEqual(snap().source, source()));
test("BFO full-year period", () => assert.deepEqual(adaptCheckoBfo({ data: { 2025: rows }, meta: { scale: 1, currency: "RUB" } }, source())[0].period, annualPeriod(2025)));
test("BFO history includes six years, no synthetic gaps", () => {
  const years = [2019, 2020, 2022, 2023, 2024, 2025];
  assert.deepEqual(adaptCheckoBfo({ data: Object.fromEntries(years.map(y => [y, rows])) }, source(), { scale: 1, currency: "RUB" }).map(s => s.period.year), years);
});
test("Checko missing raw 1510 is not zero", () => assert.equal(adaptCheckoBfo({ data: { 2025: { "1600": 100 } } }, source(), { scale: 1, currency: "RUB" })[0].balance.SHORT_TERM_BORROWINGS.value, null));
for (const months of [3, 6, 9, 12]) test(`interim parser ${months}M`, () => { const p = parseFinancialPeriod(`за ${months} месяцев 2026 года`); assert.equal(p.monthsCovered, months); assert.equal(p.flowPeriodType, months === 12 ? "FULL_YEAR" : "CUMULATIVE_YTD"); });
test("unknown period stays unknown", () => assert.equal(parseFinancialPeriod("отчет 2026").monthsCovered, null));
test("balance date does not establish flow period", () => assert.equal(parseFinancialPeriod("по состоянию на 30.09.2026").flowPeriodType, "UNKNOWN"));
test("standalone second quarter does not become 6M YTD", () => assert.equal(parseFinancialPeriod("за 2 квартал 2026").flowPeriodType, "STANDALONE_PERIOD"));
test("annual and interim are not comparable", () => assert.equal(comparePeriods(snap({}, 2026, { period: parseFinancialPeriod("9 месяцев 2026") }), snap()), "NOT_COMPARABLE"));
test("quarterly parser adds metadata without net assets proxy leak", () => {
  const r = parseQuarterlyReportText(quarterlyText(), "quarter.xlsx");
  const s = adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" }));
  assert.equal(r.values.netAssets, r.values.equity);
  assert.equal(s.reportedNetAssets.value, null); assert.equal(s.equityNetAssetsProxy.origin, "PROXY");
  assert.equal(s.balance.SHORT_TERM_BORROWINGS.value, 0);
  assert.equal(s.income.INTEREST_EXPENSE.value, 50_000);
});
test("quarterly parser confidence propagated", () => { const r = parseQuarterlyReportText(quarterlyText(), "quarter.xlsx"); r.parserConfidence = 50; assert.equal(adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" })).income.REVENUE.confidence, "LOW"); });
test("quarterly verdict and factors ignored", () => {
  const r = parseQuarterlyReportText(quarterlyText(), "quarter.xlsx");
  const a = adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" }));
  r.verdictCode = "STOP"; r.factors = [{ severity: "critical", title: "Not facts" }]; r.conclusion = "Not facts";
  assert.deepEqual(adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" })), a);
});
test("old quarterly reports fail closed on unproven scale", () => { const r = parseQuarterlyReportText(quarterlyText(), "q.xlsx"); delete r.financialMetadataV2; assert.equal(adaptQuarterlyReport(r, source({ sourceType: "QUARTERLY" })).income.REVENUE.value, null); });
test("explicit RUB supported; missing units unavailable", () => {
  assert.equal(adaptQuarterlyReport(parseQuarterlyReportText(quarterlyText("9 месяцев 2026", "руб."), "q.xlsx"), source({ sourceType: "QUARTERLY" })).income.REVENUE.value, 2000);
  assert.equal(adaptQuarterlyReport(parseQuarterlyReportText(quarterlyText("9 месяцев 2026", "не указана"), "q.xlsx"), source({ sourceType: "QUARTERLY" })).income.REVENUE.value, null);
});

const metrics = (changes = {}, previous, extra = {}) => analyzeFinancialPeriod(snap(changes, 2025, extra), previous);
for (const [field, code] of Object.entries({ ASSETS_TOTAL: "1600", CURRENT_ASSETS: "1200", NON_CURRENT_ASSETS: "1100", INVENTORIES: "1210", RECEIVABLES: "1230", CASH: "1250", EQUITY: "1300", LONG_TERM_LIABILITIES: "1400", SHORT_TERM_LIABILITIES: "1500", LONG_TERM_BORROWINGS: "1410", SHORT_TERM_BORROWINGS: "1510", PAYABLES: "1520" })) test(`balance ${field}`, () => assert.equal(metrics().amounts[field].value, rows[code]));
for (const [label, read, expected] of [
  ["total liabilities", m => m.amounts.TOTAL_LIABILITIES.value, 500],
  ["total borrowings", m => m.amounts.TOTAL_BORROWINGS.value, 200],
  ["current ratio", m => m.liquidity.currentRatio.value, 2],
  ["quick ratio", m => m.liquidity.quickRatio.value, 1.5],
  ["absolute liquidity", m => m.liquidity.absoluteLiquidity.value, 0.5],
  ["working capital", m => m.liquidity.netWorkingCapital.value, 300],
  ["autonomy", m => m.capitalStructure.equityRatio.value, 0.5],
  ["liabilities/assets", m => m.capitalStructure.liabilitiesToAssets.value, 0.5],
  ["borrowings/assets", m => m.capitalStructure.borrowingsToAssets.value, 0.2],
  ["debt/equity", m => m.capitalStructure.debtToEquity.value, 0.4],
  ["liabilities/equity", m => m.capitalStructure.liabilitiesToEquity.value, 1],
  ["net debt", m => m.capitalStructure.netDebt.value, 50],
  ["short-term debt share", m => m.capitalStructure.shortTermDebtShare.value, 0.5],
  ["gross margin", m => m.profitability.grossMargin.value, 0.4],
  ["operating margin", m => m.profitability.operatingMargin.value, 0.25],
  ["pretax margin", m => m.profitability.pretaxMargin.value, 0.2],
  ["net margin", m => m.profitability.netMargin.value, 0.16],
  ["interest coverage", m => m.profitability.interestCoverageOperatingProfit.value, 10],
  ["asset turnover", m => m.activity.assetTurnover.value, 2],
  ["receivables turnover", m => m.activity.receivablesTurnover.value, 2000 / 300],
  ["DSO", m => m.activity.dso.value, 300 / 2000 * 365],
  ["inventory turnover", m => m.activity.inventoryTurnover.value, 8],
  ["DIO", m => m.activity.dio.value, 150 / 1200 * 365],
  ["fixed assets composition", m => m.composition.FIXED_ASSETS_TO_ASSETS.value, .39],
  ["payables/current liabilities", m => m.composition.PAYABLES_TO_SHORT_TERM_LIABILITIES.value, 2 / 3],
]) test(label, () => assert.equal(read(metrics({}, snap({}, 2024))), expected));
test("missing liabilities component is not zero", () => assert.equal(metrics({ "1400": null }).amounts.TOTAL_LIABILITIES.value, null));
test("missing borrowing component is not zero", () => assert.equal(metrics({ "1410": null }).amounts.TOTAL_BORROWINGS.value, null));
test("zero liabilities produces N/A current ratio", () => assert.equal(metrics({ "1500": 0 }).liquidity.currentRatio.status, "NOT_APPLICABLE"));
test("quick ratio missing investment unavailable", () => assert.equal(metrics({ "1240": null }).liquidity.quickRatio.value, null));
test("net debt missing cash unavailable", () => assert.equal(metrics({ "1250": null }).capitalStructure.netDebt.value, null));
test("net debt missing investments unavailable", () => assert.equal(metrics({ "1240": null }).capitalStructure.netDebt.value, null));
test("non-positive equity no debt/equity", () => { for (const e of [-50, 0]) { const m = metrics({ "1300": e }); assert.equal(m.capitalStructure.debtToEquity.value, null); assert.ok(m.capitalStructure.debtToEquity.warnings.includes("NON_POSITIVE_EQUITY_DENOMINATOR")); } });
test("zero borrowings produces N/A share", () => assert.equal(metrics({ "1410": 0, "1510": 0 }).capitalStructure.shortTermDebtShare.status, "NOT_APPLICABLE"));
test("zero revenue no Infinity margins", () => assert.equal(metrics({ "2110": 0 }).profitability.netMargin.value, null));
test("ROA uses average assets", () => assert.equal(metrics({}, snap({ "1600": 600 }, 2024)).profitability.roa.value, .4));
test("ROE uses average equity", () => assert.equal(metrics({}, snap({ "1300": 300 }, 2024)).profitability.roe.value, .8));
test("ROA ending fallback is explicit PARTIAL", () => { const m = metrics().profitability.roa; assert.equal(m.status, "PARTIAL"); assert.match(m.calculationBasis, /ending balance replaces/); assert.notEqual(m.confidence, "HIGH"); });
test("non-positive average equity blocks ROE", () => assert.equal(metrics({ "1300": 100 }, snap({ "1300": -200 }, 2024)).profitability.roe.value, null));
test("zero interest not applicable", () => { const m = metrics({ "2330": 0 }).profitability.interestCoverageOperatingProfit; assert.equal(m.status, "NOT_APPLICABLE"); assert.ok(m.warnings.includes("NO_REPORTED_INTEREST_EXPENSE")); });
test("EBITDA and netDebt/EBITDA not invented", () => assert.doesNotMatch(JSON.stringify(metrics()), /EBITDA/));
test("interim ROA/ROE not annualized but margins calculated", () => { const m = metrics({}, undefined, { period: parseFinancialPeriod("9 месяцев 2025") }); assert.equal(m.profitability.roa.value, null); assert.equal(m.profitability.roe.value, null); assert.equal(m.profitability.netMargin.value, .16); assert.equal(m.activity.dso.value, 300 / 2000 * 273); });
test("unknown period DSO/DIO unavailable", () => { const m = metrics({}, undefined, { period: parseFinancialPeriod("неизвестен") }); assert.equal(m.activity.dso.value, null); assert.equal(m.activity.dio.value, null); });
test("missing opening activity PARTIAL", () => assert.equal(metrics().activity.assetTurnover.status, "PARTIAL"));
test("balance equation reconciles", () => assert.equal(metrics().quality.balanceReconciled, true));
test("balance mismatch is data warning only", () => { const m = metrics({ "1700": 800 }); assert.equal(m.quality.balanceReconciled, false); assert.ok(m.quality.warnings.includes("BALANCE_RECONCILIATION_MISMATCH")); assert.equal(m.liquidity.currentRatio.confidence, "LOW"); });
test("income mismatch reduces confidence", () => assert.equal(metrics({ "2100": 120 }).profitability.netMargin.confidence, "LOW"));
test("small rounding difference accepted", () => assert.equal(metrics({ "2100": 799 }).quality.incomeReconciled, true));
test("weakest dependency bounds confidence", () => { const s = snap(); s.balance.SHORT_TERM_LIABILITIES.confidence = "LOW"; assert.equal(analyzeFinancialPeriod(s).liquidity.currentRatio.confidence, "LOW"); });
test("failed source produces unknown facts", () => assert.equal(metrics({}, undefined, { source: source({ status: "FAILED" }) }).amounts.ASSETS_TOTAL.value, null));
test("financial loss does not itself lower data confidence", () => { const m = metrics({ "2400": -320 }); assert.equal(m.amounts.NET_PROFIT.confidence, "HIGH"); assert.equal(m.observations.netProfitSign, "LOSS"); });

const growth = (a, b, field = "REVENUE") => buildFinancialAnalysis([...(b ? [b] : []), a]).trends.find(t => t.currentSnapshotId === a.snapshotId && t.metric === field);
for (const [field, code] of Object.entries({ REVENUE: "2110", ASSETS_TOTAL: "1600", EQUITY: "1300", RECEIVABLES: "1230", INVENTORIES: "1210", PAYABLES: "1520" })) test(`annual YoY ${field}`, () => assert.equal(growth(snap({ [code]: rows[code] * 1.5 }), snap({}, 2024), field).relativeChange.value, 50));
test("total borrowings YoY", () => assert.equal(growth(snap({ "1410": 200, "1510": 200 }), snap({}, 2024), "TOTAL_BORROWINGS").relativeChange.value, 100));
test("missing previous period", () => assert.equal(growth(snap()).comparability, "INSUFFICIENT_DATA"));
test("prior zero denominator retains absolute change", () => { const t = growth(snap(), snap({ "2110": 0 }, 2024)); assert.equal(t.relativeChange.value, null); assert.equal(t.absoluteChange.value, 2000); });
test("profit transition through zero not percentage growth", () => { const t = growth(snap({ "2400": 3_000_000 }), snap({ "2400": -5_000_000 }, 2024), "NET_PROFIT"); assert.equal(t.absoluteChange.value, 8_000_000); assert.equal(t.relativeChange.value, null); assert.ok(t.relativeChange.warnings.includes("SIGN_CHANGE_RELATIVE_GROWTH_NOT_MEANINGFUL")); });
test("positive to negative equity also suppresses percentage", () => assert.equal(growth(snap({ "1300": -100 }), snap({}, 2024), "EQUITY").relativeChange.value, null));
test("negative to negative profit suppresses percentage", () => assert.equal(growth(snap({ "2400": -10 }), snap({ "2400": -20 }, 2024), "NET_PROFIT").relativeChange.value, null));
test("9M vs 9M comparable", () => { const a = snap({}, 2026, { period: parseFinancialPeriod("9 месяцев 2026") }); const b = snap({}, 2025, { period: parseFinancialPeriod("9 месяцев 2025") }); assert.equal(growth(a, b).comparability, "COMPARABLE_INTERIM_YOY"); });
test("9M vs 6M not comparable", () => assert.equal(comparePeriods(snap({}, 2026, { period: parseFinancialPeriod("9 месяцев 2026") }), snap({}, 2025, { period: parseFinancialPeriod("6 месяцев 2025") })), "NOT_COMPARABLE"));
test("year gaps not passed as YoY", () => assert.equal(growth(snap(), snap({}, 2023)).relativeChange.value, null));
test("history keeps latest annual and interim separately", () => { const a = buildFinancialAnalysis([snap(), snap({}, 2026, { period: parseFinancialPeriod("9 месяцев 2026") })]); assert.equal(a.history.length, 2); assert.equal(a.latestAnnual.snapshot.period.year, 2025); assert.equal(a.latestInterim.snapshot.period.monthsCovered, 9); assert.equal(a.trends.at(-1).relativeChange.value, null); });
test("cross-company histories rejected", () => assert.throws(() => buildFinancialAnalysis([snap(), snap({}, 2024, { source: source({ companyInn: "other" }) })]), /COMPANY_MISMATCH/));
test("standalone adjacent quarters comparable sequentially but not YoY", () => { const a = snap({}, 2025, { period: parseFinancialPeriod("3 квартал 2025") }), b = snap({}, 2025, { period: parseFinancialPeriod("2 квартал 2025") }); assert.equal(comparePeriods(a, b), "COMPARABLE_SEQUENTIAL"); assert.equal(growth(a, b).relativeChange.value, null); });
test("interim average uses start-of-year closing not prior-year interim", () => { const annual = snap({}, 2025); const priorInterim = snap({ "1230": 900 }, 2025, { period: parseFinancialPeriod("9 месяцев 2025") }); const current = snap({}, 2026, { period: parseFinancialPeriod("9 месяцев 2026") }); const a = buildFinancialAnalysis([annual, priorInterim, current]); assert.equal(a.latestInterim.amounts.AVERAGE_RECEIVABLES.value, 300); });
test("duplicate snapshots rejected", () => assert.throws(() => buildFinancialAnalysis([snap(), snap()]), /DUPLICATE/));
test("metric codes unique within period", () => { const m = metrics({}, snap({}, 2024)); const all = [m.amounts, m.liquidity, m.capitalStructure, m.profitability, m.activity, m.composition].flatMap(Object.values); assert.equal(new Set(all.map(m => m.code)).size, all.length); });
test("100 companies x six years deterministic performance workload", t => {
  const started = performance.now(); let count = 0;
  for (let company = 0; company < 100; company++) { const snapshots = Array.from({ length: 6 }, (_, i) => snap({}, 2020 + i, { source: source({ companyInn: String(7700000000 + company) }) })); const a = buildFinancialAnalysis(snapshots); count += a.history.length; assert.equal(a.trends.length, 48); }
  assert.equal(count, 600); t.diagnostic(`600 periods: ${(performance.now() - started).toFixed(1)} ms (measurement only; no time gate)`);
});

// Exercise actual route normalizers without HTTP, credentials, runtime DB or external requests.
function checkoRouteHarness() {
  const sourceText = fs.readFileSync(new URL("../app/api/checko/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(sourceText + "\nexport { latestFinances, normalizeProfile, profileView };", { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", code)(exports, name => {
    if (name.includes("financial-analysis/integration")) return { checkoFinancialShadow };
    if (name.includes("contracts/sources")) return { INFRASTRUCTURE_VERSIONS: { integrity: "PRESCORE-INTEGRITY-1" } };
    if (name.includes("api-auth") || name.includes("entitlements")) return {};
    throw new Error(`Unexpected import: ${name}`);
  });
  return exports;
}
test("existing latestFinances values unchanged including legacy zero semantics", () => {
  const r = checkoRouteHarness().latestFinances({ data: { 2025: { ...rows, "1410": null }, 2024: { ...rows, "2110": 1000 } } });
  assert.equal(r.revenue, 2000); assert.equal(r.revenueGrowth, 100); assert.equal(r.currentLiquidity, 2);
  assert.equal(r.autonomy, 50); assert.equal(r.returnOnSales, 16); assert.equal(r.workingCapital, 300);
  assert.equal(r.debtToEquity, .2); assert.equal(r.interestCoverage, 10); assert.equal(r.costOfSales, -1200);
  const missing = checkoRouteHarness().latestFinances({ data: { 2025: {} } }); assert.equal(missing.revenue, 0); assert.equal(missing.currentAssets, 0);
});
test("Checko profile integrates shadow alongside unchanged finances", () => {
  const h = checkoRouteHarness(), input = { finances: { data: { 2025: rows, 2024: rows }, meta: { scale: 1, currency: "RUB" } } };
  const profile = h.normalizeProfile("7701234567", input, []);
  assert.deepEqual(profile.finances, h.latestFinances(input.finances)); assert.equal(profile.financialStatementsV2.length, 2);
  assert.equal(profile.financialAnalysisV2.latestAnnual.liquidity.currentRatio.value, 2);
  const free = h.profileView(profile, "FREE"); assert.equal(free.financialAnalysisV2, undefined); assert.equal(free.financialStatementsV2, undefined); assert.equal(free.financialMetricsComparison, undefined);
});
test("Checko shadow never changes raw input", () => { const raw = { data: { 2025: rows } }, before = structuredClone(raw); checkoFinancialShadow(raw, source(), {}); assert.deepEqual(raw, before); });
test("legacy financial comparison aligns units and exposes missing semantics", () => {
  const a = buildFinancialAnalysis([snap({ "1410": null })]);
  const c = compareFinancialMetrics(a, { autonomy: 50, debtToEquity: .2 }, "BFO");
  assert.equal(c.comparisons.find(v => v.metric === "autonomy").absoluteDiff, 0);
  const debt = c.comparisons.find(v => v.metric === "debtToEquity"); assert.equal(debt.v2Value, null); assert.equal(debt.definitionChanged, true); assert.ok(debt.reasonCodes.includes("MISSING_NOT_ZERO"));
});
test("quarterly comparison uses authoritative parsed ratios, never verdicts", () => {
  const r = parseQuarterlyReportText(quarterlyText(), "q.xlsx"); const fields = quarterlyFinancialShadow(r, source({ sourceType: "QUARTERLY" }));
  assert.equal(fields.financialMetricsComparison.comparisons.length, 5);
  assert.ok(fields.financialMetricsComparison.comparisons.every(c => c.legacyValue === null ? c.v2Value === null : c.absoluteDiff === 0));
});
test("shadow addition preserves complete authoritative result and Block 4", () => {
  const baseline = analyzeBankStatement(block2StatementFixture(), "block5.txt");
  const r = parseQuarterlyReportText(quarterlyText().replace("7701234567", baseline.companyInn), "q.xlsx");
  const fields = quarterlyFinancialShadow(r, source({ sourceType: "QUARTERLY", companyInn: baseline.companyInn }));
  const result = { ...baseline, ...fields };
  const { financialAnalysisV2, financialStatementsV2, financialMetricsComparison, financialShadowWarnings, ...legacy } = result;
  assert.deepEqual(financialShadowWarnings, []);
  assert.ok(financialAnalysisV2); assert.ok(financialStatementsV2); assert.ok(financialMetricsComparison);
  assert.deepEqual(legacy, baseline); assert.equal(result.score, 872); assert.equal(result.grade, "A"); assert.equal(result.readiness, "Высокая готовность");
  assert.equal(result.metrics.estimatedLimitMin, 1_283_000); assert.equal(result.metrics.estimatedLimitMax, 2_636_000);
  assert.deepEqual(analysisView(result, "FREE"), analysisView(baseline, "FREE"));
  assert.ok(analysisForStorage(result).financialAnalysisV2);
});
test("old stored AnalysisResult without optional fields still loads", () => { const old = JSON.parse(JSON.stringify(analyzeBankStatement(block2StatementFixture(), "old.txt"))); assert.equal(analysisView(old, "FULL").score, 872); assert.equal(analysisForStorage(old).financialAnalysisV2, undefined); });
test("shadow invalid-company failure cannot overwrite authoritative metrics", () => { const r = parseQuarterlyReportText(quarterlyText(), "q.xlsx"); const f = quarterlyFinancialShadow(r, source({ sourceType: "QUARTERLY", companyInn: "other" })); assert.deepEqual(Object.keys(f).sort(), ["financialAnalysisV2", "financialMetricsComparison", "financialShadowWarnings", "financialStatementsV2"].sort()); assert.ok(f.financialShadowWarnings); });
test("parser confidence caps quality while original envelope is preserved", () => { const s = snap({}, 2025, { parserConfidence: 50 }); assert.deepEqual(s.source, source()); assert.equal(analyzeFinancialPeriod(s).quality.confidence, "LOW"); });
test("comparison overflow cannot serialize as an unexplained null", () => { const a = buildFinancialAnalysis([snap()]); a.latestAnnual.capitalStructure.equityRatio.value = 1e308; const c = compareFinancialMetrics(a, { autonomy: 50 }, "BFO").comparisons.find(c => c.metric === "autonomy"); assert.equal(c.v2Value, null); assert.ok(c.reasonCodes.includes("NON_FINITE_RESULT")); });
