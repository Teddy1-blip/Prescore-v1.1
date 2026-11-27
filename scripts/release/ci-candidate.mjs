// A test checkout is distinct from the commit that carries the workflow.
// No deployment, live credentials or repository writes occur here.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const fullSha=/^[0-9a-f]{40}$/;
export function requestedCandidate(eventName,headSha,event={}){
 if(!fullSha.test(headSha??''))throw Error('CI_HEAD_SHA_INVALID');
 if(eventName==='workflow_dispatch'){
  const value=event.inputs?.candidate_sha;
  if(value&&!fullSha.test(value))throw Error('CI_CANDIDATE_FULL_SHA_REQUIRED');
  return {sha:value||headSha,selection:'dispatch'};
 }
 if(eventName!=='push')throw Error('CI_EVENT_UNSUPPORTED');
 const lines=String(event.head_commit?.message??'').split('\n').filter(line=>line.startsWith('Prescore-Test-Candidate:'));
 if(lines.length>1)throw Error('CI_CANDIDATE_AMBIGUOUS');
 if(!lines.length)return {sha:headSha,selection:'head'};
 const value=lines[0].slice('Prescore-Test-Candidate:'.length).trim();
 if(!fullSha.test(value))throw Error('CI_CANDIDATE_FULL_SHA_REQUIRED');
 return {sha:value,selection:'push-parent'};
}
export async function resolveCandidate({repository,headSha,eventName,event,readCommit}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository??''))throw Error('CI_REPOSITORY_INVALID');
 const requested=requestedCandidate(eventName,headSha,event);
 const head=await readCommit(headSha);
 if(head.sha!==headSha)throw Error('CI_HEAD_SHA_MISMATCH');
 if(requested.selection==='push-parent'){
  if(!head.parents?.some(p=>p.sha===requested.sha))throw Error('CI_CANDIDATE_NOT_DIRECT_PARENT');
  if(head.message!==event.head_commit?.message)throw Error('CI_CARRIER_MESSAGE_MISMATCH');
 }
 const commit=requested.sha===headSha?head:await readCommit(requested.sha);
 if(commit.sha!==requested.sha||!fullSha.test(commit.tree?.sha??''))throw Error('CI_CANDIDATE_OBJECT_MISMATCH');
 const timestamp=commit.committer?.date;
 if(!timestamp||!Number.isFinite(Date.parse(timestamp)))throw Error('CI_CANDIDATE_TIMESTAMP_INVALID');
 return {workflowSha:headSha,sourceSha:commit.sha,sourceTree:commit.tree.sha,buildTimestamp:new Date(timestamp).toISOString(),selection:requested.selection};
}
export async function main(env=process.env){
 if(!env.GITHUB_TOKEN||!env.GITHUB_EVENT_PATH||!env.GITHUB_OUTPUT)throw Error('CI_CONTEXT_REQUIRED');
 const event=JSON.parse(await fs.readFile(env.GITHUB_EVENT_PATH,'utf8'));
 const result=await resolveCandidate({repository:env.GITHUB_REPOSITORY,headSha:env.GITHUB_SHA,eventName:env.GITHUB_EVENT_NAME,event,readCommit:async sha=>{
  const response=await fetch('https://api.github.com/repos/'+env.GITHUB_REPOSITORY+'/git/commits/'+sha,{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('CI_COMMIT_LOOKUP_FAILED_'+response.status);
  return response.json();
 }});
 await fs.appendFile(env.GITHUB_OUTPUT,`sha=${result.sourceSha}\ntree=${result.sourceTree}\ntimestamp=${result.buildTimestamp}\nselection=${result.selection}\n`);
 console.log(JSON.stringify({event:'CI_VERIFIED_TEST_CHECKOUT',...result}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
