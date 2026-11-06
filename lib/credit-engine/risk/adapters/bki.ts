import type { RiskFact, RiskShadowInput } from "../../contracts/risk.ts";
import { adaptUploadedBki } from "../../credit-portfolio/bki-adapter.ts";
import { companyScope } from "../../credit-portfolio/observations.ts";
import { fact, freshness, validDate, weakest, RISK_SOURCE_FRESHNESS_DAYS as age } from "../common.ts";
export function bkiFacts({ analysis: a, asOfDate }: RiskShadowInput): RiskFact[] {
  if (!a.creditHistory || !a.sourceManifest?.bki) return [];
  const snapshot = adaptUploadedBki(a.creditHistory, { companyInn: a.companyInn, source: a.sourceManifest.bki });
  if (!companyScope(snapshot, a.companyInn)) return [fact(a.companyInn, "BKI_SCOPE_EXCLUDED", "DATA_QUALITY", true, { sourceTypes: ["BKI"], sourceIds: [snapshot.sourceId], warnings: ["BKI_NOT_COMPANY_SCOPE"] })];
  const source = a.sourceManifest.bki;
  const validReport = source.sourceType === "BKI" && ["READY", "STALE"].includes(source.status) && validDate(snapshot.asOf) && validDate(asOfDate) && snapshot.asOf <= asOfDate;
  const current = validReport && source.status === "READY" && freshness(snapshot.asOf, asOfDate, age.bki);
  const staleHistorical = validReport && !current;
  return snapshot.obligations.filter(o => !["GUARANTORSHIP", "BANK_GUARANTEE"].includes(o.type)).flatMap(o => [["BKI_OVERDUE", "overdueAmount", "RUB"], ["BKI_HISTORY_DAYS", "delinquencyDays", "DAYS"], ...(o.fields.currentDelinquencyDays ? [["BKI_CURRENT_DAYS", "currentDelinquencyDays", "DAYS"]] : [])].map(([code, key, unit]) => {
    const v = o.fields[key], historical = key === "delinquencyDays"; const f = fact(a.companyInn, code, "CREDIT_HISTORY", v?.value ?? null, { subjectKey: o.observationKey, unit: unit as "RUB" | "DAYS", status: (historical ? validReport : current && (key !== "currentDelinquencyDays" || o.fields.status?.value === "ACTIVE" && o.fields.principalOutstanding?.knowledge === "KNOWN")) && v?.knowledge === "KNOWN" ? "KNOWN" : "UNKNOWN", confidence: historical && staleHistorical ? weakest(v?.confidence ?? "UNKNOWN", "MEDIUM") : v?.confidence ?? "UNKNOWN", period: { from: null, to: null, asOf: snapshot.asOf }, sourceTypes: ["BKI"], sourceIds: [snapshot.sourceId], calculationBasis: key === "overdueAmount" ? "Source-supported company borrower current overdue; ambiguous legacy zero remains unknown" : key === "currentDelinquencyDays" ? "Explicit current duration on the open borrower obligation with known principal" : "Reported historical maximum delinquency days; not an invented current-day counter", warnings: [...(v?.warnings ?? []), ...(!validReport ? ["SOURCE_NOT_READY_OR_INVALID"] : !current ? ["SOURCE_STALE", ...(historical ? ["HISTORICAL_BKI_SOURCE_STALE"] : [])] : [])] });
    f.evidence = f.evidence.map(e => ({ ...e, rawReference: v?.evidence.map(ref => `${ref.rawReference ?? snapshot.sourceId}:${ref.bureauObligationId}:${ref.rawField}`).join("; ") })); return f;
  }));
}
