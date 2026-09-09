import type { RiskComparisonSummary, RiskShadowInput, RiskAssessmentV1 } from "../contracts/risk.ts";
import { RISK_ENGINE_VERSION } from "../contracts/risk.ts";
export function compareLegacyRisk(input: RiskShadowInput, risk: RiskAssessmentV1): RiskComparisonSummary {
  return { version: RISK_ENGINE_VERSION, legacyFactorCount: input.analysis.factors?.length ?? 0, legacyProfileSignalCount: input.companyProfile?.signals?.length ?? 0, riskFindingCount: risk.findings.length,
    comparisons: [
      { legacyConcept: "Existing factor and stop terminology", riskConcept: "Lender-agnostic scope separation", reasonCodes: ["BANK_POLICY_EXCLUDED", "DATA_QUALITY_SEPARATED"] },
      { legacyConcept: "Legacy financial aggregates", riskConcept: "Known canonical financial facts and reported/proxy distinction", reasonCodes: ["MISSING_NOT_ZERO", "NEGATIVE_EQUITY_NOT_GLOBAL_STOP"] },
      { legacyConcept: "Legacy bureau aggregates", riskConcept: "Company subject and obligation-specific evidence", reasonCodes: ["BKI_SCOPE_REFINED", "GUARANTEES_SEPARATE_FROM_FUNDED_DEBT"] },
      { legacyConcept: "Legacy combined insights", riskConcept: "Canonical reconciliation and portfolio data review", reasonCodes: ["RECONCILIATION_CONFLICT_IS_DATA_REVIEW", "PORTFOLIO_CURRENT_FACTS_SEPARATE"] },
    ] };
}
