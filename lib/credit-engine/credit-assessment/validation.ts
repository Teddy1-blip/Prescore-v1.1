import type {CreditAssessmentInputV1,CreditAssessmentPolicyV1} from '../contracts/credit-assessment.ts';
import {FINANCING_READINESS_VERSION,READINESS_METHODOLOGY} from '../contracts/readiness.ts';
import {READINESS_POLICY,READINESS_POLICY_FINGERPRINT} from '../readiness/policy.ts';
import {validateReadinessInput} from '../readiness/validation.ts';
import {resolveIndexComponent} from '../index/policy.ts';
import {CREDIT_ASSESSMENT_POLICY} from './policy.ts';
import {same,stable,finiteTree,rank,validDate} from './common.ts';
const fail=(s:string):never=>{throw Error(`CREDIT_ASSESSMENT_INPUT_INVALID:${s}`);};
const distinct=(xs:string[],why:string)=>{if(xs.some(s=>typeof s!=='string'||!s)||new Set(xs).size!==xs.length)fail(why);};
const confidences=['HIGH','MEDIUM','LOW','UNKNOWN'];
export function validateAssessmentPolicy(p:CreditAssessmentPolicyV1){if(stable(p)!==stable(CREDIT_ASSESSMENT_POLICY))fail('POLICY');}
export function validateAssessmentInput(x:CreditAssessmentInputV1){
 try{finiteTree({risk:x?.riskAssessment,context:x?.contextAssessment,index:x?.prescoreIndex,readiness:x?.financingReadiness});validateReadinessInput({riskAssessment:x?.riskAssessment,contextAssessment:x?.contextAssessment,prescoreIndex:x?.prescoreIndex,asOfDate:x?.asOfDate});}catch(e){fail(`UPSTREAM:${e instanceof Error?e.message:'INVALID'}`);}
 const r=x.riskAssessment,c=x.contextAssessment,i=x.prescoreIndex,y=x.financingReadiness;
 if(!y||y.companyInn!==r.companyInn||y.asOfDate!==x.asOfDate)fail('READINESS_COMPANY_OR_ASOF');
 if(y.version!==FINANCING_READINESS_VERSION||y.policyVersion!==READINESS_POLICY.version||y.policyFingerprint!==READINESS_POLICY_FINGERPRINT||y.methodology!==READINESS_METHODOLOGY||y.mode!=='SHADOW')fail('READINESS_VERSION');
 if(!['ASSESSED','PARTIAL','INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(y.status)||!['HIGH','MEDIUM','LOW','NOT_READY','UNKNOWN'].includes(y.level)||!['HIGH','MEDIUM','LOW','NOT_READY','UNKNOWN'].includes(y.baseLevel)||!confidences.includes(y.confidence)||rank(y.confidence)>rank(i.confidence)||typeof y.comparable!=='boolean')fail('READINESS_STATE');
 if(!same(y.indexReference,{version:i.version,policyVersion:i.policyVersion,policyFingerprint:i.policyFingerprint,value:i.value,status:i.status}))fail('READINESS_INDEX_REFERENCE');
 const global=i.status==='NOT_RATABLE_GLOBAL_STOP',insufficient=i.status==='INSUFFICIENT_DATA';
 if(global?(y.status!=='NOT_RATABLE_GLOBAL_STOP'||y.level!=='NOT_READY'||y.baseLevel!=='NOT_READY'):insufficient?(y.status!=='INSUFFICIENT_DATA'||y.level!=='UNKNOWN'||y.baseLevel!=='UNKNOWN'):(!['ASSESSED','PARTIAL'].includes(y.status)||!['HIGH','MEDIUM','LOW'].includes(y.level)||!['HIGH','MEDIUM','LOW'].includes(y.baseLevel)))fail('STATUS_COMBINATION');
 if(i.status==='PARTIAL'&&y.status!=='PARTIAL'||y.comparable&&(y.status!=='ASSESSED'||!i.comparable))fail('READINESS_COMPARABILITY');
 if(!Array.isArray(y.constraints)||!Array.isArray(y.contextExplanations)||!y.caseDefinition||!y.summary)fail('READINESS_SHAPE');
 distinct(y.constraints.map(v=>v.constraintId),'DUPLICATE_READINESS_CONSTRAINT');distinct(y.constraints.map(v=>v.kind+':'+v.sourceId),'DUPLICATE_CONSTRAINT_SOURCE');
 const findings=new Map(r.findings.map(f=>[f.findingId,f])),relations=new Map(c.relations.map(v=>[v.relationId,v])),facts=new Map(c.facts.map(f=>[f.factId,f]));
 const expectedScored=r.findings.filter(f=>!global&&f.scope==='CREDIT_RISK'&&resolveIndexComponent(f.code,f.domain)).map(f=>f.findingId);
 if(!same(expectedScored,i.contributions.map(v=>v.riskFindingId)))fail('CONTRIBUTION_COMPLETENESS');
 for(const v of i.contributions){if([v.basePenaltyPoints,v.finalPenaltyPoints].some(n=>typeof n!=='number'||n<0)||typeof v.contextModifierPercent!=='number'||Math.abs(v.contextModifierPercent)>100)fail('CONTRIBUTION_NUMERIC_SHAPE');const f=findings.get(v.riskFindingId)!;if(v.component!==resolveIndexComponent(f.code,f.domain))fail('CONTRIBUTION_COMPONENT');distinct(v.contextRelationIds,'DUPLICATE_CONTRIBUTION_CONTEXT');for(const rid of v.contextRelationIds){const rel=relations.get(rid)!;if(!['MITIGATES','CORROBORATES'].includes(rel.effect)||rank(rel.evidenceConfidence)<2||!rel.contextFactIds.length||rel.contextFactIds.some(fid=>{const fact=facts.get(fid)!;return fact.status!=='KNOWN'||rank(fact.confidence)<2||fact.sourceClass==='CLIENT_DECLARED'||!fact.evidence.length||fact.evidence.some(e=>rank(e.confidence)<2||e.sourceClass==='CLIENT_DECLARED');}))fail('CONTRIBUTION_CONTEXT_ELIGIBILITY');}}
 for(const rel of c.relations)if(rel.subjectKey&&rel.targetRiskFindingIds.some(fid=>{const f=findings.get(fid)!;const subject=f.subjectKey??f.portfolioObligationId;return !!subject&&subject!==rel.subjectKey;}))fail('CONTEXT_SUBJECT_TARGET');
 for(const v of y.constraints){if(!confidences.includes(v.evidenceConfidence))fail('CONSTRAINT_CONFIDENCE');const origin=v.kind==='CONTEXT_REVIEW'?relations.get(v.sourceId):findings.get(v.sourceId);if(origin&&(v.subjectKey!==(origin.subjectKey??('portfolioObligationId' in origin?origin.portfolioObligationId:null)??null)||rank(v.evidenceConfidence)>rank(origin.evidenceConfidence)))fail('CONSTRAINT_SUBJECT_OR_CONFIDENCE');
 if(v.kind==='CONTEXT_REVIEW'){const rel=relations.get(v.sourceId);if(!rel||rel.effect!=='REQUIRES_REVIEW'||v.sourceCode!==rel.code||!same(v.contextRelationIds,[rel.relationId])||!same(v.riskFindingIds,rel.targetRiskFindingIds)||!same(v.reasonCodes,rel.reasonCodes)||v.impact!=='LIMITS_ASSESSMENT'||!same(v.evidence,rel.contextFactIds.flatMap(fid=>facts.get(fid)!.evidence)))fail('CONSTRAINT_CONTEXT_LINEAGE');}
 else{const f=findings.get(v.sourceId);if(!f||f.scope==='INFORMATION'||v.kind!==f.scope||v.sourceCode!==f.code||v.severity!==f.severity||!same(v.riskFindingIds,[f.findingId])||v.contextRelationIds.length||!same(v.reasonCodes,f.reasonCodes)||!same(v.evidence,f.evidence)||v.impact!==(f.scope==='GLOBAL_STOP'?'BLOCKS_READINESS':f.scope==='CREDIT_RISK'?'REFLECTED_IN_INDEX':'LIMITS_ASSESSMENT'))fail('CONSTRAINT_RISK_LINEAGE');}
 }
 const expectedConstraints=[...r.findings.filter(f=>f.scope!=='INFORMATION').map(f=>f.scope+':'+f.findingId),...c.relations.filter(rel=>rel.effect==='REQUIRES_REVIEW').map(rel=>'CONTEXT_REVIEW:'+rel.relationId)];if(!same(expectedConstraints,y.constraints.map(v=>v.kind+':'+v.sourceId)))fail('CONSTRAINT_COMPLETENESS');
 for(const e of y.contextExplanations){const rel=relations.get(e.relationId);if(!rel||rel.effect==='REQUIRES_REVIEW'||e.effect!==rel.effect||e.sourceCode!==rel.code||!same(e.riskFindingIds,rel.targetRiskFindingIds)||!same(e.contextFactIds,rel.contextFactIds))fail('READINESS_CONTEXT_LINEAGE');}
 if(!same(y.contextExplanations.map(e=>e.relationId),c.relations.filter(rel=>rel.effect!=='REQUIRES_REVIEW').map(rel=>rel.relationId)))fail('READINESS_CONTEXT_COMPLETENESS');
 const caseCodes=[...READINESS_POLICY.caseRequiredFactCodes,...READINESS_POLICY.caseOptionalFactCodes];if(!same(y.caseDefinition.facts,c.facts.filter(f=>caseCodes.includes(f.semanticCode)))||!['DEFINED','PARTIAL','NOT_PROVIDED'].includes(y.caseDefinition.status))fail('CASE_LINEAGE');
 for(const key of ['status','level','baseLevel','confidence','comparable','uncertaintyCapApplied','uncertaintyCapReasons'] as const)if(!same(y[key],y.summary[key]))fail('READINESS_SUMMARY');
 if(y.summary.indexValue!==i.value||y.summary.indexStatus!==i.status||y.summary.caseDefinitionStatus!==y.caseDefinition.status)fail('READINESS_SUMMARY_REFERENCE');
 // Any duplicated readiness evidence still has to obey the common explicit cutoff.
 const inspect=(v:unknown):void=>{if(v&&typeof v==='object'){for(const [k,val]of Object.entries(v)){if(['asOf','observedAt','periodFrom','periodTo'].includes(k)&&typeof val==='string'&&(!validDate(val.slice(0,10))||val.slice(0,10)>x.asOfDate))fail('FUTURE_READINESS_EVIDENCE');inspect(val);}}};inspect(y);
}
