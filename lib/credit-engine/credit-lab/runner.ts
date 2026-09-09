import { CREDIT_LAB_VERSION, type CreditLabTemporalDiagnostic,type CreditLabEntry,type CreditLabDependencies,type CreditLabCaseResult,type CreditLabCasePack,type CreditLabRunV0,type CreditOutcomeObservation } from "../contracts/credit-lab.ts";
import { RISK_ENGINE_VERSION,RISK_REGISTRY_VERSION,type RiskAssessmentV1 } from "../contracts/risk.ts";
import { evaluateRiskFacts } from "../risk/engine.ts";
import { adaptRiskFacts } from "../risk/facts.ts";
import { RISK_RULE_REGISTRY } from "../risk/rules/registry.ts";
import { validateCase,validatePack } from "./validator.ts";
import { fingerprint,id } from "./common.ts";
import { prepareMaterial,eligibleFact } from "./temporal.ts";
import { assertCreditCase } from "./assertions.ts";
import { ruleCoverage,runSummary } from "./coverage.ts";
import { summarizeOutcomes,validateOutcomes } from "./outcomes.ts";
export function runCreditLabCase(entry:CreditLabEntry,dependencies:CreditLabDependencies={}):CreditLabCaseResult{
 const c=entry.caseDefinition;
 const fail=(warnings:string[]):CreditLabCaseResult=>({caseId:c?.caseId??"INVALID",revision:c?.revision??0,status:c?.status??"DRAFT",partition:c?.partition??"GOLDEN_REGRESSION",fingerprint:"INVALID",result:"FAIL",riskAssessment:null,assertions:[],mismatches:[{assertionId:id("invalid",c?.caseId,warnings),type:"CASE_INVALID",level:"HARD",expected:"valid case",actual:warnings,ruleCode:null}],candidates:[],coverage:[],warnings});
 try{
  const errors=validateCase(entry);if(errors.length)return fail(errors);
  const diagnostics:CreditLabTemporalDiagnostic[]=[];
  const material=prepareMaterial(entry.material,c.asOfDate,diagnostics),companyInn=material.kind==="RISK_FACTS"?entry.material.kind==="RISK_FACTS"?entry.material.facts[0].companyInn:"":material.analysis.companyInn;
  const raw=material.kind==="RISK_FACTS"?material.facts:(dependencies.adapt??adaptRiskFacts)({analysis:material.analysis,companyProfile:material.companyProfile,asOfDate:c.asOfDate});
  const facts=raw.filter(f=>{const eligible=eligibleFact(f,c.asOfDate);if(!eligible)diagnostics.push({code:"TEMPORAL_LEAKAGE_CANDIDATE",path:`adaptedFacts:${f.factId}:period/evidence`,cutoff:c.asOfDate,reason:"Excluded adapted fact with evidence outside case cutoff"});return eligible;});
  // Stored Lab artifacts use JSON-normalized output; optional undefined fields have no stored semantics.
  const risk:RiskAssessmentV1=JSON.parse(JSON.stringify((dependencies.evaluate??evaluateRiskFacts)({companyInn,asOfDate:c.asOfDate,facts},dependencies.rules??RISK_RULE_REGISTRY)));
  const {assertions,mismatches}=assertCreditCase(c,risk,facts);
  for(const d of diagnostics.sort((a,b)=>a.path.localeCompare(b.path)))mismatches.push({assertionId:id("temporal-review",c.caseId,c.revision,d),type:d.code,level:"REVIEW",expected:{availableBy:c.asOfDate},actual:d,ruleCode:null});
  const candidates=mismatches.map(m=>({candidateId:id("calibration-review",c.caseId,c.revision,m.assertionId),caseId:c.caseId,ruleCode:m.ruleCode,mismatchType:m.type,actualValue:risk.findings.find(f=>f.code===m.ruleCode)?.actualValue??null,threshold:risk.findings.find(f=>f.code===m.ruleCode)?.threshold??null,expected:m.expected,actual:m.actual,resolution:"UNKNOWN"as const,status:"OPEN"as const,notes:["HUMAN_REVIEW_REQUIRED",...(c.partition==="HOLDOUT"?["HOLDOUT_NOT_FOR_THRESHOLD_DESIGN"]:[])]}));
  return {caseId:c.caseId,revision:c.revision,status:c.status,partition:c.partition,fingerprint:fingerprint(entry),result:mismatches.some(m=>m.level==="HARD")?"FAIL":mismatches.length?"REVIEW":"PASS",riskAssessment:risk,assertions,mismatches,candidates,coverage:risk.evaluations.map(e=>({ruleCode:e.ruleCode,status:e.status})),warnings:["INTERNAL_SHADOW_ONLY"]};
 }catch(error){return fail(["CASE_EXECUTION_ERROR",error instanceof Error?error.message:String(error)])}
}
export function runCreditLabPack(pack:CreditLabCasePack,options:{dependencies?:CreditLabDependencies;sourceCommitSha?:string;outcomes?:CreditOutcomeObservation[]}={}):CreditLabRunV0{
 const errors=validatePack(pack);if(errors.length)throw Error(errors.join(";"));
 const outcomes=options.outcomes??[];const oe=validateOutcomes(outcomes,pack.entries.map(e=>e.caseDefinition));if(oe.length)throw Error(oe.join(";"));
 const entries=[...pack.entries].sort((a,b)=>a.caseDefinition.caseId.localeCompare(b.caseDefinition.caseId)),results=entries.filter(e=>e.caseDefinition.status!=="RETIRED").map(e=>runCreditLabCase(e,options.dependencies));
 return {version:CREDIT_LAB_VERSION,mode:"INTERNAL_SHADOW",casePackVersion:pack.version,packRevision:pack.revision,packFingerprint:id("lab-pack",pack.version,pack.revision,entries.map(e=>[e.caseDefinition.caseId,e.caseDefinition.revision,fingerprint(e)])),riskEngineVersion:results.find(r=>r.riskAssessment)?.riskAssessment?.version??RISK_ENGINE_VERSION,ruleRegistryVersion:results.find(r=>r.riskAssessment)?.riskAssessment?.ruleRegistryVersion??RISK_REGISTRY_VERSION,sourceCommitSha:options.sourceCommitSha??null,results,summary:runSummary(results,entries.filter(e=>e.caseDefinition.status==="RETIRED").length),ruleCoverage:ruleCoverage(results,options.dependencies?.rules??RISK_RULE_REGISTRY),outcomeSummary:summarizeOutcomes(outcomes),warnings:["INTERNAL_SHADOW_ONLY","NO_AUTOMATED_CALIBRATION"]};
}
