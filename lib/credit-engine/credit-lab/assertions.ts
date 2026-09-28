import type { CreditLabCaseV0, CreditLabAssertionResult, CreditLabMismatch, CreditLabExpectationLevel } from "../contracts/credit-lab.ts";
import type { RiskAssessmentV1, RiskFact } from "../contracts/risk.ts";
import { id, same, confidenceRank, contextKey } from "./common.ts";
export function assertCreditCase(c:CreditLabCaseV0,r:RiskAssessmentV1,inputFacts:RiskFact[]){
 const assertions:CreditLabAssertionResult[]=[],mismatches:CreditLabMismatch[]=[];
 const index=<T>(items:T[],key:(item:T)=>string)=>{const m=new Map<string,T[]>();for(const item of items){const k=key(item),list=m.get(k)??[];list.push(item);m.set(k,list);}return m;};
 const findings=index(r.findings,f=>f.code),evaluations=index(r.evaluations,e=>e.ruleCode),facts=index(r.facts,f=>f.semanticCode);
 const check=(type:CreditLabAssertionResult["type"],key:string,level:CreditLabExpectationLevel,passed:boolean,expected:unknown,actual:unknown,message:CreditLabMismatch["type"],ruleCode:string|null=null)=>{const assertionId=id("lab-assertion",c.caseId,c.revision,type,key);assertions.push({assertionId,type,level,passed,expected:expected??null,actual:actual??null,message});if(!passed)mismatches.push({assertionId,type:message,level,expected:expected??null,actual:actual??null,ruleCode})};
 for(const e of c.expectation.requiredFindings){const fs=(findings.get(e.code)??[]).filter(f=>e.subjectKey===undefined||contextKey(f)===e.subjectKey);const key=`${e.code}:${e.subjectKey??""}`;check("REQUIRED_FINDING",key,e.level,fs.length===1,true,fs.length,"MISSING_EXPECTED_FINDING",e.code);if(fs.length!==1)continue;const f=fs[0];
 for(const [field,code]of [["scope","SCOPE_MISMATCH"],["severity","SEVERITY_MISMATCH"],["decisionImpact","DECISION_IMPACT_MISMATCH"]]as const)if(e[field]!==undefined)check("REQUIRED_FINDING",`${key}:${field}`,e.level,e[field]===f[field],e[field],f[field],code,e.code);
 if(e.allowedSeverities)check("REQUIRED_FINDING",`${key}:allowed`,e.level,e.allowedSeverities.includes(f.severity),e.allowedSeverities,f.severity,"SEVERITY_MISMATCH",e.code);
 if(e.minimumEvidenceConfidence)check("REQUIRED_FINDING",`${key}:confidence`,e.level,confidenceRank(f.evidenceConfidence)>=confidenceRank(e.minimumEvidenceConfidence),e.minimumEvidenceConfidence,f.evidenceConfidence,"CONFIDENCE_MISMATCH",e.code);
 if(e.forbiddenReasonCodes)check("REQUIRED_FINDING",`${key}:forbidden-reasons`,e.level,e.forbiddenReasonCodes.every(x=>!f.reasonCodes.includes(x)),e.forbiddenReasonCodes,f.reasonCodes,"FORBIDDEN_REASON_CODE",e.code);
 if(e.reasonCodes)check("REQUIRED_FINDING",`${key}:reasons`,e.level,e.reasonCodes.every(x=>f.reasonCodes.includes(x)),e.reasonCodes,f.reasonCodes,"REASON_CODE_MISMATCH",e.code);
 }
 for(const code of c.expectation.forbiddenFindingCodes)check("FORBIDDEN_FINDING",code,"HARD",!findings.has(code),false,findings.has(code),"FORBIDDEN_FINDING_TRIGGERED",code);
 if(c.expectation.unexpectedFindings&&c.expectation.unexpectedFindings!=="ALLOW")for(const f of r.findings)if(!c.expectation.requiredFindings.some(e=>e.code===f.code&&(e.subjectKey===undefined||contextKey(f)===e.subjectKey)))check("REQUIRED_FINDING",`unexpected:${f.findingId}`,c.expectation.unexpectedFindings,false,null,f.code,"UNEXPECTED_FINDING",f.code);
 for(const e of c.expectation.ruleStatuses){const es=(evaluations.get(e.ruleCode)??[]).filter(x=>e.subjectKey===undefined||contextKey(x)===e.subjectKey);check("RULE_STATUS",`${e.ruleCode}:${e.subjectKey??""}`,e.level,es.length===1&&es[0].status===e.expected,e.expected,es.map(x=>x.status),"RULE_STATUS_MISMATCH",e.ruleCode);}
 for(const e of c.expectation.facts){const fs=(facts.get(e.semanticCode)??[]).filter(f=>e.subjectKey===undefined||contextKey(f)===e.subjectKey),key=`${e.semanticCode}:${e.subjectKey??""}`;check("FACT",`${key}:presence`,e.level,fs.length===1,true,fs.length,"FACT_STATUS_MISMATCH");if(fs.length!==1)continue;const f=fs[0];
 for(const[field,code]of [["status","FACT_STATUS_MISMATCH"],["origin","FACT_ORIGIN_MISMATCH"],["confidence","CONFIDENCE_MISMATCH"]]as const)if(e[field]!==undefined)check("FACT",`${key}:${field}`,e.level,f[field]===e[field],e[field],f[field],code);
 if(Object.hasOwn(e,"exactValue"))check("FACT",`${key}:exact`,e.level,same(f.value,e.exactValue),e.exactValue,f.value,"FACT_VALUE_MISMATCH");
 if(e.numericValue){const n=e.numericValue,tol=Math.max(n.absoluteTolerance??0,(n.relativeTolerance??0)*Math.abs(n.expected));check("FACT",`${key}:numeric`,e.level,typeof f.value==="number"&&Math.abs(f.value-n.expected)<=tol,n,f.value,"FACT_VALUE_MISMATCH");}
 }
 for(const[key,expected]of Object.entries(c.expectation.summary)){const actual=r.summary[key as keyof typeof r.summary];check("SUMMARY",key,"HARD",same(expected,actual),expected,actual,key==="globalStopStatus"?"GLOBAL_STOP_MISMATCH":"SUMMARY_MISMATCH");}
 const sourceById=new Map(inputFacts.map(f=>[f.factId,f]));
 const invariant=(code:string):boolean=>{
 switch(code){
 case "NO_BANK_POLICY_SCOPE":return r.findings.every(f=>["GLOBAL_STOP","CREDIT_RISK","DATA_REVIEW","INFORMATION"].includes(f.scope));
 case "NO_SCORE_OUTPUT":return !["score","riskScore","penalty"].some(k=>k in r);
 case "NO_PD_OUTPUT":return !["pd","PD"].some(k=>k in r);
 case "NO_PRODUCT_RECOMMENDATION":return !["products","recommendations","productSelection"].some(k=>k in r);
 case "GLOBAL_STOP_ONLY_BLOCKING":return r.findings.every(f=>f.decisionImpact!=="BLOCKING"||f.scope==="GLOBAL_STOP");
 case "UNKNOWN_NOT_ZERO":return r.facts.every(f=>f.status!=="UNKNOWN"||f.value===null);
 case "NO_FUTURE_FACTS":return r.facts.filter(f=>f.status==="KNOWN"||f.status==="PARTIAL").every(f=>[f.period.from,f.period.to,f.period.asOf,...f.evidence.map(e=>e.asOf)].every(d=>!d||d<=c.asOfDate));
 case "NO_PERSONAL_BKI_AS_COMPANY_DEBT":return !r.facts.some(f=>f.semanticCode==="BKI_SCOPE_EXCLUDED"&&f.value===true)||!r.findings.some(f=>f.domain==="CREDIT_HISTORY");
 case "GUARANTORSHIP_NOT_FUNDED_DEBT":return !r.facts.some(f=>f.semanticCode==="PORTFOLIO_FUNDED_PRINCIPAL"&&/GUARANTORSHIP|CONTINGENT/.test(f.calculationBasis));
 case "RELATIONSHIP_OBSERVED_NOT_RISK":return !r.findings.some(f=>f.scope==="CREDIT_RISK"&&f.evidence.some(e=>e.value==="RELATIONSHIP_OBSERVED"));
 case "MISSING_SOURCE_NOT_CREDIT_RISK":return !r.findings.some(f=>f.scope==="CREDIT_RISK"&&f.factIds.some(fid=>sourceById.get(fid)?.semanticCode==="SOURCE_MISSING_COUNT"));
 case "LOW_CONFIDENCE_NOT_PROMOTED":return r.facts.every(f=>!sourceById.has(f.factId)||confidenceRank(f.confidence)<=confidenceRank(sourceById.get(f.factId)!.confidence))&&r.findings.every(f=>f.evidence.every(e=>confidenceRank(f.evidenceConfidence)<=confidenceRank(e.confidence)));
 default:return false;
 }};
 for(const code of c.expectation.invariantCodes)check("INVARIANT",code,"HARD",invariant(code),true,invariant(code),"INVARIANT_VIOLATION");
 return {assertions,mismatches};
}
