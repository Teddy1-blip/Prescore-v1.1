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

test("two issued reports retain their bank appendix and comparable public summaries",async()=>{
  const {createWorkspaceRuntime}=await import('./fixtures/workspace-runtime.mjs');
  const {statementFixture}=await import('./fixtures/block1-statements.mjs');
  const rt=await createWorkspaceRuntime();
  try{
    const post=body=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const upload=await rt.request('/api/analysis',post({statements:[{fileName:'synthetic.txt',text:statementFixture()}]}));
    assert.equal(upload.status,200);
    const {analysis}=await upload.json();await rt.full(analysis.id);
    const url='/api/workspace-model?analysisId='+analysis.id;
    const first=await(await rt.request(url)).json();
    assert.equal(first.full.revisionAvailable,true);
    const oldId=first.full.report.meta.snapshot.snapshotId;
    assert.equal((await rt.request('/api/workspace',post({type:'financing-request',analysisId:analysis.id,financingRequest:{purpose:'WORKING_CAPITAL',product:'TERM_LOAN',amount:780000}}))).status,200);
    const second=await(await rt.request(url)).json(),newId=second.full.report.meta.snapshot.snapshotId;
    assert.notEqual(newId,oldId);
    const history=await(await rt.request(url+'&projection=decision-history')).json();
    assert.deepEqual(history.revisions.map(r=>r.snapshotId),[newId,oldId]);
    assert.equal(history.revisions[1].indexValue,first.full.canonical.prescoreIndex.value);
    assert.equal(history.revisions[1].readinessLevel,first.full.canonical.financingReadiness.level);
    const old=await(await rt.request(url+'&projection=decision-revision&snapshotId='+oldId)).json();
    assert.deepEqual(old.model,first.full.report);
    const {readDecisionRevision}=await import('../lib/credit-engine/production/decision-history.ts');
    const {projectPrintBanking}=await import('../lib/workspace/print-banking.ts');
    assert.deepEqual((await readDecisionRevision(rt.db,analysis.id,oldId)).banking,projectPrintBanking(first));
    const diff=await(await rt.request(url+'&projection=decision-diff&from='+oldId+'&to='+newId)).json();
    assert.equal(diff.fromSnapshotId,oldId);assert.equal(diff.toSnapshotId,newId);
    assert.ok(diff.changes.some(c=>c.area==='SOURCES'));
    assert.equal((await rt.request(url+'&projection=decision-history',{},rt.stranger)).status,404);
  }finally{await rt.close();}
});
