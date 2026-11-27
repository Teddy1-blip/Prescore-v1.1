import type { RiskFact, ProfileRiskInput } from "../../contracts/risk.ts";
import { fact, freshness, RISK_SOURCE_FRESHNESS_DAYS as age, id, unique } from "../common.ts";
export function portfolioFacts({ analysis: a, asOfDate }: ProfileRiskInput): RiskFact[] {
  const p = a.creditPortfolioV1; if (!p || p.companyInn !== a.companyInn) return [];
  const current = p.asOfDate === asOfDate;
  const active = p.obligations.filter(o => o.status.value !== "CLOSED"), funded = active.filter(o => ["FUNDED_DEBT", "CREDIT_LIMIT"].includes(o.exposureClass));
  const pairs: Array<[string, number | null]> = [
    ["PORTFOLIO_UNRESOLVED", p.obligationMatches.filter(m => ["AMBIGUOUS", "POSSIBLE_MATCH"].includes(m.outcome)).length || Number(p.summary.warnings.includes("UNRESOLVED_OBLIGATION_OBSERVATIONS"))],
    ["PORTFOLIO_UNKNOWN_FUNDED", funded.filter(o => o.currentPosition.principalOutstanding.knowledge !== "KNOWN" || o.currentPosition.principalOutstanding.verification === "CONFLICTED").length],
    ["PORTFOLIO_CONFLICTS", active.filter(o => [...Object.values(o.currentPosition), o.status, o.currentTerms.annualRate, o.currentTerms.creditLimit].some(v => v.verification === "CONFLICTED")).length + p.events.filter(e => e.type === "DATA_CONFLICT" && e.eventDate === p.asOfDate && !e.obligationId).length],
    ["PORTFOLIO_NEW", p.events.filter(e => e.type === "NEW_OBLIGATION_DETECTED" && freshness(e.eventDate, asOfDate, age.newObligation)).length],
    ["PORTFOLIO_UNMATCHED", p.warnings.includes("PAYMENT_OBSERVATIONS_UNAVAILABLE") ? null : p.unmatchedPaymentObservationIds.length], ["PORTFOLIO_UNSPLIT", p.warnings.includes("PAYMENT_OBSERVATIONS_UNAVAILABLE") ? null : p.paymentObservations.filter(x => x.paymentKind === "UNSPLIT_DEBT_SERVICE").length],
  ];
  const out = pairs.map(([code, n]) => fact(a.companyInn, code, "CREDIT_PORTFOLIO", current ? n : null, { period: { from: null, to: null, asOf: p.asOfDate }, sourceIds: unique(p.obligations.flatMap(o => o.sourceIds)), sourceTypes: ["CREDIT_PORTFOLIO"],
    evidence: [{ evidenceId: id("risk-portfolio-state", p.portfolioId, p.asOfDate, code, n), sourceId: p.portfolioId, sourceType: "CREDIT_PORTFOLIO", metricCode: null, factCode: code, portfolioObligationId: null, reconciliationFindingId: null, value: current ? n : null, unit: "COUNT", periodFrom: null, periodTo: null, asOf: p.asOfDate, confidence: "HIGH", calculationBasis: `Canonical ${code} count; observation of data state, not confirmation of uncertain amounts`, rawReference: `${p.portfolioId}/${code}` }],
    calculationBasis: "Canonical portfolio data-state count; unknown exposure is not zero debt; no identity or payment re-matching", warnings: current ? [] : ["PORTFOLIO_ASOF_NOT_CURRENT"] }));
  for (const o of active) {
    for (const [code, v, unit] of [["PORTFOLIO_FUNDED_PRINCIPAL", o.currentPosition.principalOutstanding, "RUB"], ["PORTFOLIO_CONTINGENT_AMOUNT", o.currentPosition.contingentExposure, "RUB"], ["PORTFOLIO_AVAILABLE_LIMIT", o.currentPosition.availableLimit, "RUB"], ["PORTFOLIO_ANNUAL_RATE", o.currentTerms.annualRate, "PERCENT"]] as const) {
      if (code === "PORTFOLIO_FUNDED_PRINCIPAL" && !["FUNDED_DEBT", "CREDIT_LIMIT"].includes(o.exposureClass)) continue;
      out.push(fact(a.companyInn, code, "CREDIT_PORTFOLIO", v.value, { unit, status: current && v.knowledge === "KNOWN" && v.verification !== "CONFLICTED" ? "KNOWN" : "UNKNOWN", confidence: v.confidence, origin: v.origin === "ESTIMATED" ? "PROXY" : v.origin, portfolioObligationId: o.obligationId, sourceTypes: ["CREDIT_PORTFOLIO"], sourceIds: unique(v.evidence.flatMap(e => e.sourceId ? [e.sourceId] : [])), evidence: v.evidence.map(e => ({ evidenceId: id("risk-portfolio-value", e.evidenceId, code), sourceId: e.sourceId, sourceType: e.sourceKind, metricCode: null, factCode: code, portfolioObligationId: o.obligationId, reconciliationFindingId: null, value: e.rawValue ?? null, unit, periodFrom: v.effectiveFrom, periodTo: v.effectiveTo, asOf: e.observedAt, confidence: v.confidence, calculationBasis: e.description, rawReference: e.rawReference })), period: { from: null, to: null, asOf: p.asOfDate }, calculationBasis: `Canonical ${o.type}/${o.exposureClass} ${code}; factual input only`, warnings: v.warnings }));
    }
  }
  return out;
}
