import assert from "node:assert/strict";
import test from "node:test";
import { fact } from "../lib/credit-engine/risk/common.ts";
import { evaluateRiskFacts } from "../lib/credit-engine/risk/engine.ts";

const companyInn = "7701234567";
const asOfDate = "2026-06-30";

function financialFact(code, value, extra = {}) {
  return fact(companyInn, code, "FINANCIAL", value, {
    period: { from: null, to: null, asOf: asOfDate },
    sourceIds: ["bfo:test"],
    sourceTypes: ["BFO"],
    ...extra,
  });
}

function evaluate(facts) {
  return evaluateRiskFacts({ companyInn, asOfDate, facts });
}

test("negative equity suppresses overlapping negative net-assets proxy", () => {
  const result = evaluate([
    financialFact("FIN_EQUITY", -100),
    financialFact("FIN_NET_ASSETS_PROXY", -100, { origin: "PROXY" }),
  ]);

  const equity = result.findings.find(f => f.code === "RISK-FIN-EQUITY-NON-POSITIVE");
  const proxyEvaluation = result.evaluations.find(e => e.ruleCode === "RISK-FIN-NET-ASSETS-PROXY-NEGATIVE");

  assert.ok(equity);
  assert.equal(equity.severity, "CRITICAL");
  assert.equal(proxyEvaluation?.status, "TRIGGERED");
  assert.equal(proxyEvaluation?.suppressedBy, equity.findingId);
  assert.equal(result.findings.some(f => f.code === "RISK-FIN-NET-ASSETS-PROXY-NEGATIVE"), false);
  assert.equal(result.findings.filter(f => f.scope === "CREDIT_RISK" && f.domain === "FINANCIAL").length, 1);
});

test("zero equity also suppresses overlapping negative net-assets proxy", () => {
  const result = evaluate([
    financialFact("FIN_EQUITY", 0),
    financialFact("FIN_NET_ASSETS_PROXY", -100, { origin: "PROXY" }),
  ]);

  const equity = result.findings.find(f => f.code === "RISK-FIN-EQUITY-NON-POSITIVE");
  const proxyEvaluation = result.evaluations.find(e => e.ruleCode === "RISK-FIN-NET-ASSETS-PROXY-NEGATIVE");

  assert.ok(equity);
  assert.equal(equity.severity, "HIGH");
  assert.equal(proxyEvaluation?.status, "TRIGGERED");
  assert.equal(proxyEvaluation?.suppressedBy, equity.findingId);
  assert.equal(result.findings.some(f => f.code === "RISK-FIN-NET-ASSETS-PROXY-NEGATIVE"), false);
});

test("negative net-assets proxy remains a finding when no adverse equity finding exists", () => {
  const result = evaluate([
    financialFact("FIN_EQUITY", 100),
    financialFact("FIN_NET_ASSETS_PROXY", -100, { origin: "PROXY" }),
  ]);

  const proxy = result.findings.find(f => f.code === "RISK-FIN-NET-ASSETS-PROXY-NEGATIVE");
  const proxyEvaluation = result.evaluations.find(e => e.ruleCode === "RISK-FIN-NET-ASSETS-PROXY-NEGATIVE");

  assert.ok(proxy);
  assert.equal(proxy.severity, "HIGH");
  assert.equal(proxyEvaluation?.suppressedBy, undefined);
});
