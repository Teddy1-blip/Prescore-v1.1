// Reuse Product QA for the verified test checkout, including a non-default ref's
// explicit parent candidate. Workflow/carrier SHA is never relabelled as source.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function matchingProductRun(runs,{sourceSha,workflowSha,selection}){
 return runs.find(run=>run.path==='.github/workflows/prescore-product-qa.yml'&&run.head_sha===workflowSha&&(
  selection==='dispatch'?run.event==='workflow_dispatch'&&run.display_title==='Prescore product QA / '+sourceSha:
  run.event==='push'
 ));
}
export async function main(env=process.env){
 const repository=env.GITHUB_REPOSITORY,workflowSha=env.GITHUB_SHA,sourceSha=env.PRESCORE_TEST_SHA??workflowSha,selection=env.PRESCORE_CANDIDATE_SELECTION??'head',token=env.GITHUB_TOKEN;
 if(!repository||!token||!['head','dispatch','push-parent'].includes(selection)||![sourceSha,workflowSha].every(sha=>/^[0-9a-f]{40}$/.test(sha??'')))throw Error('PRODUCT_QA_CONTEXT_REQUIRED');
 const until=Date.now()+40*60000,headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 while(Date.now()<until){
  const r=await fetch('https://api.github.com/repos/'+repository+'/actions/runs?head_sha='+workflowSha+'&per_page=30',{headers,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('PRODUCT_QA_LOOKUP_FAILED');
  const run=matchingProductRun((await r.json()).workflow_runs,{sourceSha,workflowSha,selection});
  if(run?.status==='completed'){
   const out=env.RC_REPORT_DIR??'/tmp/rc-reports';await fs.mkdir(out,{recursive:true});
   await fs.writeFile(out+'/product-regression.json',JSON.stringify({sourceSha,workflowSha,selection,runId:run.id,conclusion:run.conclusion,url:run.html_url},null,2));
   if(run.conclusion!=='success')throw Error('PRODUCT_QA_NOT_GREEN');
   console.log(JSON.stringify({event:'PRODUCT_QA_VERIFIED_CHECKOUT_SUCCESS',sourceSha,workflowSha,selection,runId:run.id}));return;
  }
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 throw Error('PRODUCT_QA_TIMEOUT');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
