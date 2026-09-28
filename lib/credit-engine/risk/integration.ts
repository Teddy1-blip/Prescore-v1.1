import type { RiskShadowInput, RiskShadowFields, RiskRule, RiskFact } from "../contracts/risk.ts";
import { adaptRiskFacts } from "./facts.ts";
import { evaluateRiskFacts } from "./engine.ts";
import { compareLegacyRisk } from "./legacy-comparison.ts";
export function buildRiskShadow(input: RiskShadowInput, dependencies: { adapt?: (input: RiskShadowInput) => RiskFact[]; rules?: RiskRule[] } = {}): RiskShadowFields {
  try {
    const facts = (dependencies.adapt ?? adaptRiskFacts)(input);
    const riskAssessmentV1 = evaluateRiskFacts({ companyInn: input.analysis.companyInn, asOfDate: input.asOfDate, facts }, dependencies.rules);
    return { riskAssessmentV1, riskComparison: compareLegacyRisk(input, riskAssessmentV1), riskEngineWarnings: [] };
  } catch { return { riskAssessmentV1: undefined, riskComparison: undefined, riskEngineWarnings: ["RISK_ENGINE_SHADOW_UNAVAILABLE"] }; }
}
