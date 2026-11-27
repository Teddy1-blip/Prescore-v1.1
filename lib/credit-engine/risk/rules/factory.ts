import type { RiskRule, RiskRuleEvaluationResult, RiskDataset, RiskFact, RiskSeverity } from "../../contracts/risk.ts";
import { RISK_REGISTRY_VERSION } from "../../contracts/risk.ts";
import { get, usable, missing, result } from "../common.ts";
export type RuleSpec = Omit<RiskRule, "version" | "evaluate" | "thresholds"> & { thresholds?: RiskRule["thresholds"] };
export const rule = (spec: RuleSpec, evaluate: RiskRule["evaluate"]): RiskRule => ({ ...spec, version: RISK_REGISTRY_VERSION, thresholds: spec.thresholds ?? [], evaluate });
export function numeric(spec: RuleSpec, bands: (n: number, d: RiskDataset, facts: RiskFact[]) => { severity: RiskSeverity; reason: string; threshold?: RiskRuleEvaluationResult["threshold"]; scope?: RiskRuleEvaluationResult["scope"] } | null): RiskRule {
  return rule(spec, d => { const facts = spec.requiredFactCodes.map(c => get(d, c)); const scoped=facts[0]?.warnings.includes('FULL_MONTH_WINDOW')===true;
    if (facts.some(f => !usable(f) || f.semanticCode === "BANK_COVERAGE_ADEQUATE" && f.value !== true&&!scoped)) return missing(facts);
    if (typeof facts[0]!.value !== "number") return missing(facts, ["UNIT_OR_VALUE_NOT_SUPPORTED"]);
    const b = bands(facts[0]!.value, d, facts as RiskFact[]);
    return b ? { ...result("TRIGGERED", facts, [b.reason]), severity: b.severity, scope: b.scope, threshold: b.threshold, actualValue: facts[0]!.value } : result("NOT_TRIGGERED", facts); });
}
