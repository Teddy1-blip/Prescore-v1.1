import type {IndexConfidence} from '../contracts/index.ts';
import type {RiskSeverity} from '../contracts/risk.ts';
export {id,stable,validDate} from '../credit-lab/common.ts';
export const unique=(xs:string[])=>[...new Set(xs)].sort();
export const rank=(x:IndexConfidence)=>({UNKNOWN:0,LOW:1,MEDIUM:2,HIGH:3}[x]??0);
export const weakest=(...xs:IndexConfidence[]):IndexConfidence=>xs.length?['UNKNOWN','LOW','MEDIUM','HIGH'][Math.min(...xs.map(rank))] as IndexConfidence:'UNKNOWN';
export const points=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const highest=(xs:RiskSeverity[]):RiskSeverity|'NONE'=>['CRITICAL','HIGH','MEDIUM','LOW','INFO'].find(s=>xs.includes(s as RiskSeverity)) as RiskSeverity??'NONE';
export const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
