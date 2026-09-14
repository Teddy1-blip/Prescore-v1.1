import {baseline as indexBaseline,finding,relation,removeCore,rawProfile,material} from '../index/builders.mjs';
import {entries as indexEntries} from '../index/golden-index-pack-v1.mjs';
import {input as contextInput,financingCase,field} from '../context/builders.mjs';
import {buildContextAssessment} from '../../../lib/credit-engine/context/engine.ts';
import {buildPrescoreIndex} from '../../../lib/credit-engine/index/engine.ts';
export {finding,relation,removeCore,material,rawProfile,financingCase,field};
export function compose(x=indexBaseline()){return {...x,prescoreIndex:buildPrescoreIndex(x)};}
export function baseline(){return compose();}
export function fromIndex(n){const e=indexEntries().find(e=>e.caseId===(typeof n==='number'?`IDX-RU-${String(n).padStart(3,'0')}`:n));return compose(structuredClone(e.input));}
// Independently specified canonical Index scalar boundary. No Readiness output is used.
// These fixtures test the consuming contract; they do not claim this exact scalar was
// produced by this particular Risk fixture or recalibrate upstream Index methodology.
export function boundary(value,status='CALCULATED',confidence='HIGH'){const x=baseline();Object.assign(x.prescoreIndex,{value,status,confidence,comparable:status==='CALCULATED'});return x;}
export function withCase(extra={}){const c=financingCase(extra),v=contextInput(material(),c);return compose({riskAssessment:v.riskAssessment,contextAssessment:buildContextAssessment(v),asOfDate:v.asOfDate});}
export function withRisk(options={}){const x=indexBaseline();finding(x,options);return compose(x);}
export function withRelation(effect,options={}){const x=indexBaseline(),f=finding(x,{code:'SYN-READINESS-FINANCIAL'});relation(x,f,{effect,...options});return compose(x);}
export function reorder(x){const y=structuredClone(x);for(const a of [y.riskAssessment.facts,y.riskAssessment.findings,y.contextAssessment.facts,y.contextAssessment.relations,y.prescoreIndex.components,y.prescoreIndex.contributions,y.prescoreIndex.coverage.components,y.prescoreIndex.globalStopEvidence,y.prescoreIndex.globalStopFindingIds])a.reverse();for(const f of [...y.riskAssessment.facts,...y.riskAssessment.findings,...y.contextAssessment.facts])f.evidence?.reverse();for(const r of y.contextAssessment.relations){r.contextFactIds.reverse();r.targetRiskFindingIds.reverse();r.targetRiskCodes.reverse();}return y;}
