import type { RiskFact, RiskShadowInput } from "../../contracts/risk.ts";
import { fact, id, unique, weakest } from "../common.ts";
export function reconciliationFacts({ analysis: a, asOfDate }: RiskShadowInput): RiskFact[] {
  const r = a.reconciliationV1; if (!r || r.companyInn !== a.companyInn) return [];
  const categories = [
    { code: "RECON_IDENTITY_CONFLICTS", rows: r.findings.filter(f => f.outcome === "CONFLICT" && f.nature === "IDENTITY") },
    { code: "RECON_SAME_FACT_CONFLICTS", rows: r.findings.filter(f => f.outcome === "CONFLICT" && f.nature === "SAME_FACT" && [...f.leftFacts, ...f.rightFacts].every(x => ["BFO", "QUARTERLY"].includes(x.sourceType))) },
    { code: "RECON_OTHER_REVIEW", rows: r.findings.filter(f => f.requiresDataReview && !["IDENTITY", "SAME_FACT"].includes(f.nature) && !["AGREES", "WITHIN_TOLERANCE", "RELATIONSHIP_OBSERVED"].includes(f.outcome)) },
  ];
  return categories.map(({ code, rows }) => fact(a.companyInn, code, "RECONCILIATION", rows.length, { sourceTypes: ["RECONCILIATION"], sourceIds: unique(rows.flatMap(f => [...f.leftFacts, ...f.rightFacts].flatMap(x => x.sourceIds))), period: { from: null, to: null, asOf: asOfDate },
    // Preserve the weakest underlying reconciliation evidence; outcome presence cannot promote confidence.
    confidence: rows.length ? weakest(...rows.map(f => f.evidenceConfidence)) : "HIGH", evidence: rows.map(f => ({ evidenceId: id("risk-recon-evidence", f.findingId), sourceId: f.leftFacts[0]?.sourceIds[0] ?? null, sourceType: "RECONCILIATION", metricCode: null, factCode: code, portfolioObligationId: null, reconciliationFindingId: f.findingId, value: f.outcome, unit: "TEXT", periodFrom: null, periodTo: null, asOf: asOfDate, confidence: f.evidenceConfidence, calculationBasis: `${f.nature}/${f.outcome}: ${f.calculationBasis}` })), calculationBasis: "Block 6 canonical outcome presence; disagreement is data review, not borrower misconduct", warnings: unique(rows.flatMap(f => f.reasonCodes)) }));
}
