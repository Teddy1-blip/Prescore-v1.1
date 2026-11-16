/** Recover a printed NBKI corporate legacy UID only when all 38 hex/hyphen
 * characters exist in the same account-card label (one or two physical lines).
 * Never stitch unrelated pages, nearby numbers, or a different bank's card.
 */
export type NbkiLegacyUidResult={
 uid:string|null;wrapped:boolean;review:'ABSENT'|'EXACT'|'PARTIAL';
};
const full=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]$/i;
const prefix=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-$/i;
const suffix=/^[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]$/i;
// The PDF layout engine renders other columns after two or more spaces.
function leftToken(s:string){
 const m=s.match(/^[ \t]*([a-f0-9-]{1,50})(?=[ \t]{2,}|[ \t]*$)/i);
 return m?.[1]??'';
}
export function nbkiLegacyUidEvidence(afterAccount:string):NbkiLegacyUidResult{
 const base={uid:null,wrapped:false,review:'ABSENT'} as NbkiLegacyUidResult;
 const lines=afterAccount.split(/\r?\n/u);
 const index=lines.findIndex(line=>/^[ \t]*УИД договора\s*\(сделки\):/iu.test(line));
 if(index<0)return base;
 const first=lines[index].replace(/^[ \t]*УИД договора\s*\(сделки\):/iu,'');
 if(/^[ \t]*(?:Н\/Д|нет данных)(?:[ \t]{2,}|[ \t]*$)/iu.test(first))return base;
 const a=leftToken(first);
 if(full.test(a))return {uid:a.toLowerCase(),wrapped:false,review:'EXACT'};
 if(!prefix.test(a))return {...base,review:a?'PARTIAL':'ABSENT'};
 const next=lines[index+1]??'';
 const b=leftToken(next);
 if(!suffix.test(b))return {...base,review:'PARTIAL'};
 const uid=(a+b).toLowerCase();
 return full.test(uid)?{uid,wrapped:true,review:'EXACT'}:{...base,review:'PARTIAL'};
}
