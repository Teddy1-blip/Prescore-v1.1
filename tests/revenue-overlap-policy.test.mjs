import assert from "node:assert/strict";
import test from "node:test";
import { fact } from "../lib/credit-engine/risk/common.ts";
import { evaluateRiskFacts } from "../lib/credit-engine/risk/engine.ts";
import { baseContributions, applyIndexContext } from "../lib/credit-engine/index/contributions.ts";

const companyInn = "7701234567";
const asOfDate = "2026-06-30";

function F(code, domain, value, period, extra = {}) {
  return fact(companyInn, code, domain, value, {
    period,
    sourceIds: [code.startsWith("FIN_") ? "bfo:test" : "bank:test"],
    sourceTypes: [code.startsWith("FIN_") ? "BFO" : "BANK_STATEMENT"],
    ...extra,
  });
}

function revenueRisk(bankPeriod) {
  return evaluateRiskFacts({
    companyInn,
    asOfDate,
    facts: [
      F("FIN_ANNUAL_REVENUE_CHANGE", "FINANCIAL", -20, { from: "2025-01-01", to: "2025-12-31", asOf: "2025-12-31" }),
      F("BANK_OPERATING_TREND", "CASH_FLOW", -20, bankPeriod, { origin: "DERIVED" }),
      F("BANK_COVERAGE_ADEQUATE", "DATA_QUALITY", true, bankPeriod, { unit: "BOOLEAN", origin: "DERIVED" }),
    ],
  });
}

test("same or overlapping revenue decline is one scoreable economic event", () => {
  const risk = revenueRisk({ from: "2025-07-01", to: "2025-12-31", asOf: "2025-12-31" });
  const annual = risk.findings.find(f => f.code === "RISK-FIN-REVENUE-DECLINE");
  const bankEval = risk.evaluations.find(e => e.ruleCode === "RISK-CF-OPERATING-RECEIPTS-DECLINE");

  assert.ok(annual);
  assert.equal(bankEval?.status, "TRIGGERED");
  assert.equal(bankEval?.suppressedBy, annual.findingId);
  assert.equal(risk.findings.some(f => f.code === "RISK-CF-OPERATING-RECEIPTS-DECLINE"), false);
});

test("wholly subsequent bank decline remains an independent persistence signal", () => {
  const risk = revenueRisk({ from: "2026-01-01", to: "2026-06-30", asOf: "2026-06-30" });
  assert.ok(risk.findings.some(f => f.code === "RISK-FIN-REVENUE-DECLINE"));
  assert.ok(risk.findings.some(f => f.code === "RISK-CF-OPERATING-RECEIPTS-DECLINE"));
  assert.equal(risk.evaluations.find(e => e.ruleCode === "RISK-CF-OPERATING-RECEIPTS-DECLINE")?.suppressedBy, undefined);
});

test("corroboration does not add a third numeric penalty when its source fact is already scored", () => {
  const risk = revenueRisk({ from: "2026-01-01", to: "2026-06-30", asOf: "2026-06-30" });
  const annualFinding = risk.findings.find(f => f.code === "RISK-FIN-REVENUE-DECLINE");
  const bankFinding = risk.findings.find(f => f.code === "RISK-CF-OPERATING-RECEIPTS-DECLINE");
  const annualFact = risk.facts.find(f => f.semanticCode === "FIN_ANNUAL_REVENUE_CHANGE");
  const bankFact = risk.facts.find(f => f.semanticCode === "BANK_OPERATING_TREND");
  assert.ok(annualFinding && bankFinding && annualFact && bankFact);

  const evidence = (id) => [{ evidenceId: id + ":e", sourceId: "test", sourceType: "TEST", sourceClass: "CANONICAL_OBSERVED", metricCode: null, factCode: id, portfolioObligationId: null, reconciliationFindingId: null, value: 1, unit: "PERCENT", periodFrom: null, periodTo: null, asOf: asOfDate, confidence: "HIGH", calculationBasis: "test" }];
  const contextFacts = [
    { factId: "ctx:annual", semanticCode: "FIN_ANNUAL_REVENUE_CHANGE", domain: "WORKING_CAPITAL", companyInn, value: -20, unit: "PERCENT", status: "KNOWN", confidence: "HIGH", sourceClass: "CANONICAL_OBSERVED", period: annualFact.period, sourceIds: ["bfo:test"], sourceMetricCodes: [], sourceRiskFactIds: [annualFact.factId], portfolioObligationIds: [], reconciliationFindingIds: [], evidence: evidence("annual"), calculationBasis: "test", warnings: [] },
    { factId: "ctx:bank", semanticCode: "BANK_OPERATING_TREND", domain: "CASH_FLOW", companyInn, value: -20, unit: "PERCENT", status: "KNOWN", confidence: "HIGH", sourceClass: "CANONICAL_OBSERVED", period: bankFact.period, sourceIds: ["bank:test"], sourceMetricCodes: [], sourceRiskFactIds: [bankFact.factId], portfolioObligationIds: [], reconciliationFindingIds: [], evidence: evidence("bank"), calculationBasis: "test", warnings: [] },
  ];
  const relation = { relationId: "ctx:revenue", code: "CTX-REVENUE-CORROBORATION", ruleVersion: "test", domain: "WORKING_CAPITAL", effect: "CORROBORATES", targetRiskFindingIds: [annualFinding.findingId], targetRiskCodes: [annualFinding.code], contextFactIds: contextFacts.map(f => f.factId), evidenceConfidence: "HIGH", reasonCodes: ["TEST"], calculationBasis: "test", warnings: [] };
  const input = { riskAssessment: risk, contextAssessment: { facts: contextFacts, relations: [relation] }, asOfDate };
  const base = baseContributions(input);
  const adjusted = applyIndexContext(base, input);
  const annualContribution = adjusted.find(c => c.riskFindingId === annualFinding.findingId);

  assert.ok(annualContribution);
  assert.equal(annualContribution.contextModifierPercent, 0);
  assert.equal(annualContribution.finalPenaltyPoints, annualContribution.basePenaltyPoints);
  assert.ok(annualContribution.warnings.includes("CORROBORATION_ALREADY_SCORED_AS_INDEPENDENT_RISK"));
});
