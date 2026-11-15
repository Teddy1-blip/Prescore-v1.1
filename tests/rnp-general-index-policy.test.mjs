import assert from "node:assert/strict";
import test from "node:test";
import { fact } from "../lib/credit-engine/risk/common.ts";
import { evaluateRiskFacts } from "../lib/credit-engine/risk/engine.ts";

const companyInn = "7701234567";
const asOfDate = "2026-06-30";

function F(code, value, extra = {}) {
  return fact(companyInn, code, "LEGAL", value, {
    period: { from: null, to: null, asOf: asOfDate },
    sourceIds: ["eis:rnp:44:test"],
    sourceTypes: ["EIS"],
    confidence: "HIGH",
    ...extra,
  });
}

test("active RNP record is visible but does not stop or score the general Prescore Index", () => {
  const result = evaluateRiskFacts({
    companyInn,
    asOfDate,
    facts: [
      F("LEGAL_LIFECYCLE", "ACTIVE", { sourceIds: ["fns:test"], sourceTypes: ["FNS"] }),
      F("LEGAL_RNP_CURRENT_RECORD", true, { subjectKey: "44-ФЗ:TEST-001" }),
    ],
  });

  const rnp = result.findings.find(f => f.code === "RISK-LEGAL-RNP-ACTIVE");
  assert.ok(rnp);
  assert.equal(rnp.scope, "INFORMATION");
  assert.equal(rnp.severity, "INFO");
  assert.equal(rnp.decisionImpact, "NON_BLOCKING");
  assert.deepEqual(rnp.reasonCodes, ["CURRENT_RNP_RECORD_REQUIRES_PRODUCT_POLICY_REVIEW"]);
  assert.equal(result.summary.globalStopCount, 0);
  assert.equal(result.summary.globalStopStatus, "NOT_TRIGGERED_WITH_AVAILABLE_DATA");
  assert.equal(result.summary.creditRiskCount, 0);
});

test("RNP does not weaken true lifecycle global stops", () => {
  const result = evaluateRiskFacts({
    companyInn,
    asOfDate,
    facts: [
      F("LEGAL_LIFECYCLE", "BANKRUPTCY_ACTIVE", { sourceIds: ["fns:test"], sourceTypes: ["FNS"] }),
      F("LEGAL_RNP_CURRENT_RECORD", true, { subjectKey: "44-ФЗ:TEST-001" }),
    ],
  });

  const rnp = result.findings.find(f => f.code === "RISK-LEGAL-RNP-ACTIVE");
  const bankruptcy = result.findings.find(f => f.code === "RISK-LEGAL-BANKRUPTCY-ACTIVE");

  assert.ok(rnp);
  assert.equal(rnp.scope, "INFORMATION");
  assert.ok(bankruptcy);
  assert.equal(bankruptcy.scope, "GLOBAL_STOP");
  assert.equal(result.summary.globalStopCount, 1);
  assert.equal(result.summary.globalStopStatus, "TRIGGERED");
});
