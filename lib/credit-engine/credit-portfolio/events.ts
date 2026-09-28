import type { PortfolioEvent, PortfolioEvidenceRef, PortfolioConfidence } from "../contracts/credit-portfolio.ts";
import { evidence, id, unique } from "./common.ts";
export function event(obligationId: string | null, type: PortfolioEvent["type"], date: string | null, refs: PortfolioEvidenceRef[], code: string = type, confidence: PortfolioConfidence = "HIGH", effectiveDate: string | null = null): PortfolioEvent {
  const e = evidence(refs);
  return { eventId: id("portfolio-event", obligationId, type, date, effectiveDate, code, e.map(r => r.evidenceId)), obligationId, type, eventDate: date, effectiveDate,
    descriptionCode: code, sourceIds: unique(e.flatMap(r => r.sourceId ? [r.sourceId] : [])), evidence: e, confidence, warnings: [] };
}
