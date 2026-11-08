import type { CanonicalCreditHistorySnapshot, DebtDocumentObservationBatch, PortfolioObservation } from "../contracts/credit-portfolio.ts";
import { identityKeys } from "./obligation-matcher.ts";
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
// An identified row can report its schedule even if the rest of the bureau report is incomplete.
export const PROVISIONAL_BKI_SCHEDULE = "BKI_SCHEDULE_UNCONFIRMED";
export function provisionalSchedule(group: PortfolioObservation[], bureauIds: Set<string>): PortfolioObservation[] {
  if (!group.every(o => bureauIds.has(o.observationId) && !o.warnings.includes("SOURCE_STALE") && !o.warnings.includes("SOURCE_NOT_READY"))) return [];
  const hints = group[0].obligationHints;
  const creditorName = hints.creditorName === "Кредитор не определён" ? null : hints.creditorName;
  if (!identityKeys({ ...hints, creditorName }).some(key => !key.startsWith("composite:"))) return [];
  const fields = group.filter(o => o.confidence === "LOW" && o.knowledge === "KNOWN" && o.origin === "REPORTED" &&
    o.evidence.some(e => e.sourceKind === "BKI" && e.rawField === o.fieldCode && e.rawValue === o.value));
  const installment = fields.some(o => o.fieldCode === "scheduledPaymentAmount" && typeof o.value === "number" && o.value >= 0);
  const frequency = fields.some(o => o.fieldCode === "scheduledPaymentFrequency" && typeof o.value === "string" && o.value.trim());
  if (!installment || !frequency) return [];
  return fields.filter(o => ["scheduledPaymentAmount", "scheduledPaymentFrequency", "nextPaymentAmount", "nextPaymentDate"].includes(o.fieldCode));
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
