import assert from "node:assert/strict";
import test from "node:test";

import { analyzeBankStatement } from "../lib/prescore.ts";
import { block2StatementFixture } from "./fixtures/block2-statements.mjs";

function authoritativeProjection(result) {
  return {
    score: result.score,
    grade: result.grade,
    readiness: result.readiness,
    metrics: result.metrics,
    monthly: result.monthly,
    topCounterparties: result.topCounterparties,
    factors: result.factors.map((item) => [item.code, item.severity, item.title]),
    productFits: result.productFits.map((item) => [item.product, item.status, item.amountMin, item.amountMax]),
    recommendations: result.recommendations.map((item) => [item.product, item.priority, item.title]),
    categories: result.transactions.map((item) => item.category),
  };
}

test("Block 3 runs in shadow mode without changing the Block 2 authoritative result", () => {
  const result = analyzeBankStatement(block2StatementFixture(), "block3.txt");
  const repeated = analyzeBankStatement(block2StatementFixture(), "block3-repeat.txt");
  assert.deepEqual(authoritativeProjection(repeated), authoritativeProjection(result));
  assert.equal(result.score, 872);
  assert.equal(result.grade, "A");
  assert.equal(result.readiness, "Высокая готовность");
  assert.equal(result.metrics.estimatedLimitMin, 1_283_000);
  assert.equal(result.metrics.estimatedLimitMax, 2_636_000);
  assert.equal(result.classification?.version, "PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW");
  assert.equal(result.classification?.total, 44);
  assert.ok(result.transactions.every((item) => item.classification?.ruleCode));
  assert.ok(result.transactions.every((item) => item.category && item.classification?.primaryCategory));
});

test("Block 3 exposes only a capped, aggregate legacy comparison report", () => {
  const result = analyzeBankStatement(block2StatementFixture(), "block3-diff.txt");
  assert.ok((result.classification?.materialDiffs?.length ?? 0) <= 25);
  assert.equal(result.classification?.legacyDiffCount, result.transactions.filter((item) => item.classification?.legacyDiff).length);
  assert.equal(result.classification?.reviewRequiredCount, result.transactions.filter((item) => item.classification?.requiresReview).length);
});
