import type { CreditLabCaseResult,CreditLabRuleCoverage,CreditLabRunSummary } from "../contracts/credit-lab.ts";
import type { RiskRule } from "../contracts/risk.ts";
export function ruleCoverage(results:CreditLabCaseResult[],rules:RiskRule[]):CreditLabRuleCoverage[]{
 const buckets={TRIGGERED:"triggeredCaseIds",NOT_TRIGGERED:"notTriggeredCaseIds",INSUFFICIENT_DATA:"insufficientCaseIds",NOT_APPLICABLE:"notApplicableCaseIds"}as const;
 const rows=new Map(rules.map(r=>[r.code,{triggeredCaseIds:new Set<string>(),notTriggeredCaseIds:new Set<string>(),insufficientCaseIds:new Set<string>(),notApplicableCaseIds:new Set<string>()}]));
 for(const result of results.filter(r=>r.status==="GOLDEN"))for(const e of result.coverage)rows.get(e.ruleCode)?.[buckets[e.status]].add(result.caseId);
 return [...rows].map(([ruleCode,sets])=>{const row:CreditLabRuleCoverage={ruleCode,triggeredCaseIds:[...sets.triggeredCaseIds].sort(),notTriggeredCaseIds:[...sets.notTriggeredCaseIds].sort(),insufficientCaseIds:[...sets.insufficientCaseIds].sort(),notApplicableCaseIds:[...sets.notApplicableCaseIds].sort(),coverageWarnings:[]};
 if(!row.triggeredCaseIds.length)row.coverageWarnings.push("NO_GOLDEN_TRIGGER");if(!row.notTriggeredCaseIds.length&&!row.insufficientCaseIds.length&&!row.notApplicableCaseIds.length)row.coverageWarnings.push("NO_GOLDEN_NON_TRIGGER_OR_INSUFFICIENT");return row;}).sort((a,b)=>a.ruleCode.localeCompare(b.ruleCode));
}
export function runSummary(results:CreditLabCaseResult[],retiredCount=0):CreditLabRunSummary{
 const golden=results.filter(r=>r.status==="GOLDEN"),count=(s:string)=>results.filter(r=>r.result===s).length;
 return {caseCount:results.length+retiredCount,goldenCaseCount:golden.length,draftCaseCount:results.filter(r=>r.status==="DRAFT").length,retiredCaseCount:retiredCount,passCount:count("PASS"),reviewCount:count("REVIEW"),failCount:count("FAIL"),goldenPassCount:golden.filter(r=>r.result==="PASS").length,goldenFailCount:golden.filter(r=>r.result==="FAIL").length,hardMismatchCount:results.flatMap(r=>r.mismatches).filter(m=>m.level==="HARD").length,reviewMismatchCount:results.flatMap(r=>r.mismatches).filter(m=>m.level==="REVIEW").length,allGoldenPassed:golden.every(r=>r.result==="PASS"),warnings:["REGRESSION_NOT_PREDICTIVE_ACCURACY"]};
}
