import type {CompanyProfileData} from '../../company-profile.ts';
import {day} from '../../external/records.ts';
import {freshness, RISK_SOURCE_FRESHNESS_DAYS} from '../risk/common.ts';

export function contractContext(p: CompanyProfileData | undefined, inn: string, cutoff: string) {
  if (!p || p.inn !== inn) return;
  const facts = p.externalFacts;
  if (facts) {
    if (facts.inn !== inn) return;
    const methods = facts.receipts.filter(r => /^contracts:(44|223)$/.test(r.method));
    const current = methods.filter(r => ['READY','EMPTY'].includes(r.status) && r.authority === 'EIS'
      && r.id === (r.provider === 'CHECKO' ? 'external:' : 'eis:')+r.method+':'+inn+':'+r.retrievedAt
      && (r.provider === 'CHECKO' || r.provider === 'EIS_DIRECT' && r.direct)
      && r.freshness !== 'STALE' && freshness(day(r.retrievedAt) ?? undefined, cutoff, RISK_SOURCE_FRESHNESS_DAYS.legal)
      && (!r.informationDate || freshness(r.informationDate, cutoff, RISK_SOURCE_FRESHNESS_DAYS.legal)));
    if (!current.length) return;
    const ids = current.map(r => r.id);
    const items = facts.procurement.items.filter(row => current.some(r => r.id === row.receiptId && r.method === 'contracts:'+row.law.split('-')[0])
      && row.role === 'SUPPLIER' && row.suppliers.some(s => s.inn === inn) && day(row.signedAt) && row.signedAt! <= cutoff)
      .map(row => ({number:row.number, active:row.state === 'ACTIVE', knownState:row.state !== 'UNKNOWN',
        customer:row.customer.name, customerInn:row.customer.inn, amount:row.amount, law:row.law, sourceId:row.receiptId}));
    const complete = facts.procurement.complete && methods.length === current.length && items.length === facts.procurement.items.length;
    return {items, ids, complete, at:current.map(r => day(r.retrievedAt)!).sort().at(-1)!,
      count:complete ? facts.procurement.totalCount : null, activeCount:complete ? facts.procurement.activeCount : null,
      activeAmount:complete ? facts.procurement.activeAmount : null, share:complete ? facts.procurement.topCustomerShare : null};
  }
  const contracts = p.contracts;
  if (!contracts || (p.failedMethods ?? []).includes('contracts') || !freshness(day(p.fetchedAt) ?? undefined, cutoff, RISK_SOURCE_FRESHNESS_DAYS.legal)) return;
  const receipt = p.sourceManifest?.external?.find(s => s.sourceId.startsWith('external:contracts:') || s.rawReference?.startsWith('external:/contracts:'));
  if (receipt && (!['READY','EMPTY'].includes(receipt.status) || receipt.companyInn !== inn)) return;
  const sourceId = receipt?.sourceId ?? 'saved-contracts:'+inn+':'+p.fetchedAt;
  const items = contracts.items.filter(c => day(c.signedAt) && c.signedAt <= cutoff).map(c => ({
    number:c.number, active:/^(active|исполнение|действующий|исполняется)$/i.test(c.status), knownState:!!c.status,
    customer:c.customer, customerInn:null, amount:c.amount, law:c.law, sourceId}));
  const complete = items.length === contracts.totalCount && items.length === contracts.items.length;
  return {items, ids:[sourceId], complete, at:day(p.fetchedAt), count:complete ? contracts.totalCount : null,
    activeCount:complete ? contracts.activeCount : null, activeAmount:complete ? contracts.activeAmount : null, share:null};
}
