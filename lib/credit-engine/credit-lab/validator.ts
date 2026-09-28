import { CREDIT_LAB_CASE_VERSION, type CreditLabEntry, type CreditLabCasePack } from "../contracts/credit-lab.ts";
import { fingerprint, validDate } from "./common.ts";
export const INVARIANTS=["NO_BANK_POLICY_SCOPE","NO_SCORE_OUTPUT","NO_PD_OUTPUT","NO_PRODUCT_RECOMMENDATION","GLOBAL_STOP_ONLY_BLOCKING","UNKNOWN_NOT_ZERO","NO_FUTURE_FACTS","NO_PERSONAL_BKI_AS_COMPANY_DEBT","GUARANTORSHIP_NOT_FUNDED_DEBT","RELATIONSHIP_OBSERVED_NOT_RISK","MISSING_SOURCE_NOT_CREDIT_RISK","LOW_CONFIDENCE_NOT_PROMOTED"];
export function validateCase({caseDefinition:c,material:m}:CreditLabEntry):string[]{
 const errors:string[]=[];const need=(ok:unknown,code:string)=>{if(!ok)errors.push(code)};
 try {
 need(c.schemaVersion===CREDIT_LAB_CASE_VERSION,"SCHEMA_VERSION");need(/^CL-[A-Z0-9-]+$/.test(c.caseId),"CASE_ID");need(Number.isInteger(c.revision)&&c.revision>=1,"REVISION");need(validDate(c.asOfDate),"ASOF_DATE");need(c.country==="RU","COUNTRY");
 need(["DRAFT","REVIEWED","GOLDEN","RETIRED"].includes(c.status),"CASE_STATUS");need(["SYNTHETIC","DEIDENTIFIED_REAL","PRIVATE_REAL"].includes(c.origin),"ORIGIN");need(["INTERNAL_METHOD_REVIEW","EXTERNAL_EXPERT_REVIEW","OUTCOME_VALIDATED"].includes(c.reviewLevel),"REVIEW_LEVEL");need(["GOLDEN_REGRESSION","CALIBRATION","HOLDOUT","OUTCOME_ONLY"].includes(c.partition),"PARTITION");need(!!c.subjectGroupId,"SUBJECT_GROUP");need(c.materialKind===m.kind,"MATERIAL_KIND");need(c.revision===1||!!c.changeReason,"CHANGE_REASON");
 if(c.status==="GOLDEN")need(c.review.reviewedByRole!=="NONE"&&validDate(c.review.approvedAt)&&!!c.review.rationale&&c.review.labelBasis.length,"GOLDEN_REVIEW_REQUIRED");
 const statuses=["TRIGGERED","NOT_TRIGGERED","INSUFFICIENT_DATA","NOT_APPLICABLE"],scopes=["GLOBAL_STOP","CREDIT_RISK","DATA_REVIEW","INFORMATION"],severities=["CRITICAL","HIGH","MEDIUM","LOW","INFO"],confidence=["HIGH","MEDIUM","LOW","UNKNOWN"];
 for(const e of c.expectation.requiredFindings){need(!!e.code,"FINDING_CODE");if(e.scope!==undefined)need(scopes.includes(e.scope),"FINDING_SCOPE");if(e.severity!==undefined)need(severities.includes(e.severity),"FINDING_SEVERITY");if(e.allowedSeverities)need(e.allowedSeverities.length>0&&e.allowedSeverities.every(x=>severities.includes(x)),"ALLOWED_SEVERITIES");if(e.minimumEvidenceConfidence)need(["HIGH","MEDIUM","LOW"].includes(e.minimumEvidenceConfidence),"CONFIDENCE");if(e.decisionImpact)need(["BLOCKING","REVIEW","NON_BLOCKING"].includes(e.decisionImpact),"DECISION_IMPACT");}
 for(const e of c.expectation.ruleStatuses)need(!!e.ruleCode&&statuses.includes(e.expected),"RULE_STATUS");
 for(const e of c.expectation.facts){need(!!e.semanticCode,"FACT_CODE");if(e.status!==undefined)need(["KNOWN","PARTIAL","UNKNOWN","NOT_APPLICABLE"].includes(e.status),"FACT_STATUS");if(e.origin!==undefined)need(["REPORTED","DERIVED","PROXY"].includes(e.origin),"FACT_ORIGIN");if(e.confidence!==undefined)need(confidence.includes(e.confidence),"FACT_CONFIDENCE");}
 if(c.expectation.unexpectedFindings!==undefined)need(["ALLOW","HARD","REVIEW"].includes(c.expectation.unexpectedFindings),"UNEXPECTED_FINDINGS_LEVEL");
 const keys:string[]=[];
 for(const [type,list]of Object.entries({required:c.expectation.requiredFindings,status:c.expectation.ruleStatuses,fact:c.expectation.facts}))for(const item of list){need(["HARD","REVIEW"].includes(item.level),"EXPECTATION_LEVEL");const x=item as unknown as Record<string,unknown>;keys.push(`${type}:${x.code??x.ruleCode??x.semanticCode}:${x.subjectKey??""}`);}
 need(new Set(keys).size===keys.length,"DUPLICATE_EXPECTATION");need(new Set(c.expectation.forbiddenFindingCodes).size===c.expectation.forbiddenFindingCodes.length,"DUPLICATE_FORBIDDEN");need(c.expectation.invariantCodes.every(x=>INVARIANTS.includes(x)),"UNKNOWN_INVARIANT");need(new Set(c.expectation.invariantCodes).size===c.expectation.invariantCodes.length,"DUPLICATE_INVARIANT");
 const walk=(x:unknown)=>{if(typeof x==="number")need(Number.isFinite(x),"NON_FINITE");if(typeof x==="function"||typeof x==="symbol"||typeof x==="bigint"||x instanceof Map||x instanceof Set)errors.push("NOT_JSON");if(x&&typeof x==="object")for(const v of Object.values(x))walk(v)};walk(c);walk(m);
 for(const f of c.expectation.facts)if(f.numericValue){need((f.numericValue.absoluteTolerance??0)>=0&&(f.numericValue.relativeTolerance??0)>=0,"NEGATIVE_TOLERANCE");}
 if(m.kind==="RISK_FACTS")for(const f of m.facts){for(const d of [f.period.from,f.period.to,f.period.asOf])if(d)need(validDate(d),"FACT_DATE_INVALID");if(f.period.from&&f.period.to)need(f.period.from<=f.period.to,"FACT_DATE_ORDER");}
 const summary=c.expectation.summary;if(summary.globalStopStatus!==undefined)need(["TRIGGERED","NOT_TRIGGERED_WITH_AVAILABLE_DATA","INSUFFICIENT_DATA"].includes(summary.globalStopStatus),"SUMMARY_GLOBAL_STOP");if(summary.highestCreditRiskSeverity!==undefined)need([...severities,"NONE","UNKNOWN"].includes(summary.highestCreditRiskSeverity),"SUMMARY_SEVERITY");if(summary.dataReviewRequired!==undefined)need(typeof summary.dataReviewRequired==="boolean","SUMMARY_DATA_REVIEW");
 const inns=m.kind==="RISK_FACTS"?m.facts.map(f=>f.companyInn):[m.analysis.companyInn,...(m.companyProfile?[m.companyProfile.inn]:[])];need(inns.length>0&&new Set(inns).size===1&&inns.every(i=>/^\d{10}(?:\d{2})?$/.test(i)),"SUBJECT_IDENTITY");
 }catch{errors.push("CASE_INVALID_STRUCTURE")}
 return [...new Set(errors)].sort();
}
export function validatePack(pack:CreditLabCasePack):string[]{
 const errors:string[]=[],seen=new Set<string>(),groups=new Map<string,Set<string>>();
 for(const entry of pack.entries){const c=entry.caseDefinition,key=`${c.caseId}@${c.revision}`;if(seen.has(c.caseId))errors.push("DUPLICATE_CASE_REVISION");seen.add(c.caseId);if(pack.fingerprints[key]!==fingerprint(entry))errors.push(`CASE_FINGERPRINT_CHANGED:${key}`);const set=groups.get(c.subjectGroupId)??new Set();set.add(c.partition);groups.set(c.subjectGroupId,set);}
 for(const set of groups.values())if(set.has("CALIBRATION")&&set.has("HOLDOUT"))errors.push("SUBJECT_PARTITION_LEAKAGE");return errors.sort();
}
export function validateSyntheticFixture(entry:CreditLabEntry):string[]{
 const errors:string[]=[];if(entry.caseDefinition.origin!=="SYNTHETIC")errors.push("REPOSITORY_SYNTHETIC_ONLY");
 const scan=(x:unknown,key="")=>{if(x&&typeof x==="object"){for(const[k,v]of Object.entries(x))scan(v,key?`${key}.${k}`:k);return}if(typeof x!=="string"||!x)return;
 if(/(?:companyName|company\.name|creditor|creditorName(?:\.value)?)$/i.test(key)&&! /^(?:synthetic|синтетичес)/i.test(x))errors.push("NON_SYNTHETIC_NAME");if(/inn$/i.test(key)&&!/^990000\d{4}$/.test(x))errors.push("NON_SYNTHETIC_INN");if(/(?:^|\.)(?:email|phone|passport|directorName|founderName)(?:\.|$)/i.test(key)||/(?:accountNumber|contractNumber)(?:\.value)?$/i.test(key))errors.push("PRIVATE_IDENTITY_FIELD");if(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(x)||/\+\d[\d ()-]{8,}/.test(x))errors.push("CONTACT_DATA");};scan(entry);return [...new Set(errors)].sort();
}
