import type { CreditLabEntry } from "../contracts/credit-lab.ts";
export { id, stable, validDate } from "../risk/common.ts";
import { id, stable } from "../risk/common.ts";
// Canonical ordering only for semantically unordered direct facts and evidence.
export function fingerprint(entry: CreditLabEntry): string {
 const material=entry.material.kind === "RISK_FACTS" ? {...entry.material,facts:[...entry.material.facts].map(f=>({...f,evidence:[...f.evidence].sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId))})).sort((a,b)=>a.factId.localeCompare(b.factId))} : entry.material;
 return id("credit-lab-case",entry.caseDefinition,material);
}
export const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
export const confidenceRank=(s:string)=>["UNKNOWN","LOW","MEDIUM","HIGH"].indexOf(s);
export const contextKey=(x:{subjectKey?:string;portfolioObligationId?:string})=>x.subjectKey??x.portfolioObligationId??"";
