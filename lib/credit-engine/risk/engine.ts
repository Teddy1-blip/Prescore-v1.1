import { RISK_ENGINE_VERSION, RISK_REGISTRY_VERSION, type RiskAssessmentV1, type RiskAssessmentSummary, type RiskDataset, type RiskFact, type RiskFinding, type RiskRule, type RiskRuleEvaluation } from "../contracts/risk.ts";
import { RISK_RULE_REGISTRY } from "./rules/registry.ts";
import { id, stable, validDate, finite, weakest, unique, FACT_UNITS } from "./common.ts";
const scopes = ["GLOBAL_STOP", "CREDIT_RISK", "DATA_REVIEW", "INFORMATION"];
const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
export function evaluateRiskFacts(input: { companyInn: string; asOfDate: string; facts: RiskFact[] }, rules: RiskRule[] = RISK_RULE_REGISTRY): RiskAssessmentV1 {
  if (!/^\d{10}(?:\d{2})?$/.test(input.companyInn) || !validDate(input.asOfDate)) throw Error("INVALID_RISK_SUBJECT_OR_DATE");
  const seen = new Map<string, RiskFact>();
  for (const f of input.facts) {
    if (f.companyInn !== input.companyInn || typeof f.value === "number" && !finite(f.value)) throw Error("INVALID_RISK_FACT");
    if (seen.has(f.factId) && stable(seen.get(f.factId)) !== stable(f)) throw Error("RISK_FACT_ID_CONFLICT");
    seen.set(f.factId, f);
  }
  const facts = [...seen.values()].map(f => {
    const future = [f.period.from, f.period.to, f.period.asOf].some(d => d && (!validDate(d) || d > input.asOfDate));
    return future ? { ...f, status: "UNKNOWN" as const, value: null, confidence: "UNKNOWN" as const, warnings: [...f.warnings, "FUTURE_OR_INVALID_PERIOD"] } : { ...f, confidence: weakest(f.confidence, ...f.evidence.map(e => e.confidence)), ...((FACT_UNITS[f.semanticCode] && FACT_UNITS[f.semanticCode] !== f.unit || f.value !== null && (f.unit === "BOOLEAN" ? typeof f.value !== "boolean" : f.unit === "TEXT" ? typeof f.value !== "string" : typeof f.value !== "number" || ["COUNT", "DAYS", "MONTHS"].includes(f.unit) && (!Number.isInteger(f.value) || f.value < 0))) ? { status: "UNKNOWN" as const, value: null, warnings: [...f.warnings, "INCOMPATIBLE_FACT_UNIT"] } : {}) };
  }).sort((a, b) => a.factId.localeCompare(b.factId));
  const byCode = new Map<string, RiskFact[]>(); for (const f of facts) byCode.set(f.semanticCode, [...(byCode.get(f.semanticCode) ?? []), f]);
  const dataset: RiskDataset = { ...input, facts, byCode }, evaluations: RiskRuleEvaluation[] = [], findings: RiskFinding[] = [];
  if (new Set(rules.map(r => r.code)).size !== rules.length) throw Error("DUPLICATE_RISK_RULE");
  for (const r of rules) {
    const groups: Array<string | undefined> = r.perObligation ? unique(facts.filter(f => r.requiredFactCodes.includes(f.semanticCode)).flatMap(f => (f.portfolioObligationId ?? f.subjectKey) ? [f.portfolioObligationId ?? f.subjectKey!] : [])) : [undefined];
    if (!groups.length) groups.push(undefined);
    for (const obligationId of groups) {
      const out = r.evaluate({ ...dataset, obligationId });
      const scope = out.scope ?? r.scope, findingId = out.status === "TRIGGERED" ? id("risk-finding", r.code, r.version, input.companyInn, input.asOfDate, obligationId, out.facts.map(f => f.factId).sort()) : null;
      if (out.status === "TRIGGERED" && scope === "GLOBAL_STOP" && (r.scope !== "GLOBAL_STOP" || out.facts.some(f => f.confidence !== "HIGH" || f.status !== "KNOWN"))) throw Error("INVALID_GLOBAL_STOP_EVIDENCE");
      evaluations.push({ ruleCode: r.code, ruleVersion: r.version, domain: r.domain, scope, status: out.status, calibrationClass: r.calibrationClass, findingId,
        requiredFactCodes: r.requiredFactCodes, reasonCodes: out.reasonCodes, warnings: out.warnings ?? [], portfolioObligationId: out.facts.find(f => f.portfolioObligationId)?.portfolioObligationId, subjectKey: obligationId });
      if (!findingId) continue;
      const evidence = [...new Map(out.facts.flatMap(f => f.evidence).map(e => [e.evidenceId, e])).values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
      findings.push({ findingId, code: r.code, ruleVersion: r.version, domain: r.domain, scope, severity: out.severity ?? "INFO", decisionImpact: scope === "GLOBAL_STOP" ? "BLOCKING" : scope === "INFORMATION" ? "NON_BLOCKING" : "REVIEW",
        calibrationClass: r.calibrationClass, evidenceConfidence: weakest(...out.facts.map(f => f.confidence), ...evidence.map(e => e.confidence)), requiresDataReview: scope === "DATA_REVIEW" || scope === "CREDIT_RISK",
        actualValue: out.actualValue ?? out.facts[0]?.value ?? null, unit: out.unit ?? out.facts[0]?.unit ?? null, threshold: out.threshold, reasonCodes: unique([...out.reasonCodes, ...(r.calibrationClass === "PRE_CREDIT_LAB" ? ["PRE_CREDIT_LAB_THRESHOLD"] : [])]),
        factIds: out.facts.map(f => f.factId).sort(), evidence, calculationBasis: `${r.code}: ${out.facts.map(f => f.calculationBasis).join("; ")}`, warnings: unique([...(out.warnings ?? []), ...out.facts.flatMap(f => f.warnings)]), portfolioObligationId: out.facts.find(f => f.portfolioObligationId)?.portfolioObligationId, subjectKey: obligationId, origin: out.facts.some(f => f.origin === "PROXY") ? "PROXY" : out.facts.some(f => f.origin === "DERIVED") ? "DERIVED" : "REPORTED" });
    }
  }
  const suppressed = new Map<string, string>();
  for (const f of findings) {
    const stronger = f.code === "RISK-FIN-NET-LOSS-CURRENT" ? findings.find(x => x.code === "RISK-FIN-NET-LOSS-REPEATED") : f.code === "RISK-BKI-HISTORICAL-DELINQUENCY" ? findings.find(x => x.code === "RISK-BKI-CURRENT-OVERDUE" && (x.portfolioObligationId ?? x.subjectKey) === (f.portfolioObligationId ?? f.subjectKey) && severities.indexOf(x.severity) <= severities.indexOf(f.severity)) : undefined;
    if (stronger) suppressed.set(f.findingId, stronger.findingId);
  }
  for (const e of evaluations) if (e.findingId && suppressed.has(e.findingId)) e.suppressedBy = suppressed.get(e.findingId);
  const presented = findings.filter(f => !suppressed.has(f.findingId)).sort((a, b) => scopes.indexOf(a.scope) - scopes.indexOf(b.scope) || severities.indexOf(a.severity) - severities.indexOf(b.severity) || a.code.localeCompare(b.code) || a.findingId.localeCompare(b.findingId));
  evaluations.sort((a, b) => a.ruleCode.localeCompare(b.ruleCode) || (a.portfolioObligationId ?? a.subjectKey ?? "").localeCompare(b.portfolioObligationId ?? b.subjectKey ?? ""));
  return { version: RISK_ENGINE_VERSION, ruleRegistryVersion: RISK_REGISTRY_VERSION, mode: "SHADOW", companyInn: input.companyInn, asOfDate: input.asOfDate, facts, evaluations, findings: presented,
    summary: summarizeRiskAssessment(facts, evaluations, presented), warnings: ["SHADOW_ONLY"] };
}
export function summarizeRiskAssessment(facts: RiskFact[], evaluations: RiskRuleEvaluation[], presented: RiskFinding[]): RiskAssessmentSummary {
  const count = (scope: string) => presented.filter(f => f.scope === scope).length, severityCount = (s: string) => presented.filter(f => f.severity === s).length;
  const stops = evaluations.filter(e => e.scope === "GLOBAL_STOP"), credit = presented.filter(f => f.scope === "CREDIT_RISK"), creditEvaluations = evaluations.filter(e => e.scope === "CREDIT_RISK");
  return { evaluatedRuleCount: evaluations.length, triggeredFindingCount: presented.length, globalStopCount: count("GLOBAL_STOP"), creditRiskCount: count("CREDIT_RISK"), dataReviewCount: count("DATA_REVIEW"), informationCount: count("INFORMATION"), criticalCount: severityCount("CRITICAL"), highCount: severityCount("HIGH"), mediumCount: severityCount("MEDIUM"), lowCount: severityCount("LOW"),
      globalStopStatus: count("GLOBAL_STOP") ? "TRIGGERED" : !stops.length || stops.some(e => e.status === "INSUFFICIENT_DATA" || e.status === "NOT_APPLICABLE") ? "INSUFFICIENT_DATA" : "NOT_TRIGGERED_WITH_AVAILABLE_DATA",
      highestCreditRiskSeverity: credit[0]?.severity ?? (!creditEvaluations.length || creditEvaluations.some(e => e.status === "INSUFFICIENT_DATA") ? "UNKNOWN" : "NONE"), dataReviewRequired: presented.some(f => f.requiresDataReview), sourceFamilyCount: unique(facts.flatMap(f => f.sourceTypes)).length,
      evidenceConfidence: weakest(...facts.filter(f => f.status !== "NOT_APPLICABLE").map(f => f.confidence)), warnings: ["SHADOW_ONLY", "PRE_CREDIT_LAB_THRESHOLDS"] };
}
