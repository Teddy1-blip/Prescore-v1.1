import assert from "node:assert/strict";
import test from "node:test";

import {
  analysisForStorage,
  analyzeBankStatements,
  screenBankStatements,
} from "../lib/prescore.ts";
import {
  analyzeCalendarCoverage,
  knownValue,
  sha256Hex,
  unknownValue,
} from "../lib/credit-engine/source-foundation.ts";
import { statementFixture } from "./fixtures/block1-statements.mjs";

async function source(text, fileName) {
  const contentHash = await sha256Hex(new TextEncoder().encode(text));
  return { text, fileName, contentHash, sourceId: `statement:${contentHash}` };
}

test("Block 1 statement screening returns an explicit result for every file", async () => {
  const ownOne = await source(statementFixture(), "own-one.txt");
  const ownTwo = await source(statementFixture({ account: "40702810222220000002", number: "2" }), "own-two.txt");
  const foreign = await source(statementFixture({ account: "40702810333330000003", inn: "7701234567", company: "ООО ДРУГОЙ КЛИЕНТ", number: "3" }), "foreign.txt");
  const unsupported = await source("обычный текст", "unknown.txt");
  const duplicate = { ...ownOne, fileName: "own-copy.txt" };
  const screened = screenBankStatements([ownOne, ownTwo, foreign, unsupported, duplicate]);

  assert.equal(screened.companyInn, "5032333146");
  assert.deepEqual(screened.screeningResults.map((item) => [item.fileName, item.status]), [
    ["own-one.txt", "ACCEPTED"],
    ["own-two.txt", "ACCEPTED"],
    ["foreign.txt", "COMPANY_MISMATCH"],
    ["unknown.txt", "UNSUPPORTED"],
    ["own-copy.txt", "DUPLICATE"],
  ]);
  assert.equal(screened.accepted.length, 2);
});

test("Block 1 source manifest and transaction provenance are additive", async () => {
  const one = await source(statementFixture(), "one.txt");
  const two = await source(statementFixture({ account: "40702810222220000002", number: "2" }), "two.txt");
  const screened = screenBankStatements([one, two]);
  const result = analyzeBankStatements(screened.accepted, { screeningResults: screened.screeningResults });

  assert.equal(result.sourceManifest?.bankStatements.length, 2);
  assert.ok(result.sourceManifest?.bankStatements.every((item) => item.status === "READY"));
  assert.ok(result.transactions.every((item) => item.sourceId && item.sourceFileName && item.parserVersion && item.classifierVersion));
  assert.equal(result.integrity?.dataQuality.sourceCount, 2);
  assert.equal(result.integrity?.dataQuality.fieldKnownRates.source, 1);
  assert.equal(result.integrity?.dataQuality.parserConfidence, null);
  assert.equal(result.deduplication?.removedCount, 0);
});

test("Block 1 calendar coverage detects FULL, PARTIAL, MISSING and OVERLAP", () => {
  const coverage = analyzeCalendarCoverage([
    { sourceId: "a", periodFrom: "2026-01-01", periodTo: "2026-01-31" },
    { sourceId: "b", periodFrom: "2026-02-10", periodTo: "2026-02-28" },
    { sourceId: "c", periodFrom: "2026-04-01", periodTo: "2026-04-30" },
    { sourceId: "d", periodFrom: "2026-04-15", periodTo: "2026-05-31" },
  ]);
  assert.deepEqual(coverage.map((item) => [item.month, item.status]), [
    ["2026-01", "FULL"],
    ["2026-02", "PARTIAL"],
    ["2026-03", "MISSING"],
    ["2026-04", "OVERLAP"],
    ["2026-05", "FULL"],
  ]);
});

test("Block 1 distinguishes a known zero from an unknown value", () => {
  assert.deepEqual(knownValue(0), { status: "KNOWN", value: 0 });
  assert.deepEqual(unknownValue(), { status: "UNKNOWN", value: null });
});

test("Block 1 keeps missing opening and ending balances unknown", async () => {
  const item = await source(statementFixture({ openingBalance: null, endingBalance: null }), "missing-balances.txt");
  const screened = screenBankStatements([item]);
  assert.equal(screened.screeningResults[0].openingBalanceStatus, "UNKNOWN");
  assert.equal(screened.screeningResults[0].endingBalanceStatus, "UNKNOWN");
  const result = analyzeBankStatements(screened.accepted, { screeningResults: screened.screeningResults });
  assert.equal(result.metrics.endingBalance, null);
  assert.ok(result.integrity?.warnings.some((warning) => /остат/i.test(warning)));
});

test("Block 1 exposes aggregate transaction deduplication diagnostics", async () => {
  const firstText = statementFixture({ number: "42" });
  const secondText = firstText.replace("Отправитель=Банк Клиент Онлайн", "Отправитель=Уралсиб Бизнес");
  const first = await source(firstText, "first.txt");
  const second = await source(secondText, "second.txt");
  const screened = screenBankStatements([first, second]);
  const result = analyzeBankStatements(screened.accepted, { screeningResults: screened.screeningResults });
  assert.equal(result.deduplication?.originalCount, 2);
  assert.equal(result.deduplication?.retainedCount, 1);
  assert.equal(result.deduplication?.removedCount, 1);
  assert.equal(result.deduplication?.candidates?.length, 1);
});

test("Block 1 marks a truncated stored transaction list as non-authoritative", () => {
  const base = analyzeBankStatements([{ text: statementFixture(), fileName: "base.txt" }]);
  const oversized = { ...base, transactions: Array.from({ length: 10_001 }, (_, index) => ({ ...base.transactions[0], id: String(index + 1) })) };
  const stored = analysisForStorage(oversized);
  assert.equal(stored.transactions.length, 10_000);
  assert.equal(stored.transactionsTruncated, true);
  assert.equal(stored.storedTransactionCount, 10_000);
  assert.equal(stored.originalTransactionCount, 10_001);
});
