import type { CanonicalCreditHistorySnapshot, DebtDocumentObservationBatch, PortfolioObservation } from "../contracts/credit-portfolio.ts";
import { id, weakest } from "./common.ts";
export function companyScope(s: CanonicalCreditHistorySnapshot, companyInn: string) { return s.companyInn === companyInn && s.subjectInn === companyInn && s.affectsCompanyDebt === true && ["Компания-заёмщик", "ИП-заёмщик", "COMPANY", "IP"].includes(s.relationshipToCompany ?? "") && !s.warnings.includes("BKI_NOT_COMPANY_PORTFOLIO_SCOPE"); }
// OKB and future adapters implement this canonical boundary, not a provider schema in the core.
export interface CreditHistoryProviderAdapter<T> { adapt(input: T): CanonicalCreditHistorySnapshot }
export function creditHistoryObservations(snapshot: CanonicalCreditHistorySnapshot): PortfolioObservation[] {
  if (!companyScope(snapshot, snapshot.companyInn)) return [];
  return snapshot.obligations.filter(o => !o.warnings.includes("BKI_NOT_COMPANY_PORTFOLIO_SCOPE")).flatMap(o => Object.entries(o.fields).map(([fieldCode, v]) => ({ observationId: id("observation", snapshot.snapshotId, o.observationKey, fieldCode),
    observationGroupId: id("observation-group", snapshot.snapshotId, o.observationKey), companyInn: snapshot.companyInn, obligationHints: o.identityHints,
    fieldCode, value: v.value, unit: typeof v.value === "number" ? fieldCode === "annualRate" ? "PERCENT" as const : "RUB" as const : "TEXT" as const,
    knowledge: v.knowledge, origin: "REPORTED" as const, observedAt: v.observedAt ?? snapshot.asOf, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo,
    confidence: weakest(v.confidence, snapshot.confidence), evidence: v.evidence, warnings: [...v.warnings, ...o.warnings, ...snapshot.warnings] })));
}
export function documentObservations(batch: DebtDocumentObservationBatch): PortfolioObservation[] {
  return batch.observations.map(o => {
    if (o.companyInn !== batch.companyInn) throw Error("DOCUMENT_COMPANY_MISMATCH");
    const ref = { evidenceId: id("document-evidence", batch.documentId, o.observationId), sourceKind: "DEBT_DOCUMENT" as const, sourceId: batch.sourceId,
      documentId: batch.documentId, documentKind: batch.documentKind, rawField: o.fieldCode, rawValue: o.value, observedAt: batch.observedAt, description: "Canonical extracted debt document fact" };
    return { ...o, observationGroupId: id("document-group", batch.documentId), obligationHints: { ...batch.obligationHints, ...o.obligationHints }, observedAt: o.observedAt ?? batch.observedAt,
      confidence: weakest(o.confidence, batch.parserConfidence), evidence: [...o.evidence, ref], warnings: [...o.warnings, ...batch.warnings] };
  });
}
