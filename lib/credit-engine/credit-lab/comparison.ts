import type { CreditLabRunV0,CreditLabRunComparison,CreditLabCaseDelta,CreditLabCasePack } from "../contracts/credit-lab.ts";
import { contextKey,fingerprint,same } from "./common.ts";
export function compareCreditLabRuns(b:CreditLabRunV0,c:CreditLabRunV0):CreditLabRunComparison{
 if(b.casePackVersion!==c.casePackVersion||b.packRevision!==c.packRevision||b.packFingerprint!==c.packFingerprint||!same(b.results.map(r=>[r.caseId,r.revision,r.fingerprint]).sort(),c.results.map(r=>[r.caseId,r.revision,r.fingerprint]).sort()))throw Error("INCOMPATIBLE_CASE_PACK");
 const byId=new Map(b.results.map(r=>[r.caseId,r]));const out:CreditLabRunComparison={baselineVersion:b.ruleRegistryVersion,candidateVersion:c.ruleRegistryVersion,improvedAgainstGolden:[],regressedAgainstGolden:[],unchangedPass:[],unchangedFail:[],deltas:[],warnings:["IMPROVEMENT_ONLY_AGAINST_GOLDEN_EXPECTATIONS"]};
 const rank={PASS:0,REVIEW:1,FAIL:2};
 for(const current of [...c.results].sort((a,b)=>a.caseId.localeCompare(b.caseId))){const previous=byId.get(current.caseId)!;
  if(current.status==="GOLDEN"){if(rank[current.result]<rank[previous.result])out.improvedAgainstGolden.push(current.caseId);else if(rank[current.result]>rank[previous.result])out.regressedAgainstGolden.push(current.caseId);else if(current.result==="PASS")out.unchangedPass.push(current.caseId);else if(current.result==="FAIL")out.unchangedFail.push(current.caseId);}
  const key=(f:{code:string;subjectKey?:string;portfolioObligationId?:string})=>`${f.code}:${contextKey(f)}`;
  const old=new Map((previous.riskAssessment?.findings??[]).map(f=>[key(f),f])),now=new Map((current.riskAssessment?.findings??[]).map(f=>[key(f),f]));
  const d:CreditLabCaseDelta={caseId:current.caseId,previousStatus:previous.result,currentStatus:current.result,addedFindings:[...now.keys()].filter(k=>!old.has(k)).sort(),removedFindings:[...old.keys()].filter(k=>!now.has(k)).sort(),severityChanges:[],scopeChanges:[],ruleStatusChanges:[],warnings:[]};
  for(const[k,f]of now){const p=old.get(k);if(p&&p.severity!==f.severity)d.severityChanges.push({code:k,before:p.severity,after:f.severity});if(p&&p.scope!==f.scope)d.scopeChanges.push({code:k,before:p.scope,after:f.scope});}
  const evalKey=(e:{ruleCode:string;subjectKey?:string;portfolioObligationId?:string})=>`${e.ruleCode}:${contextKey(e)}`;const oe=new Map((previous.riskAssessment?.evaluations??[]).map(e=>[evalKey(e),e.status])),ne=new Map((current.riskAssessment?.evaluations??[]).map(e=>[evalKey(e),e.status]));
  for(const k of [...new Set([...oe.keys(),...ne.keys()])].sort())if(oe.get(k)!==ne.get(k))d.ruleStatusChanges.push({ruleCode:k,before:oe.get(k)??"ABSENT",after:ne.get(k)??"ABSENT"});
  if(d.previousStatus!==d.currentStatus||d.addedFindings.length||d.removedFindings.length||d.severityChanges.length||d.scopeChanges.length||d.ruleStatusChanges.length)out.deltas.push(d);
 }
 return out;
}
export function validateGoldenRevision(previous:CreditLabCasePack,current:CreditLabCasePack):string[]{
 const errors:string[]=[],byId=new Map(previous.entries.map(e=>[e.caseDefinition.caseId,e]));
 const changedMembership=!same([...byId.keys()].sort(),current.entries.map(e=>e.caseDefinition.caseId).sort());let changed=changedMembership;
 for(const e of current.entries){const old=byId.get(e.caseDefinition.caseId);if(old&&fingerprint(old)!==fingerprint(e)){changed=true;if(e.caseDefinition.revision<=old.caseDefinition.revision||!e.caseDefinition.changeReason)errors.push("GOLDEN_REVISION_REQUIRED");if(e.caseDefinition.review.reviewedByRole==="NONE"||!e.caseDefinition.review.approvedAt)errors.push("GOLDEN_REVIEW_REQUIRED");}}
 if(changed&&(current.version===previous.version||current.revision<=previous.revision))errors.push("PACK_VERSION_REVISION_REQUIRED");return [...new Set(errors)];
}
