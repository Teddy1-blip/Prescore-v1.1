import type {EntityLifecycleState} from './credit-engine/contracts/risk.ts';
import type {AnalysisResult} from './prescore.ts';
import {freshness, RISK_SOURCE_FRESHNESS_DAYS} from './credit-engine/risk/common.ts';

export const LEGAL_REGISTRY_VERSION = 'PRESCORE-FNS-INTAKE-1';
export type LegalRegistryReceipt = {
  id: string; companyInn: string; contentHash: string; informationDate: string | null;
  receivedAt: string; checkedAt: string; verifier: typeof LEGAL_REGISTRY_VERSION;
  method: 'INDEPENDENT_OFFICIAL_RETRIEVAL'; origin: 'CONFIRMED' | 'UNCONFIRMED';
  signatureChecked: false; officialHost: 'egrul.nalog.ru' | null; locatorHash: string | null;
  lifecycle: EntityLifecycleState | null; eligible: boolean; reasons: string[];
  replacesSourceId: string | null;
};
export type LegalRegistryV1 = {version: typeof LEGAL_REGISTRY_VERSION; activeSourceId: string | null; history: LegalRegistryReceipt[]};
export function activeLegalReceipt(analysis: AnalysisResult) {
  const registry = analysis.legalRegistryV1;
  if (registry?.version !== LEGAL_REGISTRY_VERSION) return null;
  const r = registry.history.find(r => r.id === registry.activeSourceId);
  const source = analysis.sourceManifest?.external?.find(s => s.sourceId === r?.id);
  return r?.eligible && r.origin === 'CONFIRMED' && r.verifier === LEGAL_REGISTRY_VERSION &&
    r.method === 'INDEPENDENT_OFFICIAL_RETRIEVAL' && r.officialHost === 'egrul.nalog.ru' &&
    r.companyInn === analysis.companyInn && source && source.companyInn === r.companyInn &&
    source.status === 'READY' && source.contentHash === r.contentHash && source.periodTo === r.informationDate ? r : null;
}
export function legalReceiptCurrent(r: LegalRegistryReceipt, asOfDate: string) {
  return r.eligible && freshness(r.informationDate ?? undefined, asOfDate, RISK_SOURCE_FRESHNESS_DAYS.legal);
}
export function legalRegistryView(analysis: AnalysisResult) {
  // No original document, download token or submitting user's identity is published.
  return analysis.legalRegistryV1 ? structuredClone(analysis.legalRegistryV1) : undefined;
}
