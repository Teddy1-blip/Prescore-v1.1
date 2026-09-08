import type { PortfolioIdentityHints, PortfolioObligation, ObligationMatch, PortfolioObservation } from "../contracts/credit-portfolio.ts";
import { adequate, id, normalize, unique, validDate, finite, weakest } from "./common.ts";
export function identityKeys(h: PortfolioIdentityHints): string[] {
  const creditors = [h.creditorInn ? `inn:${normalize(h.creditorInn)}` : "", h.creditorName ? `name:${normalize(h.creditorName)}` : ""].filter(Boolean);
  return unique([...(h.externalIds ?? []).filter(e => e.system && e.value && !/^(sb-\d+|nbki-\d+)$/i.test(e.value)).map(e => `external:${normalize(e.system)}:${normalize(e.value)}`),
    ...creditors.flatMap(creditor => [
    ...(creditor && h.contractNumber ? [`contract:${creditor}:${normalize(h.contractNumber)}`] : []),
    ...(creditor && h.accountNumber ? [`account:${creditor}:${normalize(h.accountNumber)}`] : []),
    ...(creditor && validDate(h.openedAt) && finite(h.originalAmount) && h.originalAmount > 0 && h.productType && h.productType !== "UNKNOWN" ? [`composite:${creditor}:${h.openedAt}:${h.originalAmount}:${h.productType}`] : [])])]);
}
export class ObligationIndex {
  private keys = new Map<string, Set<string>>();
  private objects = new Map<string, PortfolioObligation>();
  private creditors = new Map<string, Set<string>>();
  constructor(obligations: PortfolioObligation[] = []) { for (const o of obligations) this.add(o); }
  add(o: PortfolioObligation) { this.objects.set(o.obligationId, o); for (const k of o.identityAliases) this.keys.set(k, new Set([...(this.keys.get(k) ?? []), o.obligationId])); for (const c of [o.identity.creditorInn.value, o.identity.creditorName.value].filter(Boolean)) { const k = normalize(c); this.creditors.set(k, new Set([...(this.creditors.get(k) ?? []), o.obligationId])); } }
  match(group: PortfolioObservation[]): ObligationMatch {
    const h = group[0].obligationHints, keys = identityKeys(h), candidates = unique(keys.flatMap(k => [...(this.keys.get(k) ?? [])])).filter(oid => {
      const existing = this.objects.get(oid)!;
      return !(["creditorInn", "contractNumber", "accountNumber"] as const).some(k => h[k] && existing.identity[k].value && normalize(h[k]) !== normalize(existing.identity[k].value));
    });
    const c = weakest(...group.filter(o => o.knowledge === "KNOWN").map(o => o.confidence));
    const possible = unique([h.creditorInn, h.creditorName].flatMap(v => v ? [...(this.creditors.get(normalize(v)) ?? [])] : []));
    const enough = adequate(c);
    const reasons = keys.filter(k => this.keys.has(k)).map(k => k.startsWith("external:") ? "OBLIGATION_EXTERNAL_ID_MATCH" : k.startsWith("contract:") ? "OBLIGATION_CONTRACT_NUMBER_MATCH" : k.startsWith("account:") ? "OBLIGATION_ACCOUNT_REFERENCE_MATCH" : "OBLIGATION_OPEN_DATE_MATCH");
    const outcome = candidates.length > 1 ? "AMBIGUOUS" : candidates.length === 1 ? enough ? keys.some(k => k.startsWith("external:") && this.keys.has(k)) ? "EXACT_MATCH" : "STRONG_MATCH" : "POSSIBLE_MATCH"
      : keys.length ? "NEW_OBLIGATION" : possible.length > 1 ? "AMBIGUOUS" : possible.length ? "POSSIBLE_MATCH" : "NO_MATCH";
    return { observationGroupId: group[0].observationGroupId, obligationId: candidates.length === 1 && enough ? candidates[0] : null, outcome, confidence: enough ? c : "LOW",
      reasonCodes: unique([...reasons, ...(outcome === "AMBIGUOUS" ? ["OBLIGATION_MATCH_AMBIGUOUS"] : outcome === "POSSIBLE_MATCH" ? ["OBLIGATION_POSSIBLE_MATCH"] : [])]),
      candidateObligationIds: candidates.length ? candidates : possible, evidence: group.flatMap(o => o.evidence) };
  }
}
export const obligationId = (companyInn: string, hints: PortfolioIdentityHints, groupId: string) => id("obligation", companyInn, identityKeys(hints).sort((a, b) => {
  const rank = (k: string) => k.startsWith("external:") ? 0 : k.startsWith("contract:") ? 1 : k.startsWith("account:") ? 2 : 3; return rank(a) - rank(b) || a.localeCompare(b);
})[0] ?? `unresolved:${groupId}`);
