import type {CanonicalTransaction} from '../contracts/transactions.ts';
// Additive contract: conflicting observations are evidence, never an economic sum.
export const TRANSACTION_CONFLICT_VERSION = 'PRESCORE-TX-CONFLICT-1';
export type TransactionConflict = {version:typeof TRANSACTION_CONFLICT_VERSION; identity:string; status:'UNRESOLVED'; variants:Array<{versionKey:string; observations:CanonicalTransaction[]}>};
export type ConflictResolution = {identity:string; versionKey:string; confirmationReference:string};
export function documentIdentity(t:CanonicalTransaction):string|null {
 const fields=[t.companyInn,t.companyAccount,t.bankDocumentId,t.date,t.currency,t.direction,t.rawValues.payerAccount,t.rawValues.recipientAccount];
 if(fields.some(v=>!v)||t.direction==='UNKNOWN')return null;
 return JSON.stringify(fields);
}
export function documentVersion(t:CanonicalTransaction):string {
 return JSON.stringify([t.amount,t.rawValues.payerInn,t.rawValues.recipientInn,t.purposeNormalized]);
}
export function isolateTransactionConflicts(items:CanonicalTransaction[], resolutions:ConflictResolution[]=[]){
 const groups=new Map<string,Map<string,CanonicalTransaction[]>>();
 for(const t of items){const key=documentIdentity(t);if(!key)continue;const group=groups.get(key)??new Map<string,CanonicalTransaction[]>();const v=documentVersion(t);group.set(v,[...(group.get(v)??[]),t]);groups.set(key,group);}
 const blocked=new Set<string>();const selected=new Map<string,string>();const conflicts:TransactionConflict[]=[];
 for(const [identity,vs] of [...groups].sort(([a],[b])=>a.localeCompare(b))){if(vs.size<2)continue;
  const rs=resolutions.filter(r=>r.identity===identity);if(rs.length){if(rs.length!==1||!rs[0].confirmationReference.trim()||!vs.has(rs[0].versionKey))throw Error('INVALID_CONFLICT_RESOLUTION');selected.set(identity,rs[0].versionKey);continue;}
  blocked.add(identity);conflicts.push({version:TRANSACTION_CONFLICT_VERSION,identity,status:'UNRESOLVED',variants:[...vs].sort(([a],[b])=>a.localeCompare(b)).map(([versionKey,observations])=>({versionKey,observations:structuredClone(observations).sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||a.transactionId.localeCompare(b.transactionId))}))});
 }
 for(const r of resolutions)if(!selected.has(r.identity))throw Error('UNMATCHED_CONFLICT_RESOLUTION');
 return {conflicts,eligible:items.filter(t=>{const key=documentIdentity(t);return !key||!blocked.has(key)&&(!selected.has(key)||documentVersion(t)===selected.get(key));})};
}
