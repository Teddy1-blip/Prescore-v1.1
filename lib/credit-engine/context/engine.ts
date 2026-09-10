import {CONTEXT_ENGINE_VERSION,CONTEXT_RULES_VERSION,CONTEXT_METHODOLOGY,type ContextShadowInput,type ContextFactV1,type ContextRule,type ContextRuleEvaluation,type ContextRelationV1,type ContextAssessmentV1,type ContextSummary} from '../contracts/context.ts';
import {RISK_ENGINE_VERSION,RISK_REGISTRY_VERSION,type RiskFinding} from '../contracts/risk.ts';
import {adaptContextFacts} from './facts.ts';
import {id,unique,rank,weakest,validDate,dateEligible} from './common.ts';
import {CONTEXT_RULE_REGISTRY} from './rules/registry.ts';
export function validateContextInput(input:ContextShadowInput){
 const r=input?.riskAssessment;
 if(!r||r.version!==RISK_ENGINE_VERSION||r.ruleRegistryVersion!==RISK_REGISTRY_VERSION||r.mode!=='SHADOW'||!Array.isArray(r.facts)||!Array.isArray(r.findings)||!Array.isArray(r.evaluations)||!r.summary||typeof r.summary.evaluatedRuleCount!=='number')throw Error('CONTEXT_RISK_INPUT_UNAVAILABLE');
 if(!validDate(input.asOfDate)||!/^\d{10}(\d{2})?$/.test(input.analysis?.companyInn??'')||r.companyInn!==input.analysis.companyInn||r.asOfDate!==input.asOfDate||input.companyProfile&&input.companyProfile.inn!==r.companyInn)throw Error('CONTEXT_INPUT_MISMATCH');
 for(const f of r.facts)if(!f||!f.factId||!f.semanticCode||f.companyInn!==r.companyInn||!f.period||!Array.isArray(f.evidence)||!Array.isArray(f.sourceIds)||!['KNOWN','PARTIAL','UNKNOWN','NOT_APPLICABLE'].includes(f.status)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(f.confidence)||f.status==='UNKNOWN'&&f.value!==null||typeof f.value==='number'&&!Number.isFinite(f.value))throw Error('CONTEXT_RISK_INPUT_UNAVAILABLE');
 if(new Set(r.facts.map(f=>f.factId)).size!==r.facts.length||new Set(r.findings.map(f=>f.findingId)).size!==r.findings.length)throw Error('CONTEXT_INPUT_MISMATCH');
 for(const f of r.findings)if(!f||!f.findingId||!f.code||!Array.isArray(f.factIds)||!Array.isArray(f.evidence)||!['HIGH','MEDIUM','LOW','UNKNOWN'].includes(f.evidenceConfidence)||!['GLOBAL_STOP','CREDIT_RISK','DATA_REVIEW','INFORMATION'].includes(f.scope)||!['CRITICAL','HIGH','MEDIUM','LOW','INFO'].includes(f.severity)||!['BLOCKING','REVIEW','NON_BLOCKING'].includes(f.decisionImpact)||f.factIds.some(fid=>!r.facts.some(x=>x.factId===fid)))throw Error('CONTEXT_RISK_INPUT_UNAVAILABLE');
}
export function evaluateContextRules(facts:ContextFactV1[],findings:RiskFinding[],rules:ContextRule[]=CONTEXT_RULE_REGISTRY):ContextRuleEvaluation[]{
 const index=new Map<string,ContextFactV1[]>();for(const f of facts)index.set(f.semanticCode,[...(index.get(f.semanticCode)??[]),f]);
 const out:ContextRuleEvaluation[]=[];
 for(const rule of rules){const subjects=rule.perSubject?unique(rule.requiredInputs.flatMap(c=>(index.get(c)??[]).flatMap(f=>f.subjectKey?[f.subjectKey]:[]))):[''];if(!subjects.length)subjects.push('');
 for(const subject of subjects){const fs=rule.requiredInputs.map(c=>(index.get(c)??[]).filter(f=>!rule.perSubject||f.subjectKey===subject));const selected=fs.flat();
 const targets=findings.filter(f=>rule.targetRiskCodes.includes(f.code)&&(!rule.perSubject||!f.subjectKey&&!f.portfolioObligationId||(f.subjectKey??f.portfolioObligationId)===subject));
 const inadequate=fs.some(xs=>xs.length!==1||xs[0].status!=='KNOWN'||xs[0].value===null||rank(xs[0].confidence)<(['EXPLAINS','REQUIRES_REVIEW','NEUTRAL'].includes(rule.effect)?1:2));
 let status:ContextRuleEvaluation['status']=rule.targetRiskCodes.length&&!targets.length?'NOT_APPLICABLE':inadequate?'INSUFFICIENT_DATA':'NOT_SUPPORTED';
 if(status==='NOT_SUPPORTED'){
 if(rule.code==='CTX-SEASONALITY-ELIGIBILITY'&&selected[0].value!==1)status='INSUFFICIENT_DATA';
 else if(rule.effect==='MITIGATES'&&selected.every(f=>f.sourceClass==='CLIENT_DECLARED'))status='INSUFFICIENT_DATA';
 else if(rule.evaluate(selected))status='SUPPORTED';}
 out.push({ruleCode:rule.code,ruleVersion:rule.version,domain:rule.domain,status,contextFactIds:unique(selected.map(f=>f.factId)),targetRiskFindingIds:unique(targets.map(f=>f.findingId)),...(subject?{subjectKey:subject}:{}),reasonCodes:[status==='SUPPORTED'?`${rule.code}_SUPPORTED`:status==='INSUFFICIENT_DATA'?'CONTEXT_EVIDENCE_INSUFFICIENT':status==='NOT_APPLICABLE'?'TARGET_RISK_NOT_PRESENT':'CONTEXT_NOT_SUPPORTED'],calculationBasis:rule.calculationBasis});
 }}
 return out.sort((a,b)=>a.domain.localeCompare(b.domain)||a.ruleCode.localeCompare(b.ruleCode)||(a.subjectKey??'').localeCompare(b.subjectKey??''));
}
export function constructContextRelations(evaluations:ContextRuleEvaluation[],facts:ContextFactV1[],findings:RiskFinding[],rules:ContextRule[]=CONTEXT_RULE_REGISTRY):ContextRelationV1[]{
 const fm=new Map(facts.map(f=>[f.factId,f])),rm=new Map(rules.map(r=>[r.code,r])),targets=new Map(findings.map(f=>[f.findingId,f]));
 return evaluations.filter(e=>e.status==='SUPPORTED').map(e=>{const rule=rm.get(e.ruleCode)!,fs=e.contextFactIds.map(x=>fm.get(x)!),ts=e.targetRiskFindingIds.map(x=>targets.get(x)!);return {relationId:id('context-relation',e.ruleCode,e.subjectKey??'',e.contextFactIds,e.targetRiskFindingIds,rule.effect),code:e.ruleCode,ruleVersion:e.ruleVersion,domain:e.domain,effect:rule.effect,targetRiskFindingIds:e.targetRiskFindingIds,targetRiskCodes:unique(ts.map(t=>t.code)),contextFactIds:e.contextFactIds,...(e.subjectKey?{subjectKey:e.subjectKey}:{}),evidenceConfidence:weakest(...fs.map(f=>f.confidence),...ts.map(t=>t.evidenceConfidence)),reasonCodes:e.reasonCodes,calculationBasis:e.calculationBasis,warnings:unique([...fs.flatMap(f=>f.warnings),...(rule.effect==='MITIGATES'?['RISK_FINDING_UNCHANGED','MITIGATION_IS_CONTEXT_ONLY']:[])])};}).sort((a,b)=>a.domain.localeCompare(b.domain)||a.code.localeCompare(b.code)||a.effect.localeCompare(b.effect)||(a.subjectKey??'').localeCompare(b.subjectKey??'')||a.relationId.localeCompare(b.relationId));
}
export function summarizeContext(evaluations:ContextRuleEvaluation[],relations:ContextRelationV1[],findingCount:number):ContextSummary{
 const count=(e:ContextRelationV1['effect'])=>relations.filter(r=>r.effect===e).length,withContext=new Set(relations.flatMap(r=>r.targetRiskFindingIds)).size;
 return {evaluatedRuleCount:evaluations.length,supportedRelationCount:relations.length,corroboratingCount:count('CORROBORATES'),mitigatingCount:count('MITIGATES'),explanatoryCount:count('EXPLAINS'),neutralCount:count('NEUTRAL'),requiresReviewCount:count('REQUIRES_REVIEW'),riskFindingsWithContextCount:withContext,riskFindingsWithoutContextCount:findingCount-withContext,evidenceConfidence:weakest(...relations.map(r=>r.evidenceConfidence)),warnings:['CONTEXT_NOT_A_SCORE','RISK_FINDINGS_UNCHANGED']};
}
export function buildContextAssessment(input:ContextShadowInput):ContextAssessmentV1{
 validateContextInput(input);const {facts,warnings}=adaptContextFacts(input);
 const findings=input.riskAssessment.findings.filter(f=>{const ok=f.evidence.every(e=>[e.asOf,e.periodFrom,e.periodTo].every(d=>!d||dateEligible(d,input.asOfDate)));if(!ok)warnings.push(`CONTEXT_FUTURE_INFORMATION_EXCLUDED:target:${f.findingId}`);return ok;});
 const evaluations=evaluateContextRules(facts,findings),relations=constructContextRelations(evaluations,facts,findings),summary=summarizeContext(evaluations,relations,input.riskAssessment.findings.length);
 return {version:CONTEXT_ENGINE_VERSION,ruleRegistryVersion:CONTEXT_RULES_VERSION,methodology:CONTEXT_METHODOLOGY,mode:'SHADOW',companyInn:input.analysis.companyInn,asOfDate:input.asOfDate,facts,evaluations,relations,summary,warnings:unique(['CONTEXT_SHADOW_ONLY',...warnings])};
}
