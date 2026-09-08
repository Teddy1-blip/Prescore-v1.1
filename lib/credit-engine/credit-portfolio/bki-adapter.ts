import type { CreditHistoryReport } from "../../credit-history.ts";
import type { SourceEnvelope } from "../contracts/sources.ts";
import type { CanonicalCreditHistorySnapshot, CreditHistoryProvider, PortfolioObligationType, PortfolioEvidenceRef, PortfolioIdentityHints } from "../contracts/credit-portfolio.ts";
import { confidence, id, normalize, reported, validDate, weakest, finite } from "./common.ts";

import { identityKeys } from "./obligation-matcher.ts";

export function productType(raw: string): PortfolioObligationType {
  const s = normalize(raw);
  if (/гаранти|guarantee/.test(s)) return "BANK_GUARANTEE";
  if (/лизинг|leasing|lease/.test(s)) return "LEASING";
  if (/факторинг|factoring/.test(s)) return "FACTORING";
  if (/овердрафт|overdraft/.test(s)) return "OVERDRAFT";
  if (/кредитн\S* лини|credit line|revolving/.test(s)) return "CREDIT_LINE";
  if (/потребительск|срочный кредит|term loan|невозобновляемый кредит|кредит на/.test(s)) return "TERM_LOAN";
  return "UNKNOWN";
}
export function obligationStatus(raw: string) {
  const s = normalize(raw);
  if (/не закрыт|not closed/.test(s)) return "ACTIVE";
  if (/закрыт|погашен|прекращен|closed|repaid|terminated/.test(s)) return "CLOSED";
  if (/приостанов|suspended/.test(s)) return "SUSPENDED";
  if (/действующ|активн|открыт|active|open/.test(s)) return "ACTIVE";
  return "UNKNOWN";
}
export type UploadedBkiContext = { companyInn: string; source: SourceEnvelope; requestedAt?: string | null; providerRequestId?: string | null; provider?: CreditHistoryProvider;
  confirmedZeroFields?: Record<string, string[]>; identityHints?: Record<string, PortfolioIdentityHints>; creditHistoryRequestId?: string; consentArtifactId?: string };
export function adaptUploadedBki(report: CreditHistoryReport, context: UploadedBkiContext): CanonicalCreditHistorySnapshot {
  const s = context.source, asOf = validDate(report.reportDate) ? report.reportDate : null;
  const provider = context.provider ?? (report.source === "НБКИ" ? "NBKI" : report.source === "СБ БКИ" ? "SBKI" : "UPLOADED_FILE");
  const available = s.sourceType === "BKI" && ["READY", "STALE"].includes(s.status);
  const c = available ? weakest(confidence(report.parserConfidence), confidence(s.confidence), s.status === "STALE" ? "LOW" : "HIGH") : "UNKNOWN";
  const warnings = [...(!available ? ["SOURCE_NOT_READY"] : []), ...(s.status === "STALE" ? ["SOURCE_STALE"] : [])];
  const obligations = report.obligations.map(o => {
    const guarantorship = /поручител|гарант|guarantor/i.test(o.role);
    const type = guarantorship ? "GUARANTORSHIP" : productType(o.product);
    const obligationWarnings = warnings;
    const hints: PortfolioIdentityHints = { creditorName: o.creditor || null, accountNumber: o.accountNumber || null, openedAt: validDate(o.openedAt) ? o.openedAt : null,
      originalAmount: finite(o.originalAmount) && o.originalAmount > 0 ? o.originalAmount : null, productType: type, ...context.identityHints?.[o.id], ...(guarantorship ? { productType: type } : {}) };
    // Source-local grouping may use row IDs/content; canonical identity uses only hints.
    const key = id("bureau-observation", s.sourceId, o.id, o);
    const evidenceFor = (field: string, rawValue: string | number | null): PortfolioEvidenceRef => ({ evidenceId: id("evidence", s.sourceId, o.id, field, rawValue), sourceKind: "BKI", sourceId: s.sourceId,
      bureauObligationId: o.id, provider, providerRequestId: context.providerRequestId ?? null, rawField: field, rawValue, rawLabel: field === "annualRate" ? o.rateLabel : undefined, pageHint: o.sourcePageHint,
      rawReference: s.rawReference, observedAt: asOf, description: `Uploaded bureau obligation: ${field}` });
    const fields: Record<string, string | number | null> = { creditorName: o.creditor, creditorInn: hints.creditorInn ?? null, contractNumber: hints.contractNumber ?? null, contractDate: hints.contractDate ?? null,
      accountNumber: o.accountNumber, productType: type === "UNKNOWN" ? null : type, status: obligationStatus(o.status) === "UNKNOWN" ? null : obligationStatus(o.status), originalAmount: o.originalAmount, creditLimit: o.creditLimit,
      principalOutstanding: o.outstandingPrincipal, totalOutstanding: o.totalOutstanding, scheduledPaymentAmount: o.monthlyPayment,
      nextPaymentAmount: o.nextPaymentAmount, nextPaymentDate: validDate(o.nextPaymentDate) ? o.nextPaymentDate : null, annualRate: o.annualRate,
      openedAt: hints.openedAt ?? null, maturityDate: !["BANK_GUARANTEE", "GUARANTORSHIP"].includes(type) && validDate(o.scheduledCloseAt) ? o.scheduledCloseAt : null,
      guaranteeExpiry: ["BANK_GUARANTEE", "GUARANTORSHIP"].includes(type) && validDate(o.scheduledCloseAt) ? o.scheduledCloseAt : null,
      overdueAmount: o.overdueAmount, delinquencyDays: o.maxDelinquencyDays, collateralDescription: o.collateral, guaranteeAmount: o.guaranteeAmount, contingentExposure: guarantorship ? o.guaranteeAmount : null };
    const canonical = Object.fromEntries(Object.entries(fields).map(([field, rawValue]) => {
      const zeroConfirmed = rawValue !== 0 || context.confirmedZeroFields?.[o.id]?.includes(field);
      const refs = [evidenceFor(field, rawValue)];
      const underlyingBorrowerFact = guarantorship && ["originalAmount", "creditLimit", "principalOutstanding", "totalOutstanding", "scheduledPaymentAmount", "nextPaymentAmount", "nextPaymentDate", "annualRate", "overdueAmount", "delinquencyDays"].includes(field);
      return [field, { ...reported(available && zeroConfirmed && !underlyingBorrowerFact ? rawValue : null, asOf, refs, c), warnings: [...warnings, ...(!zeroConfirmed ? ["MISSING_NOT_ZERO", "ZERO_NOT_SOURCE_CONFIRMED"] : [])] }];
    }));
    return { observationKey: key, identityHints: hints, type, fields: canonical, evidence: Object.values(canonical).flatMap(v => v.evidence), warnings: obligationWarnings };
  }).sort((a, b) => a.observationKey.localeCompare(b.observationKey));
  // Repeated weak/composite rows within one source are unresolved, never one debt.
  const compositeGroups = new Map<string, Set<string>>();
  for (const o of obligations) {
    const keys = identityKeys(o.identityHints);
    if (keys.some(k => !k.startsWith("composite:"))) continue;
    const signature = id("weak-row-hints", o.identityHints);
    compositeGroups.set(signature, new Set([...(compositeGroups.get(signature) ?? []), o.observationKey]));
  }
  for (const o of obligations) if ((compositeGroups.get(id("weak-row-hints", o.identityHints))?.size ?? 0) > 1) o.warnings = [...o.warnings, "BKI_AMBIGUOUS_SOURCE_ROWS"];
  return { snapshotId: id("credit-history", context.companyInn, s.sourceId, s.contentHash, asOf, provider), provider, companyInn: context.companyInn,
    subjectInn: report.subjectInn || null, relationshipToCompany: report.relationshipToCompany, affectsCompanyDebt: report.affectsCompanyDebt,
    requestedAt: context.requestedAt ?? null, asOf, sourceId: s.sourceId, providerRequestId: context.providerRequestId ?? null,
    rawSourceReference: s.rawReference ?? null, contentHash: s.contentHash ?? null, obligations, confidence: c, warnings: [...warnings, ...(s.companyInn !== context.companyInn ? ["BKI_NOT_COMPANY_PORTFOLIO_SCOPE"] : [])],
    creditHistoryRequestId: context.creditHistoryRequestId, consentArtifactId: context.consentArtifactId };
}
