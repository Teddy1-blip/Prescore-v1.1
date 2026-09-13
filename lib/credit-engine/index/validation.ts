import {RISK_RULE_REGISTRY} from '../risk/rules/registry.ts';
import {PRESCORE_INDEX_POLICY_VERSION,INDEX_COMPONENTS,type PrescoreIndexInputV1,type IndexPolicyV1} from '../contracts/index.ts';
import {RISK_ENGINE_VERSION,RISK_REGISTRY_VERSION} from '../contracts/risk.ts';
import {CONTEXT_ENGINE_VERSION,CONTEXT_RULES_VERSION,CONTEXT_METHODOLOGY} from '../contracts/context.ts';
import {validDate,stable} from './common.ts';
const fail=(s:string):never=>{throw Error(`INDEX_INPUT_INVALID:${s}`);};
function finiteTree(x:unknown){if(typeof x==='number'&&!Number.isFinite(x))fail('NONFINITE');if(x&&typeof x==='object')for(const v of Object.values(x))finiteTree(v);}
const dates=(ds:Array<string|null|undefined>,cutoff:string)=>{for(const d of ds)if(d&&(!validDate(d.slice(0,10))||d.slice(0,10)>cutoff))fail('FUTURE_OR_INVALID_EVIDENCE_DATE');};
const distinct=(xs:string[],code:string)=>{if(xs.some(x=>typeof x!=='string'||!x)||new Set(xs).size!==xs.length)fail(code);};
export function validateIndexPolicy(p:IndexPolicyV1){
 if(!p.findingCodeComponentOverrides||typeof p.findingCodeComponentOverrides!=='object'||Array.isArray(p.findingCodeComponentOverrides))fail('POLICY_OVERRIDES');
 for(const [code,component] of Object.entries(p.findingCodeComponentOverrides))if(!RISK_RULE_REGISTRY.some(r=>r.code===code)||!INDEX_COMPONENTS.includes(component))fail('POLICY_OVERRIDES');
 finiteTree(p);if(p.version!==PRESCORE_INDEX_POLICY_VERSION)fail('POLICY_VERSION');
 if(INDEX_COMPONENTS.reduce((n,c)=>n+p.componentMaximums[c],0)!==1000||INDEX_COMPONENTS.some(c=>p.componentMaximums[c]<=0))fail('COMPONENT_MAXIMUMS');
 const ordered=['INFO','LOW','MEDIUM','HIGH','CRITICAL']as const;for(let i=0;i<ordered.length;i++){const s=ordered[i];if(p.severityPenaltyRatios[s]<0||p.severityPenaltyRatios[s]>1||p.riskSeverityCeilings[s]<0||p.riskSeverityCeilings[s]>1000)fail('POLICY_POINTS');if(i&&(p.severityPenaltyRatios[s]<p.severityPenaltyRatios[ordered[i-1]]||p.riskSeverityCeilings[s]>p.riskSeverityCeilings[ordered[i-1]]))fail('POLICY_MONOTONICITY');}
 if(stable(p.scoreableScopes)!==stable(['CREDIT_RISK'])||p.contextModifiers.CORROBORATES<0||p.contextModifiers.MITIGATES>0||p.maximumContextAdjustment<0||p.maximumContextAdjustment>1)fail('POLICY_SCOPE_OR_MODIFIER');
 for(const c of INDEX_COMPONENTS){const v=p.coverage[c];if(!v||v.minimumKnown<1||v.adequateKnown<v.minimumKnown||v.adequateKnown>v.requiredFactCodes.length)fail('COVERAGE_POLICY');}
 if(p.rounding.pointDecimals!==2||p.rounding.finalDecimals!==0)fail('ROUNDING_POLICY');
}
export function validateIndexInput(input:PrescoreIndexInputV1){
 finiteTree(input);const r=input?.riskAssessment,c=input?.contextAssessment;
 if(!r||!c||!validDate(input.asOfDate)||r.companyInn!==c.companyInn||!/^\d{10}(\d{2})?$/.test(r.companyInn)||r.asOfDate!==c.asOfDate||r.asOfDate!==input.asOfDate)fail('COMPANY_OR_ASOF');
 if(r.version!==RISK_ENGINE_VERSION||r.ruleRegistryVersion!==RISK_REGISTRY_VERSION||r.mode!=='SHADOW'||c.version!==CONTEXT_ENGINE_VERSION||c.ruleRegistryVersion!==CONTEXT_RULES_VERSION||c.methodology!==CONTEXT_METHODOLOGY||c.mode!=='SHADOW')fail('VERSION');
 if(!Array.isArray(r.findings)||!Array.isArray(r.facts)||!Array.isArray(c.facts)||!Array.isArray(c.relations)||!r.summary||!c.summary)fail('SHAPE');
 distinct(r.findings.map(f=>f.findingId),'DUPLICATE_FINDING_ID');distinct(r.facts.map(f=>f.factId),'DUPLICATE_RISK_FACT');distinct(c.facts.map(f=>f.factId),'DUPLICATE_CONTEXT_FACT');distinct(c.relations.map(f=>f.relationId),'DUPLICATE_RELATION_ID');
 if(!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(r.summary.evidenceConfidence))fail('SUMMARY_CONFIDENCE');
 for(const f of c.facts){if(!['CANONICAL_OBSERVED','DOCUMENT_REPORTED','CLIENT_DECLARED','DERIVED_RELATIONSHIP'].includes(f.sourceClass)||f.evidence.some(e=>!['CANONICAL_OBSERVED','DOCUMENT_REPORTED','CLIENT_DECLARED','DERIVED_RELATIONSHIP'].includes(e.sourceClass)))fail('CONTEXT_SOURCE_CLASS');}
 const rid=new Set(r.facts.map(f=>f.factId)),findings=new Map(r.findings.map(f=>[f.findingId,f])),cid=new Set(c.facts.map(f=>f.factId));
 distinct(r.findings.map(f=>stable([f.code,f.subjectKey??f.portfolioObligationId??''])),'DUPLICATE_FINDING_IDENTITY');
 distinct(c.relations.map(f=>stable([f.code,[...f.targetRiskFindingIds].sort(),[...f.contextFactIds].sort(),f.effect,f.subjectKey??''])),'DUPLICATE_RELATION_IDENTITY');
 for(const f of [...r.facts,...c.facts]){if(f.companyInn!==r.companyInn||!['KNOWN','PARTIAL','UNKNOWN','NOT_APPLICABLE'].includes(f.status)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(f.confidence)||!f.period||!Array.isArray(f.evidence)||!Array.isArray(f.sourceIds)||['UNKNOWN','NOT_APPLICABLE'].includes(f.status)&&f.value!==null||f.status==='KNOWN'&&f.value===null)fail('FACT_STATUS_OR_COMPANY');dates([f.period.from,f.period.to,f.period.asOf],input.asOfDate);for(const e of f.evidence){dates([e.asOf,e.periodFrom,e.periodTo],input.asOfDate);if(!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(e.confidence))fail('EVIDENCE_CONFIDENCE');}}
 for(const f of r.findings){if(f.ruleVersion!==RISK_REGISTRY_VERSION||!f.code||!['CREDIT_RISK','GLOBAL_STOP','DATA_REVIEW','INFORMATION'].includes(f.scope)||!['CRITICAL','HIGH','MEDIUM','LOW','INFO'].includes(f.severity)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(f.evidenceConfidence)||!Array.isArray(f.factIds)||!Array.isArray(f.evidence)||!Array.isArray(f.reasonCodes)||f.factIds.some(id=>!rid.has(id)))fail('FINDING_SHAPE_OR_LINEAGE');for(const e of f.evidence)dates([e.asOf,e.periodFrom,e.periodTo],input.asOfDate);}
 for(const rel of c.relations){const extra=rel as unknown as Record<string,unknown>;if(extra.companyInn!==undefined&&extra.companyInn!==r.companyInn)fail('RELATION_COMPANY');if(extra.asOfDate!==undefined&&extra.asOfDate!==input.asOfDate)fail('RELATION_ASOF');if(rel.ruleVersion!==CONTEXT_RULES_VERSION||!['CORROBORATES','MITIGATES','EXPLAINS','NEUTRAL','REQUIRES_REVIEW'].includes(rel.effect)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(rel.evidenceConfidence)||!rel.code||!Array.isArray(rel.contextFactIds)||rel.contextFactIds.some(id=>!cid.has(id))||rel.targetRiskFindingIds.some(id=>!findings.has(id))||rel.targetRiskFindingIds.some(id=>!rel.targetRiskCodes.includes(findings.get(id)!.code)))fail('RELATION_LINEAGE');}
 const gs=r.findings.filter(f=>f.scope==='GLOBAL_STOP');if(!['TRIGGERED','INSUFFICIENT_DATA','NOT_TRIGGERED_WITH_AVAILABLE_DATA'].includes(r.summary.globalStopStatus)||(gs.length>0)!==(r.summary.globalStopStatus==='TRIGGERED'))fail('GLOBAL_STOP_STATUS');
 if(r.facts.some(f=>f.semanticCode==='BKI_SCOPE_EXCLUDED'&&f.value===true)&&r.findings.some(f=>f.scope==='CREDIT_RISK'&&f.domain==='CREDIT_HISTORY'))fail('PERSONAL_BKI_BORROWER_FINDING');
}
