import type {ContextFactV1,ContextConfidence,ContextValue,ContextDomain} from '../contracts/context.ts';
import {id,stable,validDate} from '../credit-lab/common.ts';
export {id,stable,validDate};
export const unique=(xs:string[])=>[...new Set(xs)].sort();
export const rank=(x:ContextConfidence)=>({UNKNOWN:0,LOW:1,MEDIUM:2,HIGH:3}[x]??0);
export const weakest=(...xs:ContextConfidence[]):ContextConfidence=>xs.length?['UNKNOWN','LOW','MEDIUM','HIGH'][Math.min(...xs.map(rank))] as ContextConfidence:'UNKNOWN';
export const dateEligible=(d:string|null|undefined,cutoff:string)=>!!d&&validDate(d.slice(0,10))&&d.slice(0,10)<=cutoff;
export function contextFact(companyInn:string,semanticCode:string,domain:ContextDomain,value:ContextValue,extra:Partial<ContextFactV1>={}):ContextFactV1{
 const f:ContextFactV1={factId:'',semanticCode,domain,companyInn,value,unit:'TEXT',status:value==null?'UNKNOWN':'KNOWN',confidence:'UNKNOWN',sourceClass:'CANONICAL_OBSERVED',period:{from:null,to:null,asOf:null},sourceIds:[],sourceMetricCodes:[],sourceRiskFactIds:[],portfolioObligationIds:[],reconciliationFindingIds:[],evidence:[],calculationBasis:'Canonical context observation; no scoring adjustment',warnings:[],...extra};
 if(f.value==null||typeof f.value==='number'&&!Number.isFinite(f.value)||['UNKNOWN','NOT_APPLICABLE'].includes(f.status)){f.value=null;if(f.status!=='NOT_APPLICABLE')f.status='UNKNOWN';}
 f.confidence=weakest(f.confidence,...f.evidence.map(e=>e.confidence),...(f.sourceClass==='CLIENT_DECLARED'?['MEDIUM' as const]:[]));if(!f.evidence.length)f.confidence='UNKNOWN';
 for(const k of ['sourceIds','sourceMetricCodes','sourceRiskFactIds','portfolioObligationIds','reconciliationFindingIds','warnings']as const)f[k]=unique(f[k]);
 f.evidence=[...f.evidence].sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId));f.factId=id('context-fact',companyInn,semanticCode,f.subjectKey??'',f.period,f.value,f.sourceIds,f.sourceRiskFactIds);return f;
}
export const usable=(f:ContextFactV1|undefined)=>!!f&&f.status==='KNOWN'&&f.value!==null&&rank(f.confidence)>=2;
export const independent=(a:ContextFactV1,b:ContextFactV1)=>a.sourceIds.length>0&&b.sourceIds.length>0&&!a.sourceIds.some(s=>b.sourceIds.includes(s));
