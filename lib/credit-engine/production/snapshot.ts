import { createHash } from "node:crypto";
import type { CanonicalCreditAnalysisV1 } from "./orchestrator.ts";

import { DECISION_SNAPSHOT_VERSION, type DecisionSnapshotV1, type SnapshotPolicyIdentity } from "../contracts/decision-snapshot.ts";

function policyIdentity({version, policyVersion, policyFingerprint}: SnapshotPolicyIdentity): SnapshotPolicyIdentity {
  return {version, policyVersion, policyFingerprint};
}

// JSON object key order is irrelevant. Array order (including ranked actions) is significant.
function orderedKeys(_key: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]]));
}

export function decisionSnapshot(result: CanonicalCreditAnalysisV1): DecisionSnapshotV1 {
  const bytes = JSON.stringify([DECISION_SNAPSHOT_VERSION, result], orderedKeys);
  const digest = createHash("sha256").update(bytes, "utf8").digest("hex");
  return {
    version: DECISION_SNAPSHOT_VERSION,
    snapshotId: `sha256:${digest}`,
    analysisId: result.analysisId,
    asOfDate: result.asOfDate,
    inputFingerprint: result.inputFingerprint,
    engineVersion: result.version,
    reportVersion: result.model.meta.version,
    sourceVersions: {
      financialAnalysis: result.financialAnalysis?.version ?? null,
      portfolio: result.creditPortfolio.version,
      reconciliation: result.reconciliation.version,
      risk: result.riskAssessment.version,
      riskRegistry: result.riskAssessment.ruleRegistryVersion,
      context: result.contextAssessment.version,
      contextRegistry: result.contextAssessment.ruleRegistryVersion,
    },
    policies: {
      index: policyIdentity(result.prescoreIndex),
      readiness: policyIdentity(result.financingReadiness),
      assessment: policyIdentity(result.creditAssessment),
      capacity: policyIdentity(result.debtCapacity),
      products: policyIdentity(result.productSelection),
      recommendations: policyIdentity(result.recommendationSet),
      actionPlan: policyIdentity(result.actionPlan),
      explainability: policyIdentity(result.explainability),
      report: policyIdentity(result.model.meta),
    },
  };
}
