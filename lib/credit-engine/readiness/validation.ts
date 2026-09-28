import type {ReadinessInputV1,ReadinessPolicyV1} from '../contracts/readiness.ts';
import {READINESS_POLICY_VERSION} from '../contracts/readiness.ts';
import {PRESCORE_INDEX_VERSION,PRESCORE_INDEX_POLICY_VERSION,PRESCORE_INDEX_METHODOLOGY,INDEX_COMPONENTS} from '../contracts/index.ts';
import {INDEX_POLICY_FINGERPRINT} from '../index/policy.ts';
import {validateIndexInput} from '../index/validation.ts';
import {finiteTree,stable,validDate} from './common.ts';
const fail=(s:string):never=>{throw Error(`READINESS_INPUT_INVALID:${s}`);};
const distinct=(xs:string[],code:string)=>{if(xs.some(x=>typeof x!=='string'||!x)||new Set(xs).size!==xs.length)fail(code);};
const confidences=['HIGH','MEDIUM','LOW','UNKNOWN'];
export function validateReadinessPolicy(p:ReadinessPolicyV1):void{
 finiteTree(p);
 if(!p||p.version!==READINESS_POLICY_VERSION)fail('POLICY_VERSION');
 if(p.highIndexMinimum!==850||p.mediumIndexMinimum!==700||p.partialMaximumLevel!=='MEDIUM'||p.lowConfidenceMaximumLevel!=='MEDIUM'||p.reviewMaximumConfidence!=='MEDIUM')fail('POLICY_THRESHOLDS_OR_CAPS');
 if(stable(p.materialRiskSeverities)!==stable(['CRITICAL','HIGH','MEDIUM'])||stable(p.globalStopBehavior)!==stable({status:'NOT_RATABLE_GLOBAL_STOP',level:'NOT_READY'})||stable(p.statusMapping)!==stable({CALCULATED:'ASSESSED',PARTIAL:'PARTIAL',INSUFFICIENT_DATA:'INSUFFICIENT_DATA',NOT_RATABLE_GLOBAL_STOP:'NOT_RATABLE_GLOBAL_STOP'}))fail('POLICY_SEMANTICS');
 if(stable(p.caseRequiredFactCodes)!==stable(['CASE_requestedAmount','CASE_requestedTermMonths','CASE_financingPurpose','CASE_requestedProduct','CASE_urgency'])||stable(p.caseOptionalFactCodes)!==stable(['CASE_contractReference','CASE_collateralInformation','CASE_clientExplanation']))fail('POLICY_CASE_FIELDS');
}
export function validateReadinessInput(x:ReadinessInputV1):void{
 finiteTree({risk:x?.riskAssessment,context:x?.contextAssessment,index:x?.prescoreIndex,asOfDate:x?.asOfDate});
 try{validateIndexInput({riskAssessment:x?.riskAssessment,contextAssessment:x?.contextAssessment,asOfDate:x?.asOfDate});}catch(e){fail(`UPSTREAM:${e instanceof Error?e.message:'INVALID'}`);}
 const i=x.prescoreIndex,r=x.riskAssessment,c=x.contextAssessment;
 if(!i||i.companyInn!==r.companyInn||i.asOfDate!==x.asOfDate)fail('INDEX_COMPANY_OR_ASOF');
 if(i.version!==PRESCORE_INDEX_VERSION||i.policyVersion!==PRESCORE_INDEX_POLICY_VERSION||i.policyFingerprint!==INDEX_POLICY_FINGERPRINT||i.methodology!==PRESCORE_INDEX_METHODOLOGY||i.mode!=='SHADOW')fail('INDEX_VERSION');
 if(!['CALCULATED','PARTIAL','INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(i.status)||!confidences.includes(i.confidence)||typeof i.comparable!=='boolean')fail('INDEX_STATUS');
 const numeric=i.status==='CALCULATED'||i.status==='PARTIAL';
 if(numeric?(typeof i.value!=='number'||!Number.isInteger(i.value)||i.value<0||i.value>1000):i.value!==null)fail('INDEX_VALUE');
 if(i.status!=='CALCULATED'&&i.comparable)fail('INDEX_COMPARABILITY');
 if(!Array.isArray(i.contributions)||!Array.isArray(i.components)||!i.coverage||!Array.isArray(i.coverage.components)||!Array.isArray(i.globalStopFindingIds)||!Array.isArray(i.globalStopEvidence))fail('INDEX_SHAPE');
 distinct(i.components.map(c=>c.component),'INDEX_COMPONENTS');distinct(i.coverage.components.map(c=>c.component),'INDEX_COVERAGE');
 if(i.components.length!==4||i.coverage.components.length!==4||i.components.some(c=>!INDEX_COMPONENTS.includes(c.component)||!confidences.includes(c.confidence))||i.coverage.components.some(c=>!INDEX_COMPONENTS.includes(c.component)||!['ADEQUATE','LIMITED','INSUFFICIENT'].includes(c.state)||!confidences.includes(c.confidence)))fail('INDEX_COMPONENTS_OR_COVERAGE');
 distinct(i.contributions.map(c=>c.contributionId),'DUPLICATE_CONTRIBUTION');distinct(i.contributions.map(c=>c.riskFindingId),'DUPLICATE_CONTRIBUTION_SOURCE');
 const findings=new Map(r.findings.map(f=>[f.findingId,f])),relations=new Map(c.relations.map(r=>[r.relationId,r]));
 for(const v of i.contributions){const f=findings.get(v.riskFindingId);if(!f||f.code!==v.riskCode||f.scope!=='CREDIT_RISK'||v.scope!==f.scope||v.severity!==f.severity||!INDEX_COMPONENTS.includes(v.component)||!confidences.includes(v.evidenceConfidence)||!Array.isArray(v.contextRelationIds)||v.contextRelationIds.some(id=>!relations.get(id)?.targetRiskFindingIds.includes(f.findingId)))fail('INDEX_CONTRIBUTION_LINEAGE');}
 const stops=r.findings.filter(f=>f.scope==='GLOBAL_STOP').map(f=>f.findingId).sort();
 distinct(i.globalStopFindingIds,'DUPLICATE_GLOBAL_STOP');
 if((i.status==='NOT_RATABLE_GLOBAL_STOP')!==(stops.length>0)||stable([...i.globalStopFindingIds].sort())!==stable(stops))fail('GLOBAL_STOP_STATE');
 for(const f of r.findings){distinct(f.factIds,'DUPLICATE_FINDING_FACT');if(f.evidence.some(e=>!confidences.includes(e.confidence)))fail('FINDING_EVIDENCE_CONFIDENCE');}
 for(const rel of c.relations){distinct(rel.targetRiskFindingIds,'DUPLICATE_RELATION_TARGET');distinct(rel.contextFactIds,'DUPLICATE_RELATION_FACT');}
 distinct(c.facts.filter(f=>f.semanticCode.startsWith('CASE_')).map(f=>f.semanticCode),'DUPLICATE_CASE_FACT');
 // Availability metadata only: future maturity/contract values are not evidence dates.
 for(const e of i.globalStopEvidence)for(const d of [e.asOf,e.periodFrom,e.periodTo])if(d&&(!validDate(d.slice(0,10))||d.slice(0,10)>x.asOfDate))fail('FUTURE_INDEX_EVIDENCE');
}
