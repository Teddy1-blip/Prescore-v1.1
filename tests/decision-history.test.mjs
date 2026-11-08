import test from "node:test";
import assert from "node:assert/strict";
import {businessCatalog,loadBusiness} from "../lib/credit-engine/credit-lab/business-corpus.mjs";
import {buildCanonicalCreditAnalysis} from "../lib/credit-engine/production/orchestrator.ts";
import {buildDecisionHistoryDigest,compareDecisionHistoryDigests} from "../lib/credit-engine/production/decision-history.ts";

test("decision history digest is deterministic and semantic diff is area-scoped",()=>{
  const caseId=businessCatalog()[0].caseId;
  const result=buildCanonicalCreditAnalysis(loadBusiness(caseId).input);
  const before=buildDecisionHistoryDigest(result);
  assert.deepEqual(buildDecisionHistoryDigest(result),before);
  const after=structuredClone(before);
  after.snapshotId="sha256:"+"f".repeat(64);
  after.index.value=(after.index.value??0)+1;
  after.readiness.level=after.readiness.level==="HIGH"?"MEDIUM":"HIGH";
  after.risks.push({key:"RISK-NEW||",code:"RISK-NEW",severity:"MEDIUM",scope:"CREDIT_RISK",decisionImpact:"REVIEW",subjectKey:null,obligationId:null});
  after.portfolio.activeObligationCount+=1;
  after.capacity.recurringPrudential=(after.capacity.recurringPrudential??0)+1000;
  after.products[0]={...after.products[0],fitLevel:after.products[0].fitLevel==="STRONG_MATCH"?"MODERATE_MATCH":"STRONG_MATCH"};
  if(after.actions[0])after.actions[0]={...after.actions[0],status:after.actions[0].status==="MONITORING"?"READY_TO_START":"MONITORING"};
  const diff=compareDecisionHistoryDigests(before,after);
  for(const area of ["INDEX","READINESS","RISK","PORTFOLIO","CAPACITY","PRODUCTS"])assert.ok(diff.counts[area]>0,area);
  if(before.actions.length)assert.ok(diff.counts.ACTIONS>0);
  assert.ok(diff.changes.every(change=>["ADDED","REMOVED","CHANGED"].includes(change.kind)));
});
