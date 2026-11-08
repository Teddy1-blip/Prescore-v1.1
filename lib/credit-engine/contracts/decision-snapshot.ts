export const DECISION_SNAPSHOT_VERSION = "PRESCORE-DECISION-SNAPSHOT-1" as const;

export type SnapshotPolicyIdentity = {
  version: string;
  policyVersion: string;
  policyFingerprint: string;
};

export type DecisionSnapshotV1 = {
  version: typeof DECISION_SNAPSHOT_VERSION;
  snapshotId: string;
  analysisId: string;
  asOfDate: string;
  inputFingerprint: string;
  engineVersion: string;
  reportVersion: string;
  sourceVersions: {
    financialAnalysis: string | null;
    portfolio: string;
    reconciliation: string;
    risk: string;
    riskRegistry: string;
    context: string;
    contextRegistry: string;
  };
  policies: Record<"index" | "readiness" | "assessment" | "capacity" | "products" |
    "recommendations" | "actionPlan" | "explainability" | "report", SnapshotPolicyIdentity>;
};
