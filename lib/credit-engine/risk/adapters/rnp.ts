import {day, type ExternalFacts} from '../../../external/records.ts';
import {fact, freshness, RISK_SOURCE_FRESHNESS_DAYS} from '../common.ts';

// An aggregator flag is not a register record. An exclusion establishes only
// the history of its own record, never clearance across other registers.
export function rnpFacts(profile: ExternalFacts, inn: string, asOf: string) {
  if (profile.inn !== inn) return [];
  if (!profile.rnp.length && profile.reportedRnp === true) {
    const receipt = profile.receipts.find(r => r.method === 'company' || r.method === 'entrepreneur');
    return [fact(inn, 'LEGAL_RNP_CURRENT_RECORD', 'LEGAL', null, {
      unit:'BOOLEAN', sourceTypes:['CHECKO'], sourceIds:receipt?[receipt.id]:[],
      period:{from:null,to:null,asOf:day(receipt?.retrievedAt)}, warnings:['RNP_REGISTER_RECORD_REQUIRED'],
      calculationBasis:'Checko сообщает о РНП. Номер, закон и текущий статус записи требуют подтверждения в реестре.'
    })];
  }
  return profile.rnp.map(record => {
    const receipt = profile.receipts.find(r => r.id === record.receiptId);
    const received = day(receipt?.retrievedAt);
    const published = day(record.included ?? record.published);
    const excluded = day(record.ended);
    const end = day(record.plannedEnd);
    const verified = receipt?.direct === true && receipt.provider === 'EIS_DIRECT'
      && receipt.authority === 'EIS' && receipt.method === 'rnp:' + record.law
      && receipt.id === `eis:${receipt.method}:${inn}:${receipt.retrievedAt}`
      && receipt.status === 'READY' && receipt.freshness !== 'STALE' && !!received
      && freshness(received, asOf, RISK_SOURCE_FRESHNESS_DAYS.legal)
      && !!published && published <= received && record.law !== 'UNKNOWN' && !!record.number;
    const active = verified && record.state === 'ACTIVE' && record.ended === null && end && end > asOf;
    const historical = verified && record.state === 'HISTORICAL' && excluded && excluded <= received!;
    const f = fact(inn, 'LEGAL_RNP_CURRENT_RECORD', 'LEGAL', active ? true : historical ? false : null, {
      subjectKey: record.law + ':' + record.number, unit: 'BOOLEAN', sourceTypes: ['EIS'],
      sourceIds: receipt ? [receipt.id] : [], period: {from: published, to: null, asOf: received},
      calculationBasis: `ЕИС · РНП · ${record.law} · запись ${record.number}. Публикация ${published ?? 'неизвестна'}, плановое исключение ${end ?? 'неизвестно'}, исключение ${excluded ?? 'не подтверждено'}.`,
    });
    return f;
  });
}
