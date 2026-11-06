import {activeLegalReceipt, legalReceiptCurrent} from "../../../legal-registry.ts";
import type { EntityLifecycleState, RiskFact, RiskShadowInput } from "../../contracts/risk.ts";
import { fact, freshness, sourceConfidence, usable, weakest, validDate, RISK_SOURCE_FRESHNESS_DAYS as age } from "../common.ts";
export function normalizeLifecycle(raw: string): EntityLifecycleState {
  const s = raw.normalize("NFKC").toLowerCase().trim().replace(/[.!]$/, "");
  if (["действует", "действующая", "действующее", "действующая организация", "действующее юридическое лицо", "active"].includes(s)) return "ACTIVE";
  if (["ликвидирован", "деятельность прекращена", "юридическое лицо ликвидировано", "ликвидировано", "ликвидирована", "прекратило деятельность", "прекращено", "terminated", "liquidated"].includes(s)) return "TERMINATED";
  if (["находится в процессе ликвидации", "в процессе ликвидации", "liquidation"].includes(s)) return "LIQUIDATION";
  if (["банкротство: действующая процедура", "действующая процедура банкротства", "bankruptcy_active"].includes(s)) return "BANKRUPTCY_ACTIVE";
  return s ? "OTHER" : "UNKNOWN";
}
function profileLegalFacts(input: RiskShadowInput, financial: RiskFact[]): RiskFact[] {
  const { analysis: a, companyProfile: p, asOfDate } = input; if (!p || p.inn !== a.companyInn) return [];
  const date = p.fetchedAt?.slice(0, 10), sources = p.sourceManifest?.external ?? [];
  const source = (endpoint: string) => sources.find(s => s.rawReference?.startsWith(`external:/${endpoint}:`) || s.sourceId.startsWith(`external:${endpoint}:`));
  const read = (code: string, value: RiskFact["value"], endpoint: string, details?: string): RiskFact => {
    const s = source(endpoint), valid = (s?.status === "READY" || s?.status === "EMPTY" && !!p.externalFacts) && s.companyInn === a.companyInn && freshness(date, asOfDate, age.legal) && !p.failedMethods.includes(endpoint);
    const f = fact(a.companyInn, code, "LEGAL", valid ? value : null, { confidence: s?.confidence == null && valid ? "HIGH" : sourceConfidence(s?.confidence), sourceTypes: s ? [s.sourceType] : [], sourceIds: s ? [s.sourceId] : [], period: { from: null, to: null, asOf: date ?? null }, calculationBasis: details ?? `Current canonical company profile /${endpoint}; no legacy signals`, warnings: valid ? [] : ["LEGAL_SOURCE_NOT_CURRENT_OR_AVAILABLE"] });
    f.evidence = f.evidence.map(e => ({ ...e, rawReference: s?.rawReference })); return f;
  };
  const facts=p.externalFacts, base=p.inn.length===12?"entrepreneur":"company";
  const covered=(method:string)=>{const receipt=facts?.receipts.find(r=>r.method===method);return !facts || !!receipt && receipt.total===receipt.visible && ["READY","EMPTY"].includes(receipt.status);};
  const lifecycle = facts?.identity.lifecycle ?? normalizeLifecycle(p.company.status), out = [read("LEGAL_LIFECYCLE", lifecycle === "UNKNOWN" || lifecycle === "OTHER" ? null : lifecycle, base, `Exact lifecycle normalization of current status: ${p.company.status}`),
    read("LEGAL_ADDRESS_UNRELIABLE", facts?facts.identity.unreliable:p.company.addressUnreliable === true ? true : source(base)?.fieldAvailability?.addressUnreliable === "KNOWN" ? false : null, base)];
  const active = p.enforcementItems?.filter(e => e.active);
  const amount = p.externalFacts ? p.externalFacts.activeEnforcementRub : active && active.every(e => validDate(e.date?.slice(0, 10)) && e.date.slice(0, 10) <= asOfDate && e.amount !== null && Number.isFinite(e.amount)) ? active.reduce((n, e) => n + e.amount!, 0) : null;
  const enforcement = read("LEGAL_ACTIVE_ENFORCEMENT_AMOUNT", amount, "enforcements", `Detailed active enforcement amounts; source records: ${active?.map(e => `${e.number}@${e.date}`).join(", ") ?? "unavailable"}`); enforcement.unit = "RUB"; out.push(enforcement);
  const revenue = financial.find(f => f.semanticCode === "FIN_ANNUAL_REVENUE");
  const ratio = usable(enforcement) && usable(revenue) && typeof revenue.value === "number" && revenue.value > 0 && revenue.period.to && freshness(revenue.period.to, asOfDate, age.annual) ? Number(enforcement.value) / revenue.value : null;
  out.push(fact(a.companyInn, "LEGAL_ENFORCEMENT_REVENUE_RATIO", "LEGAL", ratio, { unit: "RATIO", origin: "DERIVED", confidence: weakest(enforcement.confidence, revenue?.confidence ?? "UNKNOWN"), period: enforcement.period, sourceTypes: [...enforcement.sourceTypes, ...(revenue?.sourceTypes ?? [])], sourceIds: [...enforcement.sourceIds, ...(revenue?.sourceIds ?? [])], evidence: [...enforcement.evidence, ...(revenue?.evidence ?? [])], calculationBasis: "Current active enforcement amount / latest applicable annual accounting revenue; annual flow scaling only, never debt equivalence" }));
  out.push(read("LEGAL_DEFENDANT_CASES", !covered("legal-cases") || facts?.cases.some(e=>!e.date||e.role==="UNKNOWN") ? null : p.legalCaseItems?.filter(e => e.role === "DEFENDANT" && e.date.slice(0, 10) <= asOfDate).length ?? null, "legal-cases", `Reported defendant claims, not established debt; ${p.legalCaseItems?.map(e => `${e.number}@${e.date}`).join(", ") ?? "unavailable"}`));
  out.push(read("LEGAL_REGISTRY_REVIEW", !covered("fedresurs") || !covered("bankruptcy-messages") ? null : p.legal.bankruptcyMessages > 0 ? Math.max(p.legal.bankruptcyMessages, p.registryMessages?.filter(m => m.date.slice(0, 10) <= asOfDate && (m.classification !== "INFORMATIONAL" || /банкрот/i.test(m.title))).length ?? 0) : p.registryMessages?.filter(m => m.date.slice(0, 10) <= asOfDate && (m.classification !== "INFORMATIONAL" || /банкрот/i.test(m.title))).length ?? null, source("fedresurs") ? "fedresurs" : "bankruptcy-messages", `Registry messages do not prove active bankruptcy; ${p.registryMessages?.map(m => `${m.sourceId}@${m.date}: ${m.title}`).join("; ") ?? "aggregate message count only"}`));
  out.push(read("LEGAL_VIOLATIONS_REPORTED", !covered("inspections") || facts?.inspections.some(e=>!e.date||!e.violations) ? null : p.inspectionItems?.filter(e => e.date.slice(0, 10) <= asOfDate && e.violations.trim() && !/^(нет|не выявлено|отсутствуют)$/i.test(e.violations.trim())).length ?? null, "inspections"));
  return out;
}

// The existing legal adapter is the sole path into canonical lifecycle coverage.
// A registry extract provides lifecycle only; it says nothing about claims/debt/address.
export function legalFacts(input: RiskShadowInput, financial: RiskFact[]): RiskFact[] {
  const out = profileLegalFacts(input, financial), r = activeLegalReceipt(input.analysis);
  const conflict = !r && input.analysis.legalRegistryV1?.history.some(h => h.reasons.includes('SAME_DATE_LIFECYCLE_CONFLICT'));
  if (!r && !conflict) return out;
  const current = r && legalReceiptCurrent(r, input.asOfDate);
  const registry = fact(input.analysis.companyInn, 'LEGAL_LIFECYCLE', 'LEGAL', current ? r.lifecycle : null, {
    confidence: current ? 'HIGH' : 'UNKNOWN', sourceTypes:r?['OTHER']:[], sourceIds:r?[r.id]:[],
    period:{from:null,to:null,asOf:r?.informationDate??null},
    calculationBasis:'Explicit EGRUL status; PDF hash matched independently retrieved FNS HTTPS bytes. Signature NOT cryptographically verified. Other legal risks remain separate.',
    warnings:conflict?['SAME_DATE_LIFECYCLE_CONFLICT']:current?[]:['LEGAL_SOURCE_NOT_CURRENT_OR_AVAILABLE']
  });
  const previous = out.find(f => f.semanticCode === 'LEGAL_LIFECYCLE');
  if (previous?.status === 'KNOWN' && current && (input.companyProfile?.externalFacts ? input.companyProfile.externalFacts.identity.informationDate : previous.period.asOf) === r.informationDate && previous.value !== registry.value) {
    return [...out.filter(f => f.semanticCode !== 'LEGAL_LIFECYCLE'), fact(input.analysis.companyInn, 'LEGAL_LIFECYCLE', 'LEGAL', null, {
      confidence:'UNKNOWN', period:registry.period, sourceTypes:[...registry.sourceTypes,...previous.sourceTypes], sourceIds:[...registry.sourceIds,...previous.sourceIds],
      evidence:[...registry.evidence,...previous.evidence], warnings:['LEGAL_LIFECYCLE_SOURCE_CONFLICT'], calculationBasis:'Verified current sources disagree; neither status selected'
    })];
  } else if (!conflict && previous?.status === 'KNOWN' && (!current || !input.companyProfile?.externalFacts && previous.period.asOf! > r.informationDate!)) return out;
  return [...out.filter(f => f.semanticCode !== 'LEGAL_LIFECYCLE'), registry];
}
