import type {ContextShadowInput} from '../contracts/context.ts';
import {dateEligible} from './common.ts';
// Inspect availability fields only. Maturity/execution/schedule/effectiveTo are not receipt dates.
export function available(x:unknown,cutoff:string):boolean{
 if(!x||typeof x!=='object')return true;
 return Object.entries(x).every(([k,v])=>['receivedAt','fetchedAt','observedAt','requestedAt','evidenceAsOf'].includes(k)?v==null||v===''||typeof v==='string'&&dateEligible(v,cutoff):available(v,cutoff));
}
export function temporalRiskFacts(input:ContextShadowInput,warnings:string[]){
 return input.riskAssessment.facts.filter(f=>{const dates=[f.period.from,f.period.to,f.period.asOf,...f.evidence.flatMap(e=>[e.periodFrom,e.periodTo,e.asOf])];const ok=dates.every(d=>!d||dateEligible(d,input.asOfDate));if(!ok)warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:risk:${f.factId}`);return ok;});
}
