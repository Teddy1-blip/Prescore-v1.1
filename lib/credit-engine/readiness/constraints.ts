import type {ReadinessInputV1,ReadinessConstraintV1,ReadinessPolicyV1,ReadinessContextExplanationV1} from '../contracts/readiness.ts';
import type {RiskEvidenceRef} from '../contracts/risk.ts';
import {READINESS_POLICY} from './policy.ts';
import {id,unique,weakest,stable,canonicalClone} from './common.ts';
const kinds=['GLOBAL_STOP','CREDIT_RISK','DATA_REVIEW','CONTEXT_REVIEW'];
const severities=['CRITICAL','HIGH','MEDIUM','LOW','INFO'];
const evidence=(es:RiskEvidenceRef[])=>es.map(canonicalClone).sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId)||stable(a).localeCompare(stable(b)));
export function readinessConstraints(x:ReadinessInputV1,p:ReadinessPolicyV1=READINESS_POLICY):ReadinessConstraintV1[]{
 const out:ReadinessConstraintV1[]=[];
 for(const f of x.riskAssessment.findings){if(f.scope==='INFORMATION')continue;
 const kind=f.scope,impact=kind==='GLOBAL_STOP'?'BLOCKS_READINESS':kind==='CREDIT_RISK'?'REFLECTED_IN_INDEX':'LIMITS_ASSESSMENT';
 out.push({constraintId:id('readiness-constraint',x.riskAssessment.companyInn,kind,f.findingId),kind,sourceId:f.findingId,sourceCode:f.code,riskFindingIds:[f.findingId],contextRelationIds:[],subjectKey:f.subjectKey??f.portfolioObligationId??null,severity:f.severity,evidenceConfidence:weakest(f.evidenceConfidence,...f.evidence.map(e=>e.confidence)),evidence:evidence(f.evidence),reasonCodes:unique(f.reasonCodes),calculationBasis:kind==='CREDIT_RISK'?'Canonical credit constraint; numeric effect belongs exclusively to the supplied Index; no second penalty.':kind==='DATA_REVIEW'?'Canonical data review limits assessment completeness, not borrower quality.':'Confirmed canonical global stop blocks analytical readiness; no lender decision inferred.',warnings:unique(f.warnings),impact,relevantToAssessment:kind!=='CREDIT_RISK'});
 }
 const fs=new Map(x.contextAssessment.facts.map(f=>[f.factId,f]));
 for(const rel of x.contextAssessment.relations.filter(r=>r.effect==='REQUIRES_REVIEW')){
 const facts=rel.contextFactIds.map(fid=>fs.get(fid)!);const relevant=rel.targetRiskFindingIds.some(fid=>x.riskAssessment.findings.some(f=>f.findingId===fid&&f.scope==='CREDIT_RISK'&&p.materialRiskSeverities.includes(f.severity)));
 out.push({constraintId:id('readiness-constraint',x.riskAssessment.companyInn,'CONTEXT_REVIEW',rel.relationId),kind:'CONTEXT_REVIEW',sourceId:rel.relationId,sourceCode:rel.code,riskFindingIds:unique(rel.targetRiskFindingIds),contextRelationIds:[rel.relationId],subjectKey:rel.subjectKey??null,severity:null,evidenceConfidence:weakest(rel.evidenceConfidence,...facts.flatMap(f=>[f.confidence,...f.evidence.map(e=>e.confidence)])),evidence:evidence(facts.flatMap(f=>f.evidence)),reasonCodes:unique(rel.reasonCodes),calculationBasis:'Canonical Context review remains an assessment limitation; only material credit targets add readiness uncertainty. No numeric adjustment.',warnings:unique(rel.warnings),impact:'LIMITS_ASSESSMENT',relevantToAssessment:relevant});
 }
 return out.sort((a,b)=>kinds.indexOf(a.kind)-kinds.indexOf(b.kind)||severities.indexOf(a.severity??'INFO')-severities.indexOf(b.severity??'INFO')||a.sourceCode.localeCompare(b.sourceCode)||(a.subjectKey??'').localeCompare(b.subjectKey??'')||a.constraintId.localeCompare(b.constraintId));
}
export function readinessContextExplanations(x:ReadinessInputV1):ReadinessContextExplanationV1[]{return x.contextAssessment.relations.filter(r=>r.effect!=='REQUIRES_REVIEW').map(r=>({relationId:r.relationId,sourceCode:r.code,effect:r.effect,riskFindingIds:unique(r.targetRiskFindingIds),contextFactIds:unique(r.contextFactIds),evidenceConfidence:r.evidenceConfidence,reasonCodes:unique(r.reasonCodes),calculationBasis:'Canonical context retained for explanation; all eligible numeric effects were already handled by Index.'})).sort((a,b)=>a.sourceCode.localeCompare(b.sourceCode)||a.relationId.localeCompare(b.relationId));}
