import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { classifyEconomicTransaction, summarizeClassifications } from "../lib/credit-engine/classification/classifier.ts";
import { CLASSIFICATION_RULE_REGISTRY, validateClassificationRegistry } from "../lib/credit-engine/classification/registry.ts";
import { ECONOMIC_CLASSIFICATION_VERSION } from "../lib/credit-engine/contracts/classification.ts";
import { normalizeTransaction } from "../lib/credit-engine/normalization/transaction-normalizer.ts";
import { classificationCases, contractVariations, saleVariations } from "./fixtures/block3-classification-cases.mjs";

const COMPANY_INN = "7700000000";
const COMPANY_ACCOUNT = "40702810900000000001";
const EXTERNAL_ACCOUNT = "40702810500000000002";

function transactionFromCase(item, ordinal = 1) {
  const incoming = item.direction === "IN";
  const outgoing = item.direction === "OUT";
  const individualInn = item.individual ? "500000000001" : "7812345678";
  const counterpartyName = item.counterparty ?? (item.individual ? "Физическое лицо" : "ООО Контрагент");
  const tx = normalizeTransaction({
    bankDocumentId: `doc-${ordinal}`,
    date: "2026-08-11",
    amount: item.amount ?? 1_000_000,
    currency: "RUB",
    payerName: outgoing ? "ООО Тест" : counterpartyName,
    payerInn: outgoing ? COMPANY_INN : individualInn,
    payerAccount: outgoing ? COMPANY_ACCOUNT : EXTERNAL_ACCOUNT,
    recipientName: incoming ? "ООО Тест" : counterpartyName,
    recipientInn: incoming ? COMPANY_INN : individualInn,
    recipientAccount: incoming ? COMPANY_ACCOUNT : EXTERNAL_ACCOUNT,
    purpose: item.purpose,
    statementAccount: item.direction === "UNKNOWN" ? null : COMPANY_ACCOUNT,
    companyInn: item.direction === "UNKNOWN" ? null : COMPANY_INN,
    companyAccounts: item.direction === "UNKNOWN" ? [] : [COMPANY_ACCOUNT],
    bank: "Тестовый банк",
    sourceId: "classification-tests",
    sourceFileId: "classification-tests-file",
    sourceFileName: "classification-tests.txt",
    sourceRow: ordinal,
    rawReference: `classification-tests.txt:${ordinal}`,
    parserVersion: "TEST-PARSER-1",
    ordinal,
  });
  if (item.own) {
    tx.isOwnAccountTransfer = true;
    tx.ownAccountTransferEvidence = ["TEST_CONFIRMED_OWN_ACCOUNT"];
  }
  if (item.pair) {
    tx.transferPairId = `pair-${ordinal}`;
    tx.transferPairConfidence = "HIGH";
  }
  if (item.reversal) tx.possibleReversalOfTransactionId = `tx-reversed-${ordinal}`;
  if (item.related) tx.relatedPartyStatus = "RELATED";
  return tx;
}

test("classification registry is stable, versioned and free of duplicate codes", () => {
  const validation = validateClassificationRegistry();
  assert.equal(validation.count, CLASSIFICATION_RULE_REGISTRY.length);
  assert.ok(validation.count >= 40);
  assert.equal(validation.codes.size, validation.count);
  assert.ok(CLASSIFICATION_RULE_REGISTRY.every((rule) => rule.version === "1.0.0"));
});

for (const [index, item] of classificationCases.entries()) {
  test(`${item.case_id}: ${item.expected_category}`, () => {
    const tx = transactionFromCase(item, index + 1);
    assert.equal(tx.direction, item.direction);
    const result = classifyEconomicTransaction(tx, { legacyCategory: "other", materialityThreshold: 1_000_000 });
    assert.equal(result.version, ECONOMIC_CLASSIFICATION_VERSION);
    assert.equal(result.primaryCategory, item.expected_category);
    assert.equal(result.confidence, item.expected_confidence);
    assert.match(result.ruleCode ?? "", /^TXC-[A-Z0-9-]+-\d{3}$/);
    assert.ok(result.evidence.some((entry) => entry.code === item.evidence), `missing evidence ${item.evidence}`);
    if (item.review_required !== undefined) assert.equal(result.requiresReview, item.review_required);
    for (const tag of item.tags ?? []) assert.ok(result.tags.includes(tag), `missing tag ${tag}`);
    for (const category of item.alternatives ?? []) assert.ok(result.alternatives.some((entry) => entry.category === category), `missing alternative ${category}`);
    for (const category of item.forbidden ?? []) assert.notEqual(result.primaryCategory, category);
    if (item.components) assert.deepEqual(result.components?.map((entry) => entry.amount), item.components);
  });
}

test("sale wording variations stay in one economic category", () => {
  for (const [index, purpose] of saleVariations.entries()) {
    const result = classifyEconomicTransaction(transactionFromCase({ direction: "IN", purpose }, 100 + index));
    assert.equal(result.primaryCategory, "SALE_PROCEEDS", purpose);
    assert.equal(result.confidence, "HIGH", purpose);
  }
});

test("generic contract phrases are separated by economic evidence and direction", () => {
  const categories = contractVariations.map((item, index) => {
    const result = classifyEconomicTransaction(transactionFromCase(item, 200 + index));
    assert.equal(result.primaryCategory, item.expected_category, item.purpose);
    return result.primaryCategory;
  });
  assert.equal(new Set(categories).size, contractVariations.length);
});

test("legacy comparison is observable but does not replace the economic result", () => {
  const tx = transactionFromCase({ direction: "IN", purpose: "Финансирование по договору факторинга" }, 300);
  const result = classifyEconomicTransaction(tx, { legacyCategory: "revenue" });
  assert.equal(result.primaryCategory, "FACTORING_PROCEEDS");
  assert.equal(result.legacyCategory, "revenue");
  assert.equal(result.legacyDiff, true);
});

test("unknown direction remains a valid, explainable result for generic wording", () => {
  const tx = transactionFromCase({ direction: "UNKNOWN", purpose: "Оплата по договору" }, 350);
  const result = classifyEconomicTransaction(tx);
  assert.equal(result.primaryCategory, "UNKNOWN_DIRECTION");
  assert.equal(result.confidence, "UNKNOWN");
  assert.equal(result.requiresReview, true);
  assert.equal(result.ruleCode, "TXC-DIRECTION-UNKNOWN-CONTRACT-001");
});

test("adversarial wording preserves the conflict and negative evidence", () => {
  const tx = transactionFromCase({ direction: "IN", purpose: "Возврат займа по договору поставки" }, 360);
  const result = classifyEconomicTransaction(tx);
  const saleAlternative = result.alternatives.find((item) => item.category === "SALE_PROCEEDS");
  assert.equal(result.primaryCategory, "LOAN_REPAYMENT_RECEIVED");
  assert.equal(result.confidence, "MEDIUM");
  assert.ok(result.ambiguityReasons.includes("CONFLICTING_CANDIDATE:SALE_PROCEEDS"));
  assert.ok(saleAlternative?.negativeEvidence.some((entry) => entry.code === "NEGATIVE_NON_OPERATING_CONTEXT"));
});

test("classification summary is deterministic and caps transaction-level diffs", () => {
  const items = Array.from({ length: 30 }, (_, index) => {
    const transaction = transactionFromCase({ direction: "IN", purpose: "Финансирование по договору факторинга", amount: 1_000_000 + index }, 400 + index);
    return { transaction, classification: classifyEconomicTransaction(transaction, { legacyCategory: "revenue" }) };
  });
  const summary = summarizeClassifications(items, 25);
  assert.equal(summary.total, 30);
  assert.equal(summary.legacyDiffCount, 30);
  assert.equal(summary.materialDiffs?.length, 25);
  assert.equal(summary.diffsTruncated, true);
  assert.ok(summary.warnings.includes("LEGACY_DIFFS_TRUNCATED:5"));
  assert.equal(summary.categoryCounts.FACTORING_PROCEEDS, 30);
});

test("10,000 deterministic classifications complete within the performance guardrail", () => {
  const inputs = Array.from({ length: 10_000 }, (_, index) => transactionFromCase(classificationCases[index % classificationCases.length], 1_000 + index));
  const started = performance.now();
  const results = inputs.map((tx) => classifyEconomicTransaction(tx, { legacyCategory: "other" }));
  const elapsed = performance.now() - started;
  assert.equal(results.length, 10_000);
  assert.ok(results.every((item) => item.ruleCode && item.evidence.length >= 2));
  assert.ok(elapsed < 5_000, `10,000 classifications took ${elapsed.toFixed(1)} ms`);
});
