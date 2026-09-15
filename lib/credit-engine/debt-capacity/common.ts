import type {DebtCapacityAmountV1,DebtCapacityEvidenceRef,DebtCapacityConfidence,DebtCapacityRangeV1} from '../contracts/debt-capacity.ts';
import {id,unique,weakest,rank} from '../credit-assessment/common.ts';
export {id,unique,weakest,rank,canonical,same,stable,finiteTree,validDate} from '../credit-assessment/common.ts';
export const fail=(s:string):never=>{throw Error('DEBT_CAPACITY_INPUT_INVALID:'+s);};
export const money=(n:number):number=>{if(!Number.isFinite(n)||!Number.isFinite(n*100))fail('NONFINITE_CALCULATION');return Math.floor(n*100)/100;};
export const average=(xs:number[]):number|null=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:null;
export const median=(xs:number[]):number|null=>{if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:a[m-1]/2+a[m]/2;};
export function reference(kind:DebtCapacityEvidenceRef['kind'],path:string,value:number|null,confidence:DebtCapacityConfidence,extra:Partial<DebtCapacityEvidenceRef>={}):DebtCapacityEvidenceRef{return {referenceId:id('capacity-reference',kind,path,extra),kind,path,value,confidence,sourceMetricCode:null,month:null,obligationId:null,scheduledEventId:null,scenarioId:null,evidenceIds:[],asOf:null,...extra};}
export function refs(xs:DebtCapacityEvidenceRef[]):DebtCapacityEvidenceRef[]{return [...new Map(xs.map(x=>[x.referenceId,{...x,evidenceIds:unique(x.evidenceIds)}])).values()].sort((a,b)=>a.referenceId.localeCompare(b.referenceId));}
export function amount(value:number|null,confidence:DebtCapacityConfidence,references:DebtCapacityEvidenceRef[],calculationBasis:string,warnings:string[]=[],partial=false):DebtCapacityAmountV1{return {value,knowledge:value===null?'UNKNOWN':partial?'PARTIAL':'KNOWN',confidence:value===null?'UNKNOWN':confidence,references:refs(references),calculationBasis,warnings:unique(warnings)};}
export function range(prudential:number|null,maximumPolicy:number|null):DebtCapacityRangeV1{return {prudential,maximumPolicy,state:maximumPolicy===null?'UNKNOWN':maximumPolicy>0?'POSITIVE':'ZERO'};}
export const adequatelyKnown=(a:DebtCapacityAmountV1)=>a.value!==null&&a.knowledge==='KNOWN'&&rank(a.confidence)>=rank('MEDIUM');
export const weakestRefs=(es:DebtCapacityEvidenceRef[])=>weakest(...es.map(e=>e.confidence));
export const endOfMonth=(s:string)=>new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7)),0)).toISOString().slice(0,10);
export const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
