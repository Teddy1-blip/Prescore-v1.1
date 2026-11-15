import type {SourceRow} from './dossier-sources.ts';
import type {LedgerBalance} from './ledger-import.ts';

export type SettlementPosition = LedgerBalance & {
  id:string; side:'buyers'|'suppliers'|'other'; references:{name:string;documentId:string|null;row:number}[]; conflict:boolean;
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
  return [...latest.values()].flatMap(group=>group.map(position=>({...position,conflict:group.length>1}))).sort((a,b)=>a.party.localeCompare(b.party,'ru')||a.account.localeCompare(b.account));
}
