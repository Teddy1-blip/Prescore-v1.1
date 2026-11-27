import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedCandidate,resolveCandidate} from '../scripts/release/ci-candidate.mjs';
const head='a'.repeat(40),candidate='b'.repeat(40),tree='c'.repeat(40),timestamp='2026-11-04T15:00:00Z';
const base={repository:'Teddy1-blip/Prescore-v1.1',headSha:head};
const object=(sha,extra={})=>({sha,tree:{sha:tree},committer:{date:timestamp},parents:[],...extra});
test('manual CI accepts only a full literal SHA and rejects injection or shorthand before lookup',()=>{
 for(const value of ['main','b'.repeat(7),'b'.repeat(40)+'\nnext','$(echo unsafe)','b'.repeat(40)+';echo unsafe'])assert.throws(()=>requestedCandidate('workflow_dispatch',head,{inputs:{candidate_sha:value}}),/FULL_SHA/);
 assert.deepEqual(requestedCandidate('workflow_dispatch',head,{inputs:{candidate_sha:candidate}}),{sha:candidate,selection:'dispatch'});
 assert.deepEqual(requestedCandidate('push',head,{head_commit:{message:'normal code change'}}),{sha:head,selection:'head'});
});
test('push test selection requires the declared SHA to be an actual parent of the verified carrier',async()=>{
 const message='test: exact candidate\n\nPrescore-Test-Candidate: '+candidate;
 const input={...base,eventName:'push',event:{head_commit:{message}}};
 const calls=[];const readCommit=async sha=>{calls.push(sha);return sha===head?object(head,{message,parents:[{sha:candidate}]}):object(candidate);};
 assert.deepEqual(await resolveCandidate({...input,readCommit}),{workflowSha:head,sourceSha:candidate,sourceTree:tree,buildTimestamp:'2026-11-04T15:00:00.000Z',selection:'push-parent'});
 assert.deepEqual(calls,[head,candidate]);
 await assert.rejects(resolveCandidate({...input,readCommit:async()=>object(head,{message})}),/NOT_DIRECT_PARENT/);
 await assert.rejects(resolveCandidate({...input,readCommit:async()=>object(head,{message:'changed',parents:[{sha:candidate}]})}),/MESSAGE_MISMATCH/);
 assert.throws(()=>requestedCandidate('push',head,{head_commit:{message:message+'\nPrescore-Test-Candidate: '+candidate}}),/AMBIGUOUS/);
});
test('candidate identity must exist in the same repository and match API object/tree',async()=>{
 const input={...base,eventName:'workflow_dispatch',event:{inputs:{candidate_sha:candidate}}};
 await assert.rejects(resolveCandidate({...input,readCommit:async sha=>sha===head?object(head):object('d'.repeat(40))}),/OBJECT_MISMATCH/);
 await assert.rejects(resolveCandidate({...input,repository:'owner/repo/other',readCommit:async()=>{throw Error('MUST_NOT_LOOKUP');}}),/REPOSITORY_INVALID/);
 await assert.rejects(resolveCandidate({...input,readCommit:async sha=>{if(sha===head)return object(head);throw Error('CI_COMMIT_LOOKUP_FAILED_404');}}),/LOOKUP_FAILED_404/);
});

test('RC wait never accepts another candidate dispatch, carrier or workflow',async()=>{
 const {matchingProductRun}=await import('../scripts/release/wait-product.mjs');
 const run={path:'.github/workflows/prescore-product-qa.yml',head_sha:head,event:'workflow_dispatch',display_title:'Prescore product QA / '+candidate,conclusion:'success'};
 const context={sourceSha:candidate,workflowSha:head,selection:'dispatch'};
 assert.equal(matchingProductRun([run],context),run);
 for(const changed of [{display_title:'Prescore product QA / '+head},{head_sha:candidate},{path:'.github/workflows/other.yml'},{event:'push'}])assert.equal(matchingProductRun([{...run,...changed}],context),undefined);
 assert.equal(matchingProductRun([{...run,event:'push'}],{...context,selection:'push-parent'})?.head_sha,head);
});
