import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { adaptUploadedBki } from "../lib/credit-engine/credit-portfolio/bki-adapter.ts";
import { buildCreditPortfolio } from "../lib/credit-engine/credit-portfolio/resolver.ts";
import { reported, unknown, derived, weakest, id, resolveValue } from "../lib/credit-engine/credit-portfolio/common.ts";
import { buildDebtPaymentObservations, contractReferences } from "../lib/credit-engine/credit-portfolio/payment-observations.ts";
import { matchPayments } from "../lib/credit-engine/credit-portfolio/payment-matcher.ts";
import { checkPosition } from "../lib/credit-engine/credit-portfolio/position.ts";
import { buildCreditPortfolioShadow, portfolioForAnalysis } from "../lib/credit-engine/credit-portfolio/integration.ts";
import { analyzeBankStatement, analysisForStorage } from "../lib/prescore.ts";
import { analysisView } from "../lib/entitlements.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";
import { classifyEconomicTransaction } from "../lib/credit-engine/classification/classifier.ts";

const inn = "7701234567", bankInn = "7701000000", date = "2026-01-01";
const envelope = (sourceId = "bki:1", extra = {}) => ({ sourceId, sourceType: "BKI", status: "READY", companyInn: inn, confidence: 98, receivedAt: date, contentHash: sourceId + ":hash", rawReference: sourceId + ":raw", warnings: [], ...extra });
const obligation = (extra = {}) => ({ id: "sb-1", creditor: "Банк А", product: "Срочный кредит", status: "Действующий", role: "Заёмщик", openedAt: "2025-01-01", scheduledCloseAt: "2027-06-30", updatedAt: date,
  originalAmount: 6000000, creditLimit: null, outstandingPrincipal: 5000000, totalOutstanding: 5100000, monthlyPayment: 420000, nextPaymentAmount: 420000, nextPaymentDate: "2026-01-10", annualRate: 21, rateLabel: "Ставка годовая", overdueAmount: null, maxDelinquencyDays: null, paymentQuality: "Недостаточно данных", collateral: "Оборудование", guaranteeAmount: null, accountNumber: "ACC-1", sourcePageHint: "page 2", ...extra });
const report = (obligations = [obligation()], extra = {}) => ({ source: "СБ БКИ", subjectType: "Юридическое лицо", subjectName: "ООО Тест", subjectInn: inn, relationshipToCompany: "Компания-заёмщик", affectsCompanyDebt: true, reportDate: date,
  parserConfidence: 98, fileName: "report.pdf", obligations, summary: {}, warnings: [], ...extra });
const context = (sourceId = "bki:1", extra = {}) => ({ companyInn: inn, source: envelope(sourceId), requestedAt: "2025-12-31", providerRequestId: "request-1", identityHints: { "sb-1": { creditorInn: bankInn, contractNumber: "LN-1" } }, ...extra });
const snapshot = (rows = [obligation()], asOf = date, sourceId = "bki:1", ctx = {}) => adaptUploadedBki(report(rows, { reportDate: asOf }), context(sourceId, ctx));
const portfolio = (s = snapshot(), extra = {}) => buildCreditPortfolio({ companyInn: inn, asOfDate: s.asOf ?? date, creditHistorySnapshots: [s], paymentObservations: [], ...extra });
const first = p => p.obligations[0];
const seed = () => portfolio();
const hints = { creditorName: "Банк А", creditorInn: bankInn, contractNumber: "LN-1", productType: "TERM_LOAN" };
function observation(fieldCode, value, observedAt = date, extra = {}) {
  const sourceId = extra.sourceId ?? "doc:1", evidence = [{ evidenceId: id("test-evidence", sourceId, fieldCode, value, observedAt), sourceKind: "DEBT_DOCUMENT", sourceId, observedAt, description: fieldCode, rawField: fieldCode, rawValue: value }];
  return { observationId: id("test-observation", sourceId, fieldCode, value, observedAt), observationGroupId: id("test-group", sourceId, observedAt), companyInn: inn, obligationHints: hints, fieldCode, value,
    unit: typeof value === "number" ? "RUB" : "TEXT", knowledge: value === null ? "UNKNOWN" : "KNOWN", origin: "REPORTED", observedAt, effectiveFrom: null, effectiveTo: null, confidence: "HIGH", evidence, warnings: [], ...extra };
}
function tx(category = "LOAN_PRINCIPAL_PAYMENT", amount = 500000, extra = {}) {
  return { id: "tx:1", canonicalTransactionId: "tx:1", date: "2026-01-05", amount, direction: "out", sourceId: "bank:1", counterparty: "Банк А", counterpartyInn: bankInn, purpose: "Погашение по договору № LN-1", account: "4070001", duplicateStatus: "NOT_DUPLICATE", classification: { primaryCategory: category, confidence: "HIGH" }, ...extra };
}
const payment = (category, amount, extra) => buildDebtPaymentObservations([tx(category, amount, extra)], inn)[0];
function document(kind, observations, extra = {}) { return { documentId: "doc:1", sourceId: "doc:1", documentKind: kind, companyInn: inn, observedAt: date, obligationHints: hints, observations, parserConfidence: "HIGH", warnings: [], ...extra }; }

test("known zero retains separate knowledge/origin/verification", () => { const v = reported(0, date, []); assert.equal(v.value, 0); assert.equal(v.knowledge, "KNOWN"); assert.equal(v.origin, "REPORTED"); assert.equal(v.verification, "CONFIRMED"); });
test("unknown remains null", () => { const v = unknown(); assert.equal(v.value, null); assert.equal(v.knowledge, "UNKNOWN"); });
test("nonfinite reported value rejected", () => assert.equal(reported(Infinity, date, []).knowledge, "UNKNOWN"));
test("derived origin independent from verification", () => { const v = derived(10, [reported(20, date, [])], date); v.verification = "CONFIRMED"; assert.equal(v.origin, "DERIVED"); });
test("estimated origin contract retained", () => { const v = { ...reported(10, date, []), origin: "ESTIMATED", verification: "UNCONFIRMED" }; assert.equal(v.origin, "ESTIMATED"); assert.equal(v.verification, "UNCONFIRMED"); });
for (const c of ["HIGH", "MEDIUM", "LOW", "UNKNOWN"]) test(`weakest dependency ${c}`, () => assert.equal(weakest("HIGH", c), c));
test("conflicting evidence retained", () => { const v = resolveValue([observation("annualRate", 21), observation("annualRate", 24, date, { sourceId: "doc:2", evidence: [{ evidenceId: "other", sourceKind: "BKI", sourceId: "other", observedAt: date, description: "rate" }] })], date); assert.equal(v.verification, "CONFLICTED"); assert.equal(v.value, null); assert.equal(v.evidence.length, 2); });
test("same-value evidence confirms without conflict", () => assert.equal(resolveValue([observation("annualRate", 21), observation("annualRate", 21, date, { observationId: "second" })], date).verification, "CONFIRMED"));
test("future effective fact not current", () => assert.equal(resolveValue([observation("annualRate", 24, date, { effectiveFrom: "2026-06-15" })], date).knowledge, "UNKNOWN"));
test("expired fact not current", () => assert.equal(resolveValue([observation("annualRate", 24, date, { effectiveTo: "2026-01-02" })], "2026-01-03").knowledge, "UNKNOWN"));

for (const [field, expected] of [["provider", "SBKI"], ["subjectInn", inn], ["relationshipToCompany", "Компания-заёмщик"], ["affectsCompanyDebt", true], ["requestedAt", "2025-12-31"], ["asOf", date], ["sourceId", "bki:1"], ["providerRequestId", "request-1"], ["contentHash", "bki:1:hash"], ["rawSourceReference", "bki:1:raw"]]) test(`snapshot preserves ${field}`, () => assert.equal(snapshot()[field], expected));
test("adapter does not mutate report", () => { const r = report(), before = structuredClone(r); adaptUploadedBki(r, context()); assert.deepEqual(r, before); });
test("snapshot stable without machine clock", () => assert.deepEqual(snapshot(), snapshot()));
test("provider may be uploaded file", () => assert.equal(snapshot(undefined, date, "bki:1", { provider: "UPLOADED_FILE" }).provider, "UPLOADED_FILE"));
test("consent/request seams retained", () => { const s = snapshot(undefined, date, "bki:1", { consentArtifactId: "consent:1", creditHistoryRequestId: "request:1" }); assert.equal(s.consentArtifactId, "consent:1"); assert.equal(s.creditHistoryRequestId, "request:1"); });
test("unconfirmed legacy zero remains unknown", () => assert.equal(snapshot([obligation({ outstandingPrincipal: 0 })]).obligations[0].fields.principalOutstanding.knowledge, "UNKNOWN"));
test("explicitly confirmed field zero is known", () => assert.equal(snapshot([obligation({ outstandingPrincipal: 0 })], date, "bki:1", { confirmedZeroFields: { "sb-1": ["principalOutstanding"] } }).obligations[0].fields.principalOutstanding.value, 0));
test("aggregate bureau zero cannot prove individual zero", () => { const r = report([obligation({ outstandingPrincipal: 0 })]); r.summary = { knownValues: { outstandingPrincipal: true } }; assert.equal(adaptUploadedBki(r, context()).obligations[0].fields.principalOutstanding.knowledge, "UNKNOWN"); });
test("source STALE lowers confidence", () => assert.equal(snapshot(undefined, date, "bki:1", { source: envelope("bki:1", { status: "STALE" }) }).confidence, "LOW"));
test("failed source cannot seed confirmed debt", () => assert.equal(portfolio(snapshot(undefined, date, "bki:1", { source: envelope("bki:1", { status: "FAILED" }) })).obligations.length, 0));
for (const [raw, type] of [["Срочный кредит", "TERM_LOAN"], ["Кредитная линия", "CREDIT_LINE"], ["Овердрафт", "OVERDRAFT"], ["Лизинг", "LEASING"], ["Факторинг", "FACTORING"], ["Банковская гарантия", "BANK_GUARANTEE"], ["Неясное обязательство", "UNKNOWN"]]) test(`BKI product ${type}`, () => assert.equal(first(portfolio(snapshot([obligation({ product: raw })]))).type, type));
for (const [raw, status] of [["Действующий", "ACTIVE"], ["Закрыт", "CLOSED"], ["Приостановлен", "SUSPENDED"], ["не закрыт", "ACTIVE"]]) test(`explicit BKI status ${status}/${raw}`, () => assert.equal(first(portfolio(snapshot([obligation({ status: raw })]))).status.value, status));
for (const [raw, field, expected] of [["originalAmount", "originalAmount", 6000000], ["creditLimit", "creditLimit", 10000000], ["annualRate", "annualRate", 21], ["monthlyPayment", "scheduledPaymentAmount", 420000], ["collateral", "collateralDescription", "Оборудование"], ["guaranteeAmount", "guaranteeAmount", 700000]]) test(`BKI terms ${field}`, () => assert.equal(first(portfolio(snapshot([obligation({ [raw]: expected })]))).currentTerms[field].value, expected));
for (const [raw, field, expected] of [["outstandingPrincipal", "principalOutstanding", 5000000], ["totalOutstanding", "totalOutstanding", 5100000], ["nextPaymentAmount", "nextPaymentAmount", 420000], ["nextPaymentDate", "nextPaymentDate", "2026-01-10"], ["overdueAmount", "overdueAmount", 1000]]) test(`BKI position ${field}`, () => assert.equal(first(portfolio(snapshot([obligation({ [raw]: expected })]))).currentPosition[field].value, expected));
test("account reference retained", () => assert.equal(first(seed()).identity.accountNumber.value, "ACC-1"));
test("page hint and rate basis retained", () => { const v = snapshot().obligations[0].fields.annualRate; assert.equal(v.evidence[0].pageHint, "page 2"); assert.equal(v.evidence[0].rawLabel, "Ставка годовая"); });
for (const relationship of ["Собственник", "Поручитель", "Руководитель", "Не указано"]) test(`BKI excludes ${relationship} from company portfolio`, () => { const s = adaptUploadedBki(report(undefined, { relationshipToCompany: relationship }), context()); const p = portfolio(s); assert.equal(p.obligations.length, 0); assert.ok(p.warnings.includes("BKI_NOT_COMPANY_PORTFOLIO_SCOPE")); });
test("affectsCompanyDebt false excluded", () => assert.equal(portfolio(adaptUploadedBki(report(undefined, { affectsCompanyDebt: false }), context())).obligations.length, 0));
test("wrong BKI subject excluded", () => assert.equal(portfolio(adaptUploadedBki(report(undefined, { subjectInn: "7709999999" }), context())).obligations.length, 0));
test("IP borrower supported", () => assert.equal(portfolio(adaptUploadedBki(report(undefined, { relationshipToCompany: "ИП-заёмщик" }), context())).obligations.length, 1));

for (const [field, changed] of [["outstandingPrincipal", 4500000], ["annualRate", 24], ["monthlyPayment", 500000], ["nextPaymentAmount", 500000], ["overdueAmount", 10000]]) test(`mutable ${field} does not change obligation ID`, () => assert.equal(first(portfolio(snapshot([obligation({ [field]: changed })], date, "bki:2"))).obligationId, first(seed()).obligationId));
test("array reorder/legacy row IDs preserve identity", () => { const rows = [obligation(), obligation({ id: "sb-2", accountNumber: "ACC-2", openedAt: "2025-02-01" })], ctx = { identityHints: {} }; const a = portfolio(snapshot(rows, date, "bki:1", ctx)), b = portfolio(snapshot([...rows].reverse().map((o, i) => ({ ...o, id: `sb-${i + 1}` })), date, "bki:2", ctx)); assert.deepEqual(a.obligations.map(o => o.obligationId), b.obligations.map(o => o.obligationId)); });
test("two same-bank loans stay separate", () => assert.equal(portfolio(snapshot([obligation(), obligation({ id: "sb-2", accountNumber: "ACC-2" })])).obligations.length, 2));
test("stable external ID matches across sources", () => { const ctx = { identityHints: { "sb-1": { externalIds: [{ system: "agreement-registry", value: "uuid-stable" }] } } }; const a = portfolio(snapshot(undefined, date, "bki:1", ctx)); const b = portfolio(snapshot(undefined, "2026-02-01", "bki:2", ctx), { previousPortfolio: a }); assert.equal(b.obligations.length, 1); assert.ok(b.obligationMatches.some(m => m.outcome === "EXACT_MATCH")); });
test("contract + creditor match", () => { const a = seed(), b = portfolio(snapshot([obligation({ accountNumber: "" })], "2026-02-01", "bki:2"), { previousPortfolio: a }); assert.equal(b.obligations.length, 1); assert.ok(b.obligationMatches.some(m => m.reasonCodes.includes("OBLIGATION_CONTRACT_NUMBER_MATCH"))); });
test("account + creditor match", () => { const a = portfolio(snapshot(undefined, date, "bki:1", { identityHints: {} })); const b = portfolio(snapshot(undefined, "2026-02-01", "bki:2", { identityHints: {} }), { previousPortfolio: a }); assert.equal(b.obligations.length, 1); });
test("strong composite without account or contract", () => { const a = portfolio(snapshot([obligation({ accountNumber: "" })], date, "bki:1", { identityHints: {} })), b = portfolio(snapshot([obligation({ accountNumber: "", outstandingPrincipal: 4500000 })], "2026-02-01", "bki:2", { identityHints: {} }), { previousPortfolio: a }); assert.equal(b.obligations.length, 1); });
test("creditor-only observation never updates two loans", () => { const a = portfolio(snapshot([obligation(), obligation({ id: "sb-2", accountNumber: "ACC-2" })])); const obs = observation("annualRate", 30, "2026-02-01", { obligationHints: { creditorName: "Банк А" } }); const p = buildCreditPortfolio({ companyInn: inn, asOfDate: "2026-02-01", previousPortfolio: a, observations: [obs] }); assert.ok(p.obligationMatches.some(m => m.outcome === "AMBIGUOUS")); assert.ok(p.obligations.every(o => o.currentTerms.annualRate.value === 21)); });
test("creditor-only single match remains possible", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: "2026-02-01", previousPortfolio: seed(), observations: [observation("annualRate", 30, "2026-02-01", { obligationHints: { creditorName: "Банк А" } })] }); assert.ok(p.obligationMatches.some(m => m.outcome === "POSSIBLE_MATCH")); assert.equal(first(p).currentTerms.annualRate.value, 21); });

const update = (rows = [obligation({ outstandingPrincipal: 4500000 })], extra = {}) => portfolio(snapshot(rows, "2026-02-01", "bki:2"), { previousPortfolio: seed(), ...extra });
test("old/new bureau snapshots coexist", () => assert.equal(update().creditHistorySnapshots.length, 2));
test("old/new positions coexist", () => { const o = first(update()); assert.equal(o.positionHistory.length, 2); assert.equal(o.positionHistory[0].position.principalOutstanding.value, 5000000); assert.equal(o.currentPosition.principalOutstanding.value, 4500000); });
test("position-only change does not create terms version", () => assert.equal(first(update()).termsHistory.length, 1));
test("new BKI obligation event", () => { const p = update([obligation(), obligation({ id: "sb-2", accountNumber: "ACC-2" })]); assert.equal(p.obligations.length, 2); assert.ok(p.events.some(e => e.type === "NEW_OBLIGATION_DETECTED" && e.eventDate === "2026-02-01")); });
test("absence does not close or delete", () => { const p = update([]); assert.equal(p.obligations.length, 1); assert.notEqual(first(p).status.value, "CLOSED"); assert.ok(first(p).warnings.includes("OBLIGATION_ABSENT_NOT_CLOSED")); });
test("explicit reliable closure retained with evidence", () => { const p = update([obligation({ status: "Закрыт" })]); assert.equal(first(p).status.value, "CLOSED"); assert.ok(p.events.some(e => e.type === "OBLIGATION_CLOSED_OBSERVED" && e.sourceIds.includes("bki:2"))); });
test("current BKI position evidence uses new source", () => { const v = first(update()).currentPosition.principalOutstanding; assert.ok(v.evidence.every(e => e.sourceId === "bki:2")); });
for (const [field, value, type] of [["annualRate", 24, "RATE_CHANGED"], ["scheduledCloseAt", "2027-12-31", "MATURITY_CHANGED"], ["creditLimit", 15000000, "LIMIT_CHANGED"]]) test(`terms change ${field}`, () => { const initial = portfolio(snapshot([obligation({ creditLimit: 10000000 })])); const p = portfolio(snapshot([obligation({ creditLimit: 10000000, [field]: value })], "2026-02-01", "bki:2"), { previousPortfolio: initial }); assert.equal(first(p).termsHistory.length, 2); assert.ok(p.events.some(e => e.type === type)); assert.ok(p.events.some(e => e.type === "TERMS_CHANGED")); });
test("BKI rate effectiveFrom not opening date", () => { const v = first(seed()).currentTerms.annualRate; assert.equal(v.observedAt, date); assert.equal(v.effectiveFrom, null); });
test("addendum retains observation and earlier effective date", () => { const obs = observation("annualRate", 24, "2026-06-20", { effectiveFrom: "2026-06-15" }); const p = buildCreditPortfolio({ companyInn: inn, asOfDate: "2026-06-20", previousPortfolio: seed(), documents: [document("ADDENDUM", [obs], { observedAt: "2026-06-20" })] }); const o = first(p); assert.equal(o.currentTerms.annualRate.value, 24); assert.equal(o.currentTerms.annualRate.effectiveFrom, "2026-06-15"); assert.equal(o.termsHistory.at(-1).effectiveFrom, "2026-06-15"); assert.equal(o.termsHistory[0].terms.annualRate.value, 21); });
test("same-date incompatible rates create DATA_CONFLICT", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, previousPortfolio: seed(), observations: [observation("annualRate", 24)] }); assert.equal(first(p).currentTerms.annualRate.verification, "CONFLICTED"); assert.ok(p.events.some(e => e.type === "DATA_CONFLICT")); });
test("replay is idempotent with historical snapshots", () => { const a = update(); const b = buildCreditPortfolio({ companyInn: inn, asOfDate: "2026-02-01", previousPortfolio: a }); assert.deepEqual(b, a); });

for (const [category, kind] of [["LOAN_PRINCIPAL_PAYMENT", "PRINCIPAL"], ["INTEREST_PAYMENT", "INTEREST"], ["DEBT_SERVICE_UNSPLIT", "UNSPLIT_DEBT_SERVICE"], ["LEASING_PAYMENT", "LEASING"], ["FACTORING_FEE", "FACTORING_FEE"]]) test(`payment observation ${category}`, () => { const p = payment(category, 100); assert.equal(p.paymentKind, kind); assert.equal(p.transactionId, "tx:1"); assert.deepEqual(p.sourceIds, ["bank:1"]); assert.equal(p.creditorInn, bankInn); assert.equal(p.classificationConfidence, "HIGH"); assert.equal(p.principalAmount, kind === "PRINCIPAL" ? 100 : null); assert.equal(p.interestAmount, kind === "INTEREST" ? 100 : null); });
for (const category of ["SUPPLIER_PAYMENT", "BANK_FEE", "OTHER_OUTFLOW"]) test(`generic ${category} excluded despite bank creditor`, () => assert.equal(buildDebtPaymentObservations([tx(category)], inn).length, 0));
test("contract reference extraction retains exact number", () => assert.deepEqual(contractReferences("Платеж по договору № LN-1 от 01.01.2025"), ["ln-1"]));
test("duplicate transactions not double counted", () => assert.equal(buildDebtPaymentObservations([tx(), tx()], inn).length, 1));
test("canonical exact duplicate excluded", () => assert.equal(buildDebtPaymentObservations([tx(undefined, undefined, { duplicateStatus: "EXACT" })], inn).length, 0));
test("inflow cannot become debt payment", () => assert.equal(buildDebtPaymentObservations([tx(undefined, undefined, { direction: "in" })], inn).length, 0));
test("nonfinite payment rejected", () => assert.equal(buildDebtPaymentObservations([tx(undefined, Infinity)], inn).length, 0));
test("real economic classifier feeds payment observations", () => { const t = { ...tx(), amount: 500000, direction: "OUT", purposeRaw: "Погашение основного долга по кредитному договору № LN-1", purposeNormalized: "погашение основного долга по кредитному договору № ln-1", counterpartyName: "Банк А" }; const c = classifyEconomicTransaction(t); const rows = buildDebtPaymentObservations([{ ...tx(), purpose: t.purposeRaw, classification: c }], inn); assert.ok(rows.length > 0); assert.equal(rows[0].classificationCode, c.primaryCategory); });

const match = (p = payment(), o = seed().obligations) => matchPayments([p], o)[0];
test("exact contract plus creditor auto matches", () => assert.equal(match().outcome, "MATCHED"));
test("exact account reference auto matches", () => assert.equal(match(payment(undefined, undefined, { purpose: "Погашение ACC-1", id: "t2", canonicalTransactionId: "t2" })).outcome, "MATCHED"));
test("unique creditor INN plus schedule auto matches", () => assert.equal(match(payment(undefined, 420000, { purpose: "Погашение кредита", date: "2026-01-10" })).outcome, "MATCHED"));
test("name-only without reference remains possible", () => assert.equal(match(payment(undefined, 500000, { creditorInn: undefined, counterpartyInn: "", purpose: "Платеж" })).outcome, "POSSIBLE_MATCH"));
test("two same-bank payments ambiguous", () => { const p = portfolio(snapshot([obligation(), obligation({ id: "sb-2", accountNumber: "ACC-2" })])); assert.equal(match(payment(undefined, 420000, { purpose: "Платеж", date: "2026-01-10" }), p.obligations).outcome, "AMBIGUOUS"); });
test("wrong creditor blocks exact contract", () => assert.equal(match(payment(undefined, 500000, { counterpartyInn: "7709999999", counterparty: "Банк Б" })).outcome, "UNMATCHED"));
test("wrong contract blocks name match", () => assert.equal(match(payment(undefined, 500000, { purpose: "По договору № WRONG" })).outcome, "UNMATCHED"));
for (const category of ["LEASING_PAYMENT", "FACTORING_FEE"]) test(`${category} not linked to term loan`, () => assert.equal(match(payment(category)).outcome, "UNMATCHED"));
test("low classification confidence no auto link", () => { const p = payment(); p.classificationConfidence = "LOW"; assert.equal(match(p).outcome, "POSSIBLE_MATCH"); });
test("no candidate retains unmatched payment", () => assert.equal(match(payment(), []).outcome, "UNMATCHED"));
test("matcher deterministic", () => assert.deepEqual(match(), match()));
test("strong unsplit match does not prove principal", () => { const p = payment("DEBT_SERVICE_UNSPLIT", 420000); assert.equal(match(p).outcome, "MATCHED"); assert.equal(p.principalAmount, null); });

test("BKI next payment creates one payment event", () => assert.equal(first(seed()).schedule.filter(s => s.type === "PAYMENT_DUE").length, 1));
test("missing next date does not invent schedule", () => assert.equal(first(portfolio(snapshot([obligation({ nextPaymentDate: "" })]))).schedule.filter(s => s.type === "PAYMENT_DUE").length, 0));
test("past due does not invent overdue", () => { const p = portfolio(snapshot(), { asOfDate: "2026-02-01" }); assert.equal(first(p).currentPosition.overdueAmount.knowledge, "UNKNOWN"); assert.equal(p.events.some(e => /OVERDUE|DEFAULT/.test(e.type)), false); });
test("full payment marks scheduled event matched", () => { const p = portfolio(snapshot(), { asOfDate: "2026-01-10", paymentObservations: [payment("DEBT_SERVICE_UNSPLIT", 420000, { date: "2026-01-10" })] }); assert.equal(first(p).schedule.find(s => s.type === "PAYMENT_DUE").status, "MATCHED"); });
test("partial payment stays partially matched", () => { const p = portfolio(snapshot(), { asOfDate: "2026-01-10", paymentObservations: [payment("DEBT_SERVICE_UNSPLIT", 200000, { date: "2026-01-10" })] }); assert.equal(first(p).schedule.find(s => s.type === "PAYMENT_DUE").status, "PARTIALLY_MATCHED"); });
test("multiple payments can cover one event", () => { const payments = [payment("LOAN_PRINCIPAL_PAYMENT", 320000, { date: "2026-01-10" }), payment("INTEREST_PAYMENT", 100000, { date: "2026-01-10", id: "t2", canonicalTransactionId: "t2" })]; const p = portfolio(snapshot(), { asOfDate: "2026-01-10", paymentObservations: payments }); assert.equal(first(p).schedule.find(s => s.type === "PAYMENT_DUE").status, "MATCHED"); });

const withPayments = (payments, asOfDate = "2026-01-05") => portfolio(snapshot(), { asOfDate, paymentObservations: payments });
test("confirmed principal anchor minus principal component", () => { const v = first(withPayments([payment()])).currentPosition.principalOutstanding; assert.equal(v.value, 4500000); assert.equal(v.origin, "DERIVED"); });
test("interest does not reduce derived principal", () => assert.equal(first(withPayments([payment(), payment("INTEREST_PAYMENT", 100000, { id: "t2", canonicalTransactionId: "t2" })])).currentPosition.principalOutstanding.value, 4500000));
test("unsplit leaves exact current principal unknown", () => { const o = first(withPayments([payment("DEBT_SERVICE_UNSPLIT", 420000)])); assert.equal(o.currentPosition.principalOutstanding.knowledge, "UNKNOWN"); assert.equal(o.positionHistory[0].position.principalOutstanding.value, 5000000); });
test("unsplit after known reductions cannot become exact residual", () => assert.equal(first(withPayments([payment(), payment("DEBT_SERVICE_UNSPLIT", 420000, { id: "t2", canonicalTransactionId: "t2" })])).currentPosition.principalOutstanding.knowledge, "UNKNOWN"));
test("leasing never reduces loan principal", () => assert.equal(first(withPayments([payment(), payment("LEASING_PAYMENT", 420000, { id: "t2", canonicalTransactionId: "t2" })])).currentPosition.principalOutstanding.value, 4500000));
test("factoring fee never reduces principal", () => assert.equal(first(withPayments([payment(), payment("FACTORING_FEE", 420000, { id: "t2", canonicalTransactionId: "t2" })])).currentPosition.principalOutstanding.value, 4500000));
test("negative derived principal retained", () => { const v = first(withPayments([payment(undefined, 6000000)])).currentPosition.principalOutstanding; assert.equal(v.value, -1000000); assert.equal(v.confidence, "LOW"); assert.ok(v.warnings.includes("DERIVED_PRINCIPAL_BELOW_ZERO")); });
test("missing anchor blocks derivation", () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: null })]), { asOfDate: "2026-01-05", paymentObservations: [payment()] }); assert.equal(first(p).currentPosition.principalOutstanding.knowledge, "UNKNOWN"); });
test("payments before anchor do not reduce it", () => assert.equal(first(portfolio(snapshot(), { paymentObservations: [payment(undefined, 500000, { date: "2025-12-31" })] })).currentPosition.principalOutstanding.value, 5000000));
test("same-day payment not subtracted twice", () => assert.equal(first(portfolio(snapshot(), { paymentObservations: [payment(undefined, 500000, { date })] })).currentPosition.principalOutstanding.value, 5000000));
test("later reported balance replaces prior derived view", () => { const a = withPayments([payment()]); const p = portfolio(snapshot([obligation({ outstandingPrincipal: 4470000 })], "2026-02-01", "bki:2"), { previousPortfolio: a }); assert.equal(first(p).currentPosition.principalOutstanding.value, 4470000); assert.equal(first(p).currentPosition.principalOutstanding.origin, "REPORTED"); });
for (const [amount, outcome] of [[4500000, "EXACT_MATCH"], [4470000, "WITHIN_TOLERANCE"], [4000000, "DIFFERENCE_OBSERVED"]]) test(`position check ${amount}`, () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: amount })], "2026-02-01", "bki:2"), { previousPortfolio: withPayments([payment()]) }); assert.equal(p.positionChecks[0].outcome, outcome); });
test("low-confidence expected principal no false confirmation", () => { const e = { ...derived(4500000, [reported(5000000, date, [])], date, ["DERIVED_PRINCIPAL_FROM_CONFIRMED_ANCHOR"]), confidence: "LOW" }; assert.equal(checkPosition("o", e, reported(4500000, date, []), true).outcome, "DIFFERENCE_OBSERVED"); });
test("position date mismatch not comparable", () => { const e = derived(4500000, [reported(5000000, date, [])], date, ["DERIVED_PRINCIPAL_FROM_CONFIRMED_ANCHOR"]); assert.equal(checkPosition("o", e, reported(4500000, "2026-02-01", []), true).outcome, "NOT_COMPARABLE"); });
test("estimated principal not accepted as exact derived anchor", () => { const e = { ...reported(4500000, date, []), origin: "ESTIMATED" }; assert.equal(checkPosition("o", e, reported(4500000, date, []), true).outcome, "NOT_COMPARABLE"); });

const line = (extra = {}) => portfolio(snapshot([obligation({ product: "Кредитная линия", creditLimit: 10000000, outstandingPrincipal: 6200000, ...extra })]));
test("line available = limit minus drawn", () => { const o = first(line()); assert.equal(o.currentTerms.creditLimit.value, 10000000); assert.equal(o.currentPosition.drawnAmount.value, 6200000); assert.equal(o.currentPosition.availableLimit.value, 3800000); assert.equal(o.currentPosition.availableLimit.origin, "DERIVED"); });
test("line missing limit unavailable", () => assert.equal(first(line({ creditLimit: null })).currentPosition.availableLimit.knowledge, "UNKNOWN"));
test("line missing utilization unavailable", () => assert.equal(first(line({ outstandingPrincipal: null })).currentPosition.availableLimit.knowledge, "UNKNOWN"));
test("line drawn exceeds limit retains negative result", () => { const v = first(line({ outstandingPrincipal: 12000000 })).currentPosition.availableLimit; assert.equal(v.value, -2000000); assert.ok(v.warnings.includes("DRAWN_AMOUNT_EXCEEDS_LIMIT")); });
test("term loan original amount not free limit", () => { const o = first(seed()); assert.equal(o.currentPosition.availableLimit.knowledge, "UNKNOWN"); assert.equal(o.currentPosition.drawnAmount.knowledge, "UNKNOWN"); });
test("overdraft utilization supported", () => assert.equal(first(line({ product: "Овердрафт" })).currentPosition.availableLimit.value, 3800000));
test("independent confirmation preserves DERIVED available origin", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, previousPortfolio: line(), observations: [observation("availableLimit", 3800000, date, { obligationHints: { ...hints, productType: "CREDIT_LINE" } })] }); const v = first(p).currentPosition.availableLimit; assert.equal(v.value, 3800000); assert.equal(v.origin, "DERIVED"); assert.equal(v.verification, "CONFIRMED"); });
for (const [product, exposure] of [["Срочный кредит", "FUNDED_DEBT"], ["Кредитная линия", "CREDIT_LIMIT"], ["Овердрафт", "CREDIT_LIMIT"], ["Лизинг", "LEASE"], ["Факторинг", "FACTORING"], ["Банковская гарантия", "CONTINGENT"]]) test(`separate exposure ${exposure}/${product}`, () => assert.equal(first(portfolio(snapshot([obligation({ product })]))).exposureClass, exposure));
test("guarantee excluded from funded debt", () => { const p = portfolio(snapshot([obligation({ product: "Банковская гарантия", guaranteeAmount: 10000000 })])); assert.equal(p.summary.fundedDebt.knownAmount, 0); assert.equal(p.summary.contingentGuaranteeExposure.knownAmount, 10000000); assert.equal(first(p).schedule.some(s => s.type === "MATURITY"), false); });
test("leasing exposure separate from funded", () => { const p = portfolio(snapshot([obligation({ product: "Лизинг" })])); assert.equal(p.summary.fundedDebt.knownAmount, 0); assert.equal(p.summary.leaseExposure.knownAmount, 5100000); });
test("unknown factoring recourse not funded", () => { const p = portfolio(snapshot([obligation({ product: "Факторинг" })])); assert.equal(p.summary.fundedDebt.knownAmount, 0); assert.equal(p.summary.factoringExposure.knownAmount, 5100000); assert.ok(first(p).warnings.includes("FACTORING_RECOURSE_UNKNOWN")); });

test("summary obligation/active count", () => { const p = seed(); assert.equal(p.summary.obligationCount, 1); assert.equal(p.summary.activeObligationCount, 1); });
test("closed obligations excluded from active funded sum", () => assert.equal(portfolio(snapshot([obligation({ status: "Закрыт" })])).summary.fundedDebt.knownAmount, 0));
test("funded principal aggregation", () => assert.equal(seed().summary.fundedDebt.value, 5000000));
test("credit limits/utilized/available separate", () => { const s = line().summary; assert.equal(s.creditLimits.value, 10000000); assert.equal(s.utilizedLimits.value, 6200000); assert.equal(s.availableLimits.value, 3800000); });
test("unknown outstanding count and partial sum", () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: null })])); assert.equal(p.summary.unknownOutstandingObligationCount, 1); assert.equal(p.summary.fundedDebt.value, null); assert.equal(p.summary.fundedDebt.unknownObligationCount, 1); });
test("weighted rate uses current principal, not original", () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: 1000000, annualRate: 10 }), obligation({ id: "sb-2", accountNumber: "ACC-2", outstandingPrincipal: 3000000, annualRate: 30 })])); assert.equal(p.summary.weightedAverageKnownAnnualRate, 25); assert.equal(p.summary.annualRateCoverage, 1); });
test("partial rate coverage retained", () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: 1000000, annualRate: 10 }), obligation({ id: "sb-2", accountNumber: "ACC-2", outstandingPrincipal: 1000000, annualRate: null })])); assert.equal(p.summary.annualRateCoverage, .5); assert.equal(p.summary.unknownRateObligationCount, 1); });
test("highest known rate is factual ID", () => assert.equal(seed().summary.highestKnownAnnualRateObligationId, first(seed()).obligationId));
test("nearest maturity factual date", () => assert.equal(seed().summary.nearestMaturityDate, "2027-06-30"));
for (const [days, amount] of [[7, 0], [30, 420000], [60, 420000]]) test(`${days}-day schedule no expansion`, () => { const s = seed().summary[`scheduledPayments${days}d`]; assert.equal(s.knownAmount, amount); assert.ok(s.warnings.includes("SCHEDULE_INCOMPLETE")); if (days === 7) assert.equal(s.value, null); });
test("missing schedule not zero confirmed payments", () => { const p = portfolio(snapshot([obligation({ nextPaymentDate: "" })])); assert.equal(p.summary.scheduledPayments30d.value, null); assert.equal(p.summary.scheduledPayments30d.unknownObligationCount, 1); });
test("summary confidence reflects missing outstanding/rate", () => assert.equal(portfolio(snapshot([obligation({ annualRate: null, outstandingPrincipal: null })])).summary.confidence, "UNKNOWN"));

test("canonical agreement batch seeds portfolio without parser", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, documents: [document("CREDIT_AGREEMENT", [observation("annualRate", 21), observation("creditLimit", 10000000)])] }); assert.equal(p.obligations.length, 1); assert.equal(first(p).currentTerms.annualRate.value, 21); });
test("canonical schedule batch creates many events", () => { const obs = ["2026-01-10", "2026-02-10", "2026-03-10"].flatMap((due, i) => [observation(`schedule.p${i}.type`, "PAYMENT_DUE"), observation(`schedule.p${i}.dueDate`, due), observation(`schedule.p${i}.amount`, 100)]); const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, documents: [document("PAYMENT_SCHEDULE", obs)] }); assert.equal(first(p).schedule.filter(s => s.type === "PAYMENT_DUE").length, 3); });
test("canonical collateral preserves document evidence", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, documents: [document("COLLATERAL_DOCUMENT", [observation("collateralDescription", "Станок")])] }); assert.equal(first(p).currentTerms.collateralDescription.value, "Станок"); assert.ok(first(p).currentTerms.collateralDescription.evidence.some(e => e.documentKind === "COLLATERAL_DOCUMENT")); });
test("canonical insurance creates requirement and expiry event", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, documents: [document("INSURANCE_DOCUMENT", [observation("insurance.p1.expiryDate", "2026-06-30"), observation("insurance.p1.insurer", "Страховщик")])] }); assert.equal(first(p).currentTerms.insuranceRequirements[0].insurer, "Страховщик"); assert.ok(first(p).schedule.some(s => s.type === "INSURANCE_EXPIRY")); });
test("reporting and covenant foundations retain known dates only", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, observations: [observation("reporting.q1.title", "Quarterly report"), observation("reporting.q1.dueDate", "2026-04-30"), observation("covenant.c1.title", "Financial covenant")] }); assert.equal(first(p).currentTerms.covenants.length, 1); assert.ok(first(p).schedule.some(s => s.type === "REPORTING_DUE")); assert.equal(p.events.some(e => /BREACH/.test(e.type)), false); });
test("mock OKB canonical snapshot uses same downstream engine", () => { const uploaded = snapshot(), okb = { ...uploaded, provider: "OKB", sourceId: "okb:1", snapshotId: "okb:snapshot" }; const p = portfolio(okb); assert.equal(p.creditHistorySnapshots[0].provider, "OKB"); assert.equal(first(p).currentPosition.principalOutstanding.value, first(portfolio(uploaded)).currentPosition.principalOutstanding.value); });

const baseline = analyzeBankStatement(block2StatementFixture(), "baseline.txt");
test("portfolio company ID independent of analysis", () => assert.equal(seed().portfolioId, `portfolio:${inn}`));
test("old analysis loads without optional portfolio", () => { const a = structuredClone(baseline); delete a.creditPortfolioV1; delete a.debtPaymentObservationsV1; delete a.creditPortfolioWarnings; assert.equal(analysisView(a, "FULL").score, 872); });
test("old possibly truncated list not backfilled", () => { const a = { ...baseline, transactions: [tx()], transactionsTruncated: true, debtPaymentObservationsV1: undefined, creditPortfolioV1: undefined }; const r = portfolioForAnalysis(a, { asOfDate: baseline.periodTo }); assert.equal(r.debtPaymentObservationsV1, undefined); assert.ok(r.creditPortfolioWarnings.includes("PAYMENT_OBSERVATIONS_UNAVAILABLE")); });
test("compact payments preserved beyond transaction projection", () => { const transactions = Array.from({ length: 10005 }, (_, i) => tx("DEBT_SERVICE_UNSPLIT", 100, { id: `t${i}`, canonicalTransactionId: `t${i}` })); const a = { ...baseline, companyInn: inn, transactions, originalTransactionCount: transactions.length, creditPortfolioV1: undefined }; const fields = portfolioForAnalysis(a, { completeTransactions: transactions, asOfDate: "2026-01-05" }); const stored = analysisForStorage({ ...a, ...fields }); assert.equal(stored.transactions.length, 10000); assert.equal(stored.debtPaymentObservationsV1.length, 10005); });
test("FREE unchanged and no individual debt exposure", () => { const before = analysisView(baseline, "FREE"); const a = { ...baseline, creditPortfolioV1: seed(), debtPaymentObservationsV1: [payment()] }; assert.deepEqual(analysisView(a, "FREE"), before); });
test("FULL and JSON storage retain portfolio", () => { const a = { ...baseline, creditPortfolioV1: seed() }; assert.deepEqual(analysisView(a, "FULL").creditPortfolioV1, seed()); assert.deepEqual(analysisForStorage(a).creditPortfolioV1, seed()); });
test("shadow exception isolated with exact warning", () => { const r = buildCreditPortfolioShadow({ companyInn: "invalid", asOfDate: date }); assert.equal(r.creditPortfolioV1, undefined); assert.deepEqual(r.creditPortfolioWarnings, ["CREDIT_PORTFOLIO_SHADOW_UNAVAILABLE"]); });
test("shadow failure leaves authoritative outputs and Block 6", () => { const failure = buildCreditPortfolioShadow({ companyInn: inn, asOfDate: "invalid" }); const a = { ...baseline, ...failure }; assert.deepEqual(a.metrics, baseline.metrics); assert.deepEqual(a.reconciliationV1, baseline.reconciliationV1); assert.equal(a.score, 872); assert.equal(a.grade, "A"); assert.equal(a.readiness, "Высокая готовность"); assert.equal(a.metrics.estimatedLimitMin, 1283000); assert.equal(a.metrics.estimatedLimitMax, 2636000); });
test("input portfolio remains immutable", () => { const a = seed(), before = structuredClone(a); update(undefined, { previousPortfolio: a }); assert.deepEqual(a, before); });
test("old BKI legacy objects unchanged by integration", () => { const a = { ...baseline, companyInn: inn, creditHistory: report(), sourceManifest: { ...baseline.sourceManifest, bki: envelope() }, creditPortfolioV1: undefined, creditPortfolioComparison: { legacy: "preserved" }, creditHistoryInsights: [{ legacy: "preserved" }] }; const before = structuredClone(a); portfolioForAnalysis(a, { asOfDate: date }); assert.deepEqual(structuredClone(a), before); });
test("invalid observations fail shadow safely", () => { const p = buildCreditPortfolioShadow({ companyInn: inn, asOfDate: date, observations: [observation("annualRate", Infinity)] }); assert.equal(p.creditPortfolioV1, undefined); });
test("no implicit current clock", () => assert.throws(() => buildCreditPortfolio({ companyInn: inn, asOfDate: undefined }), /DATE/));
test("stable event and schedule IDs", () => { const a = seed(), b = seed(); assert.deepEqual(a.events.map(e => e.eventId), b.events.map(e => e.eventId)); assert.deepEqual(first(a).schedule.map(s => s.scheduledEventId), first(b).schedule.map(s => s.scheduledEventId)); });
test("no risk/action verdict vocabulary", () => { const p = seed(); assert.equal(p.events.some(e => ["HIGH_RISK", "STOP", "APPROVE", "DECLINE", "REFINANCE_NOW"].includes(e.type)), false); });

test("creditor INN enrichment retains existing name/account obligation", () => {
  const a = portfolio(snapshot(undefined, date, "bki:1", { identityHints: {} }));
  const p = portfolio(snapshot(undefined, "2026-02-01", "bki:2"), { previousPortfolio: a });
  assert.equal(p.obligations.length, 1); assert.equal(first(p).obligationId, first(a).obligationId);
});
test("same bank and composite with distinct accounts stay separate", () => {
  const p = portfolio(snapshot([obligation(), obligation({ id: "sb-2", accountNumber: "ACC-2" })], date, "bki:1", { identityHints: {} }));
  assert.equal(p.obligations.length, 2);
});
test("conflicting known creditor INN never merges name match", () => {
  const p = portfolio(snapshot(undefined, "2026-02-01", "bki:2", { identityHints: { "sb-1": { creditorInn: "7701000001", contractNumber: "LN-1" } } }), { previousPortfolio: seed() });
  assert.equal(p.obligations.length, 2);
});
test("company guarantor role remains a contingent obligation", () => assert.equal(first(portfolio(snapshot([obligation({ role: "Поручитель" })]))).type, "GUARANTORSHIP"));
test("bank guarantee close date becomes guarantee expiry", () => { const o = first(portfolio(snapshot([obligation({ product: "Банковская гарантия" })]))); assert.equal(o.currentTerms.maturityDate.knowledge, "UNKNOWN"); assert.ok(o.schedule.some(s => s.type === "GUARANTEE_EXPIRY")); });
test("account substring not an exact account reference", () => { const p = payment(undefined, 500000, { purpose: "Погашение ACC-10" }); assert.notEqual(matchPayments([p], seed().obligations)[0].outcome, "MATCHED"); });
test("derived position source IDs include matched statement", () => assert.ok(first(withPayments([payment()])).sourceIds.includes("bank:1")));
test("representative workload: 100 companies, histories, payments and schedules", t => {
  const started = performance.now(); let totals = { obligations: 0, positions: 0, terms: 0, payments: 0, schedules: 0 };
  for (let company = 0; company < 100; company++) {
    const companyInn = String(7701234500 + company), observations = [], payments = [];
    for (let loan = 0; loan < 20; loan++) {
      const h = { creditorName: "Банк А", creditorInn: bankInn, contractNumber: `P-${loan}`, productType: "TERM_LOAN" };
      for (let version = 0; version < 5; version++) {
        const observed = `2026-0${version + 1}-01`, sourceId = `company:${company}:loan:${loan}:v:${version}`;
        for (const [field, value] of [["annualRate", 20 + version], ["principalOutstanding", 5000000 - version * 100000], ["status", "ACTIVE"]]) observations.push(observation(field, value, observed, { companyInn, obligationHints: h, sourceId }));
      }
      for (let n = 0; n < 5; n++) {
        const sourceId = `schedule:${company}:${loan}`;
        observations.push(observation(`schedule.p${n}.type`, "PAYMENT_DUE", date, { companyInn, obligationHints: h, sourceId }));
        observations.push(observation(`schedule.p${n}.dueDate`, `2026-0${n + 1}-05`, date, { companyInn, obligationHints: h, sourceId }));
        observations.push(observation(`schedule.p${n}.amount`, 100000, date, { companyInn, obligationHints: h, sourceId }));
        const p = buildDebtPaymentObservations([tx("LOAN_PRINCIPAL_PAYMENT", 100000, { id: `p:${company}:${loan}:${n}`, canonicalTransactionId: `p:${company}:${loan}:${n}`, date: `2026-0${n + 1}-05`, purpose: `Погашение по договору № P-${loan}` })], companyInn)[0]; payments.push(p);
      }
    }
    const p = buildCreditPortfolio({ companyInn, asOfDate: "2026-05-05", observations, paymentObservations: payments });
    totals.obligations += p.obligations.length; totals.positions += p.obligations.reduce((n, o) => n + o.positionHistory.length, 0); totals.terms += p.obligations.reduce((n, o) => n + o.termsHistory.length, 0); totals.payments += p.paymentObservations.length; totals.schedules += p.obligations.reduce((n, o) => n + o.schedule.length, 0);
  }
  assert.deepEqual(totals, { obligations: 2000, positions: 10000, terms: 10000, payments: 10000, schedules: 10000 });
  t.diagnostic(`PORTFOLIO_PERFORMANCE ${JSON.stringify({ companies: 100, ...totals, elapsedMs: Math.round(performance.now() - started) })}`);
});
test("later BKI preserves earlier derived principal history", () => { const a = withPayments([payment()]); const p = portfolio(snapshot([obligation({ outstandingPrincipal: 4470000 })], "2026-02-01", "bki:2"), { previousPortfolio: a }); assert.ok(first(p).positionHistory.some(h => h.asOf === "2026-01-05" && h.position.principalOutstanding.value === 4500000 && h.position.principalOutstanding.origin === "DERIVED")); });
test("unresolved observations cannot claim a complete portfolio total", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: "2026-02-01", previousPortfolio: seed(), observations: [observation("principalOutstanding", 3000000, "2026-02-01", { obligationHints: { creditorName: "Банк А" } })] }); assert.equal(p.summary.fundedDebt.value, null); assert.ok(p.summary.warnings.includes("UNRESOLVED_OBLIGATION_OBSERVATIONS")); });
test("later supported product resolves an initially unknown type", () => { const a = portfolio(snapshot([obligation({ product: "Кредит" })])); const p = portfolio(snapshot(undefined, "2026-02-01", "bki:2"), { previousPortfolio: a }); assert.equal(p.obligations.length, 1); assert.equal(first(p).type, "TERM_LOAN"); });

// Final correction review: company role is distinct from report subject scope.
for (const role of ["Поручитель", "Гарант", "guarantor"]) test(`company ${role} preserves contingent evidence`, () => {
  const p = portfolio(snapshot([obligation({ role, guaranteeAmount: 700000 })])); const o = first(p);
  assert.equal(o.type, "GUARANTORSHIP"); assert.equal(o.exposureClass, "CONTINGENT");
  assert.equal(p.summary.fundedDebt.knownAmount, 0); assert.equal(p.summary.contingentGuaranteeExposure.value, 700000);
  assert.equal(o.currentPosition.principalOutstanding.knowledge, "UNKNOWN"); assert.equal(o.currentPosition.totalOutstanding.knowledge, "UNKNOWN");
  assert.equal(o.identity.accountNumber.value, "ACC-1"); assert.equal(o.status.value, "ACTIVE"); assert.ok(o.currentTerms.guaranteeAmount.evidence.length);
});
test("company guarantorship never substitutes borrower principal for guarantee", () => { const p = portfolio(snapshot([obligation({ role: "Поручитель", guaranteeAmount: null })])); assert.equal(p.summary.contingentGuaranteeExposure.value, null); assert.equal(p.summary.contingentGuaranteeExposure.unknownObligationCount, 1); assert.equal(first(p).currentPosition.contingentExposure.knowledge, "UNKNOWN"); });
test("bank guarantee and company guarantorship are different types", () => { const a = first(portfolio(snapshot([obligation({ product: "Банковская гарантия" })]))), b = first(portfolio(snapshot([obligation({ role: "Поручитель" })]))); assert.equal(a.type, "BANK_GUARANTEE"); assert.equal(b.type, "GUARANTORSHIP"); });
for (const relationshipToCompany of ["Собственник", "Директор", "Поручитель"]) test(`personal ${relationshipToCompany} report still excluded`, () => { const s = adaptUploadedBki(report([obligation({ role: "Поручитель" })], { subjectInn: "770123456789", affectsCompanyDebt: false, relationshipToCompany }), context()); assert.equal(portfolio(s).obligations.length, 0); });
test("company borrower remains funded", () => assert.equal(first(seed()).exposureClass, "FUNDED_DEBT"));
const weakRows = () => [obligation({ accountNumber: "", outstandingPrincipal: 2000000 }), obligation({ id: "sb-2", accountNumber: "", outstandingPrincipal: 3000000 })];
test("distinct weak rows have unique source-local keys and remain unresolved", () => {
  const s = snapshot(weakRows(), date, "bki:weak", { identityHints: {} });
  assert.equal(new Set(s.obligations.map(o => o.observationKey)).size, 2);
  const shadow = buildCreditPortfolioShadow({ companyInn: inn, asOfDate: date, creditHistorySnapshots: [s], paymentObservations: [] });
  assert.ok(shadow.creditPortfolioV1); const p = shadow.creditPortfolioV1;
  assert.equal(p.obligations.length, 0); assert.equal(p.obligationMatches.filter(m => m.outcome === "AMBIGUOUS").length, 2);
  assert.equal(new Set(p.observationHistory.map(o => o.observationId)).size, p.observationHistory.length);
  assert.ok(p.observationHistory.some(o => o.value === 2000000)); assert.ok(p.observationHistory.some(o => o.value === 3000000));
  assert.equal(p.summary.fundedDebt.value, null); assert.equal(p.summary.fundedDebt.coverage, null);
});
test("duplicate source row IDs with different content do not crash", () => { const rows = weakRows().map(o => ({ ...o, id: "sb-1" })); const p = portfolio(snapshot(rows, date, "bki:dup", { identityHints: {} })); assert.equal(p.obligationMatches.filter(m => m.outcome === "AMBIGUOUS").length, 2); });
test("exact repeated source-local row is safely deduplicated", () => { const row = obligation(); const p = portfolio(snapshot([row, { ...row }])); assert.equal(p.obligations.length, 1); });
test("strong account evidence can resolve genuinely duplicate source rows", () => { const p = portfolio(snapshot([obligation(), obligation({ id: "sb-2" })], date, "bki:strong", { identityHints: {} })); assert.equal(p.obligations.length, 1); });
test("row IDs changing across snapshots do not change canonical account identity", () => { const a = portfolio(snapshot(undefined, date, "bki:1", { identityHints: {} })); const b = portfolio(snapshot([obligation({ id: "sb-99", outstandingPrincipal: 4000000 })], "2026-02-01", "bki:2", { identityHints: {} }), { previousPortfolio: a }); assert.equal(b.obligations.length, 1); assert.equal(first(b).obligationId, first(a).obligationId); });
for (const type of [undefined, "UNKNOWN", "INVALID"]) test(`generic schedule type ${type} is not payment`, () => {
  const obs = [observation("schedule.x.dueDate", "2026-01-03"), observation("schedule.x.amount", 250000), ...(type === undefined ? [] : [observation("schedule.x.type", type)])];
  const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, observations: obs }); assert.equal(first(p).schedule[0].type, "OTHER");
  for (const days of [7, 30, 60]) { assert.equal(p.summary[`scheduledPayments${days}d`].knownAmount, 0); assert.equal(p.summary[`scheduledPayments${days}d`].value, null); }
});
test("explicit generic PAYMENT_DUE enters reported payment totals", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, observations: [observation("schedule.x.dueDate", "2026-01-03"), observation("schedule.x.amount", 250000), observation("schedule.x.type", "PAYMENT_DUE")] }); assert.equal(p.summary.scheduledPayments7d.knownAmount, 250000); });
test("explicit generic other event retains its type", () => { const p = buildCreditPortfolio({ companyInn: inn, asOfDate: date, observations: [observation("schedule.x.dueDate", "2026-01-03"), observation("schedule.x.amount", 250000), observation("schedule.x.type", "RATE_REVIEW")] }); assert.equal(first(p).schedule[0].type, "RATE_REVIEW"); assert.equal(p.summary.scheduledPayments30d.knownAmount, 0); });
const laterUnknown = (payments) => portfolio(snapshot([obligation({ outstandingPrincipal: null })], "2026-03-01", "bki:2"), { previousPortfolio: seed(), paymentObservations: payments });
test("current UNKNOWN does not block valid confirmed-anchor derivation", () => { const p = laterUnknown([payment(undefined, 500000, { date: "2026-02-01" })]), v = first(p).currentPosition.principalOutstanding; assert.equal(v.value, 4500000); assert.equal(v.origin, "DERIVED"); assert.equal(v.verification, "UNCONFIRMED"); });
test("current reported KNOWN wins over eligible principal payments", () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: 4470000 })], "2026-03-01", "bki:2"), { previousPortfolio: seed(), paymentObservations: [payment(undefined, 500000, { date: "2026-02-01" })] }); const v = first(p).currentPosition.principalOutstanding; assert.equal(v.value, 4470000); assert.equal(v.origin, "REPORTED"); });
test("current principal conflict is retained instead of derived away", () => { const p = portfolio(snapshot([obligation({ outstandingPrincipal: 4400000 })], "2026-03-01", "bki:2"), { previousPortfolio: seed(), observations: [observation("principalOutstanding", 4700000, "2026-03-01")], paymentObservations: [payment()] }); const v = first(p).currentPosition.principalOutstanding; assert.equal(v.verification, "CONFLICTED"); assert.equal(v.value, null); assert.ok(v.evidence.length >= 2); });
test("current UNKNOWN plus unsplit still unavailable", () => assert.equal(first(laterUnknown([payment("DEBT_SERVICE_UNSPLIT", 500000, { date: "2026-02-01" })])).currentPosition.principalOutstanding.knowledge, "UNKNOWN"));
test("current UNKNOWN plus interest only never reduces anchor", () => assert.equal(first(laterUnknown([payment("INTEREST_PAYMENT", 500000, { date: "2026-02-01" })])).currentPosition.principalOutstanding.knowledge, "UNKNOWN"));
