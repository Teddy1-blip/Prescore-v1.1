import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAmount, normalizeTransactionDate, normalizeAccountValue, normalizePurpose, normalizeCurrency } from "../lib/credit-engine/normalization/value-normalizers.ts";
import { normalizeCounterparty } from "../lib/credit-engine/normalization/counterparty-normalizer.ts";
import { determineDirection } from "../lib/credit-engine/normalization/direction.ts";
import { normalizeTransaction } from "../lib/credit-engine/normalization/transaction-normalizer.ts";
import { deduplicateTransactions } from "../lib/credit-engine/normalization/deduplication.ts";
import { linkInternalTransfersAndReversals } from "../lib/credit-engine/normalization/transfer-matching.ts";
import { canonicalToLegacyFacts } from "../lib/credit-engine/normalization/compatibility-adapter.ts";
import { adaptOneCDocument } from "../lib/credit-engine/normalization/one-c-parser-adapter.ts";

function raw(overrides = {}) {
  return {
    bankDocumentId: "42",
    date: "15.07.2026",
    amount: "1250000.00",
    currency: "RUB",
    payerName: "ООО Покупатель",
    payerInn: "7701234567",
    payerAccount: "40702810999990000001",
    recipientName: "ООО СИТИМЭЙТС",
    recipientInn: "5032333146",
    recipientAccount: "40702810111110000001",
    purpose: "Оплата по договору за выполненные работы",
    statementAccount: "40702810111110000001",
    companyInn: "5032333146",
    companyAccounts: ["40702810111110000001"],
    bank: "Уралсиб",
    sourceId: "source:one",
    sourceFileId: "source:one",
    sourceFileName: "one.txt",
    sourceRow: null,
    rawReference: "sha256:abc",
    parserVersion: "PRESCORE-STATEMENT-PARSER-1",
    ordinal: 0,
    ...overrides,
  };
}

test("normalizes Russian and international amount formats", () => {
  for (const value of ["1 250 000,00", "1 250 000.00", "1250000.00", "1.250.000,00", "1.250.000"]) assert.equal(normalizeAmount(value).value, 1250000);
});

test("rejects a malformed amount instead of guessing", () => {
  assert.deepEqual(normalizeAmount("12.34.56"), { value: null, warning: "AMOUNT_MALFORMED" });
});

test("distinguishes known zero from an unknown amount", () => {
  assert.deepEqual(normalizeAmount("0,00"), { value: 0, warning: "AMOUNT_ZERO" });
  assert.deepEqual(normalizeAmount(null), { value: null, warning: "AMOUNT_UNKNOWN" });
});

test("normalizes supported transaction dates", () => {
  for (const value of ["1.7.2026", "01/07/2026", "01-07-2026"]) assert.equal(normalizeTransactionDate(value).value, "2026-07-01");
});

test("rejects an impossible calendar date", () => {
  assert.deepEqual(normalizeTransactionDate("31.02.2026"), { value: null, warning: "DATE_INVALID" });
});

test("normalizes account characters without inventing a missing account", () => {
  assert.equal(normalizeAccountValue("4070 2810-1111").value, "407028101111");
  assert.equal(normalizeAccountValue("").value, null);
});

test("normalizes whitespace in payment purpose", () => {
  assert.equal(normalizePurpose("  Оплата   по договору  ").value, "Оплата по договору");
});

test("keeps explicit currency and defaults the current 1C flow to RUB", () => {
  assert.equal(normalizeCurrency("usd").value, "USD");
  assert.equal(normalizeCurrency(null).value, "RUB");
});

test("normalizes counterparty spelling while preserving raw identity", () => {
  const result = normalizeCounterparty("  ООО «Ёлка»  ", "7701 234 567").counterparty;
  assert.equal(result.nameRaw, "ООО «Ёлка»");
  assert.equal(result.nameNormalized, 'ООО "ЕЛКА"');
  assert.equal(result.innNormalized, "7701234567");
  assert.equal(result.identityConfidence, "HIGH");
});

test("does not accept an invalid counterparty INN as known", () => {
  const result = normalizeCounterparty("ООО Альфа", "123");
  assert.equal(result.counterparty.innNormalized, null);
  assert.ok(result.warnings.includes("COUNTERPARTY_INN_INVALID"));
});

test("determines OUT by the company payer account", () => {
  const result = determineDirection({ companyInn: "5032333146", companyAccounts: new Set(["A"]), payerInn: null, recipientInn: null, payerAccount: "A", recipientAccount: "B" });
  assert.equal(result.direction, "OUT");
  assert.equal(result.evidence.selectedRule, "COMPANY_PAYER_ACCOUNT");
});

test("determines IN by the company recipient account", () => {
  const result = determineDirection({ companyInn: "5032333146", companyAccounts: new Set(["A"]), payerInn: null, recipientInn: null, payerAccount: "B", recipientAccount: "A" });
  assert.equal(result.direction, "IN");
});

test("keeps account evidence priority and exposes an INN conflict", () => {
  const result = determineDirection({ companyInn: "5032333146", companyAccounts: new Set(["A"]), payerInn: "7701234567", recipientInn: "5032333146", payerAccount: "A", recipientAccount: "B" });
  assert.equal(result.direction, "OUT");
  assert.equal(result.evidence.conflict, true);
});

test("returns UNKNOWN when no directional evidence exists", () => {
  assert.equal(determineDirection({ companyInn: null, companyAccounts: new Set(), payerInn: null, recipientInn: null, payerAccount: null, recipientAccount: null }).direction, "UNKNOWN");
});

test("creates a deterministic canonical transaction identifier", () => {
  assert.equal(normalizeTransaction(raw()).transactionId, normalizeTransaction(raw()).transactionId);
});

test("marks malformed critical values as low-quality without coercing them", () => {
  const item = normalizeTransaction(raw({ date: "31.02.2026", amount: "bad" }));
  assert.equal(item.date, null);
  assert.equal(item.amount, null);
  assert.equal(item.quality.level, "LOW");
});

test("detects an own-account transfer from both company INNs", () => {
  const item = normalizeTransaction(raw({ payerInn: "5032333146", recipientInn: "5032333146" }));
  assert.equal(item.isOwnAccountTransfer, true);
  assert.ok(item.ownAccountTransferEvidence.includes("BOTH_SIDES_COMPANY_INN"));
});

test("removes exact duplicate transactions", () => {
  const first = normalizeTransaction(raw());
  const second = normalizeTransaction(raw({ sourceId: "source:two", sourceFileId: "source:two", sourceFileName: "two.txt" }));
  const result = deduplicateTransactions([first, second]);
  assert.equal(result.retained.length, 1);
  assert.equal(result.exactDuplicateCount, 1);
  assert.equal(second.duplicateStatus, "EXACT");
});

test("retains a probable duplicate for review", () => {
  const first = normalizeTransaction(raw());
  const second = normalizeTransaction(raw({ bankDocumentId: "43", sourceId: "source:two", sourceFileId: "source:two", sourceFileName: "two.txt" }));
  const result = deduplicateTransactions([first, second]);
  assert.equal(result.retained.length, 2);
  assert.equal(result.probableDuplicateCount, 1);
  assert.equal(second.duplicateStatus, "PROBABLE");
});

test("keeps distinct document IDs from one source legitimate", () => {
  const first = normalizeTransaction(raw());
  const second = normalizeTransaction(raw({ bankDocumentId: "43", ordinal: 1 }));
  const result = deduplicateTransactions([first, second]);
  assert.equal(result.retained.length, 2);
  assert.equal(result.probableDuplicateCount, 0);
});

test("links the two legs of an own transfer without changing amounts", () => {
  const outgoing = normalizeTransaction(raw({ payerName: "ООО СИТИМЭЙТС", payerInn: "5032333146", payerAccount: "40702810000000000001", recipientName: "ООО СИТИМЭЙТС", recipientInn: "5032333146", recipientAccount: "40702810000000000002", statementAccount: "40702810000000000001", companyAccounts: ["40702810000000000001"] }));
  const incoming = normalizeTransaction(raw({ sourceId: "source:two", sourceFileId: "source:two", sourceFileName: "two.txt", payerName: "ООО СИТИМЭЙТС", payerInn: "5032333146", payerAccount: "40702810000000000001", recipientName: "ООО СИТИМЭЙТС", recipientInn: "5032333146", recipientAccount: "40702810000000000002", statementAccount: "40702810000000000002", companyAccounts: ["40702810000000000002"] }));
  const result = linkInternalTransfersAndReversals([outgoing, incoming]);
  assert.equal(result.transferPairCount, 1);
  assert.equal(outgoing.transferPairId, incoming.transferPairId);
  assert.equal(outgoing.amount, 1250000);
});

test("marks a possible reversal as diagnostic only", () => {
  const incoming = normalizeTransaction(raw());
  const outgoing = normalizeTransaction(raw({ bankDocumentId: "43", date: "17.07.2026", payerName: "ООО СИТИМЭЙТС", payerInn: "5032333146", payerAccount: "40702810111110000001", recipientName: "ООО Покупатель", recipientInn: "7701234567", recipientAccount: "40702810999990000001", ordinal: 1 }));
  const result = linkInternalTransfersAndReversals([incoming, outgoing]);
  assert.equal(result.possibleReversalCount, 1);
  assert.equal(outgoing.possibleReversalOfTransactionId, incoming.transactionId);
});

test("compatibility adapter preserves the existing transaction facts", () => {
  const legacy = canonicalToLegacyFacts(normalizeTransaction(raw()));
  assert.equal(legacy.id, "42");
  assert.equal(legacy.direction, "in");
  assert.equal(legacy.amount, 1250000);
  assert.equal(legacy.counterparty, "ООО Покупатель");
});

test("1C adapter separates raw parser fields from canonical normalization", () => {
  const result = adaptOneCDocument({ Номер: "9", Дата: "1.7.2026", Сумма: "10,00", Плательщик: "А", Получатель: "Б", НазначениеПлатежа: "Тест", __account: "A" }, raw());
  assert.equal(result.bankDocumentId, "9");
  assert.equal(result.statementAccount, "A");
  assert.equal(result.amount, "10,00");
});

test("normalization retains raw source values for audit", () => {
  const item = normalizeTransaction(raw({ amount: "1 250 000,00", purpose: "  Оплата   по договору  " }));
  assert.equal(item.rawValues.amount, "1 250 000,00");
  assert.equal(item.rawValues.purpose, "Оплата   по договору");
  assert.equal(item.purposeNormalized, "Оплата по договору");
});

test("normalizes 10,000 transactions from 30 sources in bounded time", () => {
  const started = performance.now();
  const items = Array.from({ length: 10_000 }, (_, index) => normalizeTransaction(raw({
    bankDocumentId: String(index),
    sourceId: `source:${index % 30}`,
    sourceFileId: `source:${index % 30}`,
    sourceFileName: `source-${index % 30}.txt`,
    ordinal: index,
    amount: String(1000 + index),
  })));
  const result = deduplicateTransactions(items);
  linkInternalTransfersAndReversals(result.retained);
  assert.equal(result.retained.length, 10_000);
  assert.ok(performance.now() - started < 5_000);
});
