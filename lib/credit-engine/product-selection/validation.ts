import type {ProductSelectionInputV1} from '../contracts/product-selection.ts';
import {CREDIT_ASSESSMENT_VERSION,CREDIT_ASSESSMENT_METHODOLOGY} from '../contracts/credit-assessment.ts';
import {CREDIT_ASSESSMENT_POLICY,CREDIT_ASSESSMENT_POLICY_FINGERPRINT} from '../credit-assessment/policy.ts';
import {validateAssessmentInput} from '../credit-assessment/validation.ts';
import {DEBT_CAPACITY_VERSION,DEBT_CAPACITY_METHODOLOGY} from '../contracts/debt-capacity.ts';
import {DEBT_CAPACITY_POLICY,DEBT_CAPACITY_POLICY_FINGERPRINT} from '../debt-capacity/policy.ts';
import {CREDIT_PORTFOLIO_VERSION} from '../contracts/credit-portfolio.ts';
import {FINANCING_PURPOSES,REQUESTED_PRODUCTS,CASE_URGENCIES} from '../contracts/context.ts';
import {same,finiteTree,validDate,rank,fail} from './common.ts';
const confidence=['HIGH','MEDIUM','LOW','UNKNOWN'];
const distinct=(xs:string[],code:string)=>{if(xs.some(s=>typeof s!=='string'||!s)||new Set(xs).size!==xs.length)fail(code);};
const nonnegative=(n:unknown,code:string)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0)fail(code);};
export function scanAvailability(v:unknown,cutoff:string):void{if(v&&typeof v==='object')for(const[k,n]of Object.entries(v)){if(['asOf','asOfDate','observedAt','requestedAt','receivedAt','evidenceAsOf','periodFrom','periodTo','eventDate'].includes(k)&&n!==null&&n!==undefined&&(typeof n!=='string'||!validDate(n.slice(0,10))||n.slice(0,10)>cutoff))fail('FUTURE_OR_INVALID_AVAILABILITY');if(k==='period'&&n&&typeof n==='object')for(const d of Object.values(n))if(typeof d==='string'&&(!validDate(d.slice(0,10))||d.slice(0,10)>cutoff))fail('FUTURE_PERIOD');scanAvailability(n,cutoff);}}
// Validate canonical projections and lineage; never rerun upstream engines.
export function validateProductInput(x:ProductSelectionInputV1):void{
 try{finiteTree(x);validateAssessmentInput(x);}catch(e){fail('UPSTREAM:'+String(e instanceof Error?e.message:e));}
 const a=x.creditAssessment,i=x.prescoreIndex,y=x.financingReadiness,d=x.debtCapacity;
 if(!a||a.companyInn!==i.companyInn||a.asOfDate!==x.asOfDate)fail('ASSESSMENT_COMPANY_OR_CUTOFF');
 if(a.version!==CREDIT_ASSESSMENT_VERSION||a.policyVersion!==CREDIT_ASSESSMENT_POLICY.version||a.policyFingerprint!==CREDIT_ASSESSMENT_POLICY_FINGERPRINT||a.mode!=='SHADOW'||a.methodology!==CREDIT_ASSESSMENT_METHODOLOGY)fail('ASSESSMENT_VERSION');
 if(a.status!==CREDIT_ASSESSMENT_POLICY.statusMapping[y.status]||!confidence.includes(a.confidence)||rank(a.confidence)>Math.min(rank(i.confidence),rank(y.confidence))||a.comparable&&(a.status!=='COMPLETE'||!i.comparable||!y.comparable))fail('ASSESSMENT_STATE');
 if(!same(a.indexReference,{version:i.version,policyVersion:i.policyVersion,policyFingerprint:i.policyFingerprint,value:i.value,status:i.status,confidence:i.confidence}))fail('ASSESSMENT_INDEX_REFERENCE');
 const yr={version:y.version,policyVersion:y.policyVersion,policyFingerprint:y.policyFingerprint,level:y.level,baseLevel:y.baseLevel,status:y.status,confidence:y.confidence,uncertaintyCapApplied:y.uncertaintyCapApplied,uncertaintyCapReasons:y.uncertaintyCapReasons};
 if(!same(a.readinessReference,yr))fail('ASSESSMENT_READINESS_REFERENCE');
 distinct(a.drivers.map(d=>d.driverId),'DUPLICATE_DRIVER');distinct(a.drivers.map(d=>d.riskFindingId),'DUPLICATE_DRIVER_SOURCE');distinct(a.primaryDriverIds,'DUPLICATE_PRIMARY');
 if(a.primaryDriverIds.some(id=>!a.drivers.some(d=>d.driverId===id)))fail('PRIMARY_LINEAGE');
 for(const d of a.drivers){for(const [key,effect]of [['mitigatingContextRelationIds','MITIGATES'],['corroboratingContextRelationIds','CORROBORATES'],['explanatoryContextRelationIds','EXPLAINS'],['reviewContextRelationIds','REQUIRES_REVIEW']]as const)if(!same(d[key],x.contextAssessment.relations.filter(r=>r.effect===effect&&r.targetRiskFindingIds.includes(d.riskFindingId)).map(r=>r.relationId)))fail('ASSESSMENT_DRIVER_CONTEXT_LINEAGE');}
 const expected=[...i.contributions.map(c=>c.riskFindingId),...x.riskAssessment.findings.filter(f=>f.scope==='GLOBAL_STOP').map(f=>f.findingId)];if(!same(expected,a.drivers.map(d=>d.riskFindingId)))fail('ASSESSMENT_DRIVER_COMPLETENESS');
 for(const d of a.drivers){const f=x.riskAssessment.findings.find(f=>f.findingId===d.riskFindingId)!,c=i.contributions.find(c=>c.contributionId===d.indexContributionId),constraint=y.constraints.find(c=>c.constraintId===d.readinessConstraintId);if(d.riskCode!==f.code||d.scope!==f.scope||d.severity!==f.severity||d.domain!==f.domain||!same(d.evidence,f.evidence)||!same(d.reasonCodes,f.reasonCodes)||d.subjectKey!==(f.subjectKey??f.portfolioObligationId??null)||!constraint||constraint.sourceId!==f.findingId||rank(d.evidenceConfidence)>rank(f.evidenceConfidence))fail('ASSESSMENT_DRIVER_LINEAGE');if(f.scope==='CREDIT_RISK'&&(!c||c.riskFindingId!==f.findingId||d.dimension!==c.component||d.basePenaltyPoints!==c.basePenaltyPoints||d.finalPenaltyPoints!==c.finalPenaltyPoints||d.contextModifierPercent!==c.contextModifierPercent))fail('ASSESSMENT_CONTRIBUTION_LINEAGE');}
 if(a.dimensions.length!==6||new Set(a.dimensions.map(d=>d.dimension)).size!==6)fail('ASSESSMENT_DIMENSIONS');for(const c of i.components){const d=a.dimensions.find(d=>d.dimension===c.component);if(!d||d.scorePoints!==c.scorePoints||d.finalPenalty!==c.finalPenalty||d.maxPoints!==c.maxPoints||d.coverage!==c.coverage||d.confidence!==c.confidence)fail('ASSESSMENT_COMPONENT_LINEAGE');}
 const rels=Object.values(a.context).flat();if(!same(rels.map(r=>r.relation.relationId),x.contextAssessment.relations.map(r=>r.relationId)))fail('ASSESSMENT_CONTEXT_COMPLETENESS');for(const r of rels){const rel=x.contextAssessment.relations.find(v=>v.relationId===r.relation.relationId);if(!same(rel,r.relation)||!same(r.facts,x.contextAssessment.facts.filter(f=>rel!.contextFactIds.includes(f.factId))))fail('ASSESSMENT_CONTEXT_LINEAGE');}
 for(const [k,v]of Object.entries(a.financingCase)){if(v&&typeof v==='object'&&!Array.isArray(v)&&'factId'in v&&!same(v,y.caseDefinition.facts.find(f=>f.semanticCode==='CASE_'+k)))fail('ASSESSMENT_CASE_LINEAGE');}
 for(const f of y.caseDefinition.facts){const k=f.semanticCode.slice(5) as keyof typeof a.financingCase;if(!same(a.financingCase[k],f))fail('ASSESSMENT_CASE_FIELD');}
 if(a.financingCase.requestedAmount?.status==='KNOWN')nonnegative(a.financingCase.requestedAmount.value,'REQUESTED_AMOUNT');
 if(a.financingCase.definitionStatus!==y.caseDefinition.status||!same(a.financingCase.factIds,y.caseDefinition.facts.map(f=>f.factId)))fail('ASSESSMENT_CASE_COMPLETENESS');
 if(a.summary.status!==a.status||a.summary.indexValue!==i.value||a.summary.readinessLevel!==y.level)fail('ASSESSMENT_SUMMARY');
 for(const [key,allowed] of [['financingPurpose',FINANCING_PURPOSES],['requestedProduct',REQUESTED_PRODUCTS],['urgency',CASE_URGENCIES]] as const){const f=a.financingCase[key];if(f?.value!==null&&f?.value!==undefined&&!(allowed as readonly unknown[]).includes(f.value))fail('CASE_ENUM:'+key);}
 for(const key of ['requestedAmount','requestedTermMonths'] as const){const f=a.financingCase[key];if(f?.value!==null&&f?.value!==undefined){nonnegative(f.value,'CASE_NUMBER');if(key==='requestedTermMonths'&&(!Number.isSafeInteger(f.value)||Number(f.value)<=0))fail('CASE_TERM');}}
 for(const f of y.caseDefinition.facts){if(f.status==='KNOWN'&&f.value===null||['UNKNOWN','NOT_APPLICABLE'].includes(f.status)&&f.value!==null)fail('CASE_KNOWLEDGE');}
 if(!d||d.version!==DEBT_CAPACITY_VERSION||d.policyVersion!==DEBT_CAPACITY_POLICY.version||d.policyFingerprint!==DEBT_CAPACITY_POLICY_FINGERPRINT||d.methodology!==DEBT_CAPACITY_METHODOLOGY||d.mode!=='SHADOW')fail('CAPACITY_VERSION');
 if(d.companyInn!==a.companyInn||d.asOfDate!==x.asOfDate)fail('CAPACITY_IDENTITY');
 if(!['CALCULATED','PARTIAL','INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(d.status)||!confidence.includes(d.confidence)||rank(d.confidence)>rank(a.confidence)||typeof d.comparable!=='boolean'||d.comparable&&(d.status!=='CALCULATED'||!a.comparable))fail('CAPACITY_STATE');
 if(a.status==='NOT_RATABLE_GLOBAL_STOP'?(d.status!=='NOT_RATABLE_GLOBAL_STOP'):d.status==='NOT_RATABLE_GLOBAL_STOP'||a.status==='INSUFFICIENT_DATA'&&d.status!=='INSUFFICIENT_DATA'||a.status==='PARTIAL'&&d.status==='CALCULATED')fail('CAPACITY_UPSTREAM_STATE');
 if(!same(d.creditAssessmentReference,{version:a.version,policyVersion:a.policyVersion,policyFingerprint:a.policyFingerprint,status:a.status,confidence:a.confidence,comparable:a.comparable})||!same(d.indexReference,a.indexReference)||!same(d.readinessReference,a.readinessReference))fail('CAPACITY_UPSTREAM_REFERENCE');
 const h=d.headlineCapacity.monthlyIncrementalDebtServiceCapacity;
 if(!h||!['POSITIVE','ZERO','UNKNOWN'].includes(h.state))fail('CAPACITY_HEADROOM');
 if(h.state==='UNKNOWN'?(h?.state!=='UNKNOWN'||h.prudential!==null||h.maximumPolicy!==null):h.prudential===null||h.maximumPolicy===null||h.prudential<0||h.maximumPolicy<h.prudential||(h.state==='ZERO'?h.maximumPolicy!==0:h.maximumPolicy<=0))fail('CAPACITY_HEADROOM');
 if(['INSUFFICIENT_DATA','NOT_RATABLE_GLOBAL_STOP'].includes(d.status)&&h.state!=='UNKNOWN'||['CALCULATED','PARTIAL'].includes(d.status)&&h.state==='UNKNOWN')fail('CAPACITY_STATUS_HEADROOM');
 for(const k of ['status','confidence','comparable'] as const)if(d[k]!==d.summary[k])fail('CAPACITY_SUMMARY');
 if(!same(d.summary.monthlyIncrementalDebtServiceCapacity,h)||d.summary.headroomState!==h.state||d.summary.scenarioCount!==d.scenarioResults.length)fail('CAPACITY_SUMMARY_REFERENCE');
 distinct(d.scenarioResults.map(s=>s.scenarioId),'DUPLICATE_SCENARIO');
 for(const s of d.scenarioResults){if(s.paymentFrequency!=='MONTHLY'||s.amortization!=='ANNUITY'||!Number.isSafeInteger(s.termMonths)||s.termMonths<=0||!confidence.includes(s.confidence)||rank(s.confidence)>rank(d.confidence))fail('SCENARIO_TERMS');nonnegative(s.annualRatePercent,'SCENARIO_RATE');
 if(s.prudentialMonthlyPaymentCapacity!==h.prudential||s.maximumPolicyMonthlyPaymentCapacity!==h.maximumPolicy)fail('SCENARIO_HEADROOM_LINEAGE');
 const req=a.financingCase.requestedAmount,term=a.financingCase.requestedTermMonths;
 if(s.requestedAmount!==(req?.status==='KNOWN'?req.value:null))fail('SCENARIO_REQUEST_LINEAGE');
 const pr=s.prudentialPrincipalEquivalent,mx=s.maximumPolicyPrincipalEquivalent;if(h.state==='UNKNOWN'?(pr!==null||mx!==null):(pr===null||mx===null||pr<0||mx<pr))fail('SCENARIO_PRINCIPAL_STATE');
 const mismatch=term?.status==='KNOWN'&&term.value!==s.termMonths;
 const coverage=s.requestedAmount===null||pr===null||mx===null||mismatch?'UNKNOWN':s.requestedAmount<=pr?'WITHIN_PRUDENTIAL_CAPACITY':s.requestedAmount<=mx?'WITHIN_MAXIMUM_POLICY_CAPACITY':'ABOVE_MODELED_CAPACITY';if(s.requestedAmountCoverage!==coverage)fail('SCENARIO_COVERAGE_LINEAGE');
 const es=s.references.filter(e=>e.kind==='SCENARIO');if(es.length!==1||es[0].scenarioId!==s.scenarioId||es[0].value!==s.annualRatePercent||rank(s.confidence)>rank(es[0].confidence))fail('SCENARIO_PROVENANCE');
 const hs=new Set(d.headlineCapacity.references.map(e=>e.referenceId));for(const e of s.references)if(e.kind!=='SCENARIO'&&e.kind!=='FINANCING_CASE'&&!hs.has(e.referenceId))fail('DANGLING_SCENARIO_REFERENCE');
 }
 const pf=x.creditPortfolio;if(pf){if(pf.version!==CREDIT_PORTFOLIO_VERSION||pf.mode!=='SHADOW'||pf.companyInn!==a.companyInn||pf.asOfDate!==x.asOfDate||pf.portfolioId!=='portfolio:'+a.companyInn)fail('PORTFOLIO_IDENTITY');distinct(pf.obligations.map(o=>o.obligationId),'DUPLICATE_OBLIGATION');
 for(const o of pf.obligations){if(o.companyInn!==a.companyInn||!['TERM_LOAN','CREDIT_LINE','OVERDRAFT','LEASING','FACTORING','BANK_GUARANTEE','GUARANTORSHIP','OTHER_DEBT','UNKNOWN'].includes(o.type)||!confidence.includes(o.identityConfidence)||!['KNOWN','PARTIAL','UNKNOWN','NOT_APPLICABLE'].includes(o.status.knowledge)||!confidence.includes(o.status.confidence)||o.status.knowledge==='KNOWN'&&!['ACTIVE','CLOSED','SUSPENDED','DETECTED','UNKNOWN'].includes(o.status.value!))fail('PORTFOLIO_OBLIGATION');for(const e of [...o.schedule,...o.events,...o.positionHistory,...o.termsHistory])if(e.obligationId!==o.obligationId)fail('DANGLING_PORTFOLIO_REFERENCE');}
 for(const e of [...pf.events,...pf.paymentMatches,...pf.positionChecks])if(e.obligationId!==null&&!pf.obligations.some(o=>o.obligationId===e.obligationId))fail('DANGLING_PORTFOLIO_REFERENCE');
 for(const o of pf.obligations)for(const e of Object.values(o.currentPosition))if(e.knowledge==='KNOWN'&&e.value===null||e.knowledge==='UNKNOWN'&&e.value!==null)fail('PORTFOLIO_KNOWLEDGE');
 }
 if(d.portfolioReference&&(!pf||!same(d.portfolioReference,{portfolioId:pf.portfolioId,version:pf.version,asOfDate:pf.asOfDate})))fail('CAPACITY_PORTFOLIO_REFERENCE');
 scanAvailability(x,x.asOfDate);
}
