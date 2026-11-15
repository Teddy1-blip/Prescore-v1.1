import type {NormalizedTransaction} from '../prescore.ts';
import {validDate} from '../credit-engine/credit-portfolio/common.ts';
import type {SettlementPosition} from './settlement-positions.ts';

export type PaymentFact={id:string;date:string;amount:number;direction:'in'|'out';inn:string;source:string};
export type SettlementEvent={position:string;asOf:string;kind:'DUE'|'PAYMENT'|'TASK'|'PROMISE';date:string;note:string;bankId?:string;amount?:number};
export type LoggedSettlementEvent=SettlementEvent & {id:string;recordedAt:string};
export function paymentFacts(transactions:NormalizedTransaction[]):PaymentFact[] {
  return transactions.flatMap(t=>{
    if(!t.canonicalTransactionId||!t.counterpartyInn||!t.sourceId||!validDate(t.date)||t.currency!=='RUB'||!Number.isFinite(t.amount)||t.amount<=0||
      t.isOwnAccountTransfer||t.duplicateOfTransactionId||t.possibleReversalOfTransactionId||t.direction==='unknown')return [];
    return [{id:t.canonicalTransactionId,date:t.date,amount:t.amount,direction:t.direction,inn:t.counterpartyInn,source:t.bankDocumentId??t.sourceId}];
  });
}
export function settlementState(position:SettlementPosition,history:LoggedSettlementEvent[],payments:PaymentFact[]){
  const events=history.filter(e=>e.position===position.id).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id));
  const amount=position.side==='buyers'?position.debit:position.side==='suppliers'?position.credit:null;
  const linked=events.filter(e=>e.kind==='PAYMENT'&&e.date>position.asOf);
  const paid=linked.reduce((sum,e)=>sum+Math.round((e.amount??0)*100),0)/100;
  const remaining=amount===null?null:Math.round((amount-paid)*100)/100;
  const conflict=position.conflict||remaining!==null&&remaining<0;
  const due=events.filter(e=>e.kind==='DUE'&&e.asOf===position.asOf).at(-1)?.date??position.due??null;
  const assigned=new Set(history.filter(e=>e.kind==='PAYMENT').map(e=>e.bankId));
  const candidates=payments.filter(p=>position.partyInn&&p.inn===position.partyInn&&p.direction===(position.side==='buyers'?'in':'out')&&p.date>position.asOf&&!assigned.has(p.id)&&remaining!==null&&p.amount<=remaining&&!conflict);
  return {...position,amount,paid,remaining,dueDate:due,conflict,history:events,candidates,revision:events.at(-1)?.id??''};
}
export type SettlementState=ReturnType<typeof settlementState>;
export function settlementEvent(input:Partial<SettlementEvent>,position:SettlementState):SettlementEvent|null{
  if(!input||position.conflict||position.side==='other'||input.position!==position.id||input.asOf!==position.asOf||typeof input.note!=='string'||!input.note.trim()||input.note.length>320)return null;
  const base={position:position.id,asOf:position.asOf,note:input.note.trim()};
  if(input.kind==='PAYMENT'){
    const bank=position.candidates.find(p=>p.id===input.bankId);
    return bank?{...base,kind:'PAYMENT',bankId:bank.id,date:bank.date,amount:bank.amount}:null;
  }
  if(!validDate(input.date)||!['DUE','TASK','PROMISE'].includes(String(input.kind)))return null;
  return {...base,kind:input.kind as 'DUE'|'TASK'|'PROMISE',date:input.date};
}
