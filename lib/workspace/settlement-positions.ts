import type {SourceRow} from './dossier-sources.ts';
import {validDate} from '../credit-engine/credit-portfolio/common.ts';
import type {LedgerBalance} from './ledger-import.ts';

export type SettlementPosition = LedgerBalance & {
  id:string; side:'buyers'|'suppliers'|'other'; references:{name:string;documentId:string|null;row:number;page?:number}[]; conflict:boolean;
};

/** Each OSV is a snapshot. Repeated balances from different dates are never additive. */
export function settlementPositions(sources:SourceRow[]):SettlementPosition[] {
  const latest=new Map<string,SettlementPosition[]>();
  for(const source of sources.filter(s=>s.kind==='COUNTERPARTIES')){
    for(const row of source.payload.ledger??[]){
      const key=JSON.stringify([row.account,row.partyInn||row.party.trim().toLocaleLowerCase('ru'),row.contract??'',row.component??'']);
      const group=latest.get(key)??[];
      if(group.length&&group[0].asOf>row.asOf)continue;
      const current=group.length&&group[0].asOf===row.asOf?group:[];
      const reference={name:source.payload.envelope.fileName??'ОСВ',documentId:source.documentId,row:row.row};
      const same=current.find(p=>p.debit===row.debit&&p.credit===row.credit&&p.due===row.due);
      if(same){same.references.push(reference);continue;}
      current.push({...row,id:key,side:row.account.startsWith('62')?'buyers':row.account.startsWith('60')?'suppliers':'other',references:[reference],conflict:false});
      latest.set(key,current);
    }
  }
  const exact=(v:string)=>v.trim().toLocaleLowerCase('ru').replace(/[«»"]/g,'').replace(/\s+/g,' ');
  const flat=[...latest.values()].flatMap(group=>group.map(position=>({...position,conflict:group.length>1})));
  const contracts=sources.filter(s=>s.kind==='COMMERCIAL_DOCUMENT'&&s.payload.verified?.contract_number);
  for(const position of flat){
    if(!position.contract||position.side==='other')continue;
    const dates=new Set(position.due?[position.due]:[]);
    for(const doc of contracts){
      const fields=doc.payload.verified!;
      const party=fields[position.side==='buyers'?'customer':'supplier']?.value;
      if(exact(fields.contract_number.value)!==exact(position.contract)||!party||exact(party)!==exact(position.party))continue;
      // A fixed contractual payment date is usable. Relative terms need a separately confirmed trigger.
      const payment=fields.FINAL_PAYMENT,raw=payment?.value.trim();
      if(!raw||!payment.page||!payment.fragment)continue;
      const literal=raw.match(/^(?:не позднее\s+|до\s+)?(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})[.]?$/iu)?.[1];
      if(!literal)continue;
      const date=literal.includes('.')?literal.split('.').reverse().join('-'):literal;
      if(!validDate(date))continue;
      dates.add(date);
      position.references.push({name:doc.payload.envelope.fileName??'Договор',documentId:doc.documentId,row:payment.page,page:payment.page});
    }
    if(dates.size===1)position.due=[...dates][0];
    if(dates.size>1)position.conflict=true;
  }
  return flat.sort((a,b)=>a.party.localeCompare(b.party,'ru')||a.account.localeCompare(b.account));
}
