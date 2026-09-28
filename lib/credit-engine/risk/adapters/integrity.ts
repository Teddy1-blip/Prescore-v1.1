import type { RiskFact, RiskShadowInput } from "../../contracts/risk.ts";
import { fact, unique, validDate, freshness, RISK_SOURCE_FRESHNESS_DAYS as age } from "../common.ts";
export function integrityFacts({ analysis: a, companyProfile: p, asOfDate }: RiskShadowInput): RiskFact[] {
  const m = a.sourceManifest, sources = [...(m?.bankStatements ?? []), ...[m?.bki, m?.bfo, m?.quarterly, p?.sourceManifest?.bfo].filter(s => !!s), ...(m?.external ?? []), ...(p?.sourceManifest?.external ?? [])];
  const valid = sources.filter(s => s.companyInn === a.companyInn), uniqueSources = [...new Map(valid.map(s => [s.sourceId, s])).values()];
  const missingFamilies = ["BANK_STATEMENT", "BFO", "QUARTERLY", "BKI"].filter(t => !uniqueSources.some(s => s.sourceType === t && !["EMPTY", "NOT_REQUESTED"].includes(s.status)));
  const base = { sourceTypes: unique(uniqueSources.map(s => s.sourceType)), sourceIds: uniqueSources.map(s => s.sourceId), period: { from: null, to: null, asOf: asOfDate }, calculationBasis: "Existing source availability and integrity, not company credit quality" };
  const out = [fact(a.companyInn, "SOURCE_MISSING_COUNT", "DATA_QUALITY", missingFamilies.length, { ...base, warnings: missingFamilies.map(t => `SOURCE_MISSING:${t}`) }), fact(a.companyInn, "SOURCE_STALE_COUNT", "DATA_QUALITY", uniqueSources.filter(s => s.status === "STALE" || s.sourceType === "BKI" && s.sourceId === m?.bki?.sourceId && s.status === "READY" && validDate(a.creditHistory?.reportDate) && a.creditHistory.reportDate <= asOfDate && !freshness(a.creditHistory.reportDate, asOfDate, age.bki)).length, base), fact(a.companyInn, "SOURCE_FAILED_COUNT", "DATA_QUALITY", uniqueSources.filter(s => s.status === "FAILED").length, base)];
  out.push(fact(a.companyInn, "INTEGRITY_CONFIDENCE", "DATA_QUALITY", a.integrity?.confidence ?? null, { ...base, unit: "PERCENT" }));
  const b = a.metricsV2?.period, coverage = a.integrity?.calendarCoverage;
  const issue = b ? b.overlapMonths ? 3 : b.missingMonths ? 2 : b.partialMonths ? 1 : 0 : coverage?.length ? coverage.some(c => c.status === "OVERLAP") ? 3 : coverage.some(c => c.status === "MISSING") ? 2 : coverage.some(c => c.status === "PARTIAL") ? 1 : 0 : null;
  out.push(fact(a.companyInn, "BANK_COVERAGE_ISSUE", "DATA_QUALITY", issue, { ...base, calculationBasis: "Canonical bank coverage: 3 unresolved overlap, 2 missing, 1 partial, 0 full; not an economic score" })); return out;
}
