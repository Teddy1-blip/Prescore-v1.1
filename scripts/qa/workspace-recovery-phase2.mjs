// Real presentation components; isolated synthetic DB and intercepted edge-case model only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4187',out=path.resolve(process.argv[2]??'build/recovery-phase2');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),checks=[],errors=[];
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let externalRequests=0;
page.on('request',r=>{if(/\/api\/(checko|ai)/.test(r.url()))externalRequests++;});
const pass=name=>checks.push({name,status:'PASS'});
try{
 const response=await page.request.get(origin+'/__qa/seed');assert.equal(response.status(),200);const id=(await response.json()).id;
 const model=await(await page.request.get(origin+'/api/workspace-model?analysisId='+id)).json();assert.ok(model.full);
 for(const view of ['analysis','obligations','company']){
  await page.goto(origin+'/dashboard?analysisId='+id+'&view='+view);await page.locator('.ws-credit-depth').waitFor();
  if(view==='analysis'){
   assert.equal(await page.locator('[data-credit-index]').textContent(),String(model.full.canonical.prescoreIndex.value??'Не определён'));
   assert.equal(await page.locator('[data-index-status]').textContent(),model.full.report.index.status);
   assert.equal(await page.locator('[data-credit-readiness]').textContent(),model.full.report.readiness.level);
  }
  for(const width of [1440,1024,768,390,360]){
   await page.setViewportSize({width,height:1000});
   // Open every disclosure to exercise long evidence, portfolio metadata, and recommendations.
   await page.locator('.ws-credit-depth details').evaluateAll(nodes=>nodes.forEach(e=>e.open=true));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' expanded overflow '+width);
   assert.ok(await page.locator('.ws-credit-depth').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1));
   await page.locator('.ws-credit-depth details').evaluateAll(nodes=>nodes.forEach(e=>e.open=false));
   const summary=page.locator('.ws-credit-depth summary').first();await summary.focus();await page.keyboard.press('Enter');
   assert.equal(await summary.evaluate(e=>e.parentElement.open),true);
   await page.screenshot({path:path.join(out,view+'-'+width+'.png'),fullPage:true});
  }
  await page.reload();await page.locator('.ws-credit-depth').waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),view);pass(view+' at five widths, disclosures and reload');
 }
 assert.equal(externalRequests,0);pass('company opens without external source or AI request');
 await page.goto(origin+'/dashboard?analysisId='+id+'&view=analysis');await page.locator('[data-credit-index]').waitFor();
 await page.getByRole('link',{name:'Открыть подробный кредитный анализ',exact:false}).click();await page.locator('.av-index').waitFor();assert.equal(new URL(page.url()).searchParams.get('analysisId'),id);pass('canonical report-v2 deep link');
 // Edge cases are public-contract fixture values, never persisted.
 const edge=structuredClone(model),v=(value,knowledge='KNOWN')=>({value,knowledge,origin:'REPORTED',verification:'UNCONFIRMED',confidence:'LOW',asOf:'2025-01-31'});
 edge.full.report.analysisV3.observations=[{type:'BKI',status:'STALE',receivedAt:'2025-02-01',from:null,to:'2025-01-31'}];
 edge.full.report.analysisV3.portfolio=[{id:'edge',type:'TERM_LOAN',exposure:'FUNDED_DEBT',creditor:v('Очень длинное название кредитора '.repeat(12)),status:v('ACTIVE'),principal:v(123456789),limit:v(null,'UNKNOWN'),contingent:v(0),payment:v(20000),paymentFrequency:v('MONTHLY'),nextPayment:v(null,'UNKNOWN'),nextDate:v(null,'UNKNOWN'),overdue:v(0,'UNKNOWN')}];
 await page.route('**/api/workspace-model?*',r=>r.fulfill({json:edge}));
 await page.goto(origin+'/dashboard?analysisId='+id+'&view=obligations');await page.locator('.ws-credit-depth').waitFor();
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:1000});await page.locator('.ws-credit-depth details').evaluateAll(nodes=>nodes.forEach(e=>e.open=true));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long portfolio '+width);
 }
 const overdue=page.locator('.ws-credit-depth dl>div').filter({has:page.getByText('Просрочка на дату источника',{exact:true})});assert.match(await overdue.innerText(),/Недостаточно данных/);assert.doesNotMatch(await overdue.innerText(),/0 ₽/);
 assert.match(await page.locator('.ws-observations').innerText(),/Требует обновления/);await page.screenshot({path:out+'/portfolio-edge-360.png',fullPage:true});pass('long creditor, stale source and unknown overdue');
 assert.deepEqual(errors,[]);pass('no browser runtime errors');
}catch(e){checks.push({name:'failure',status:'FAIL',error:e.stack});await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;console.error(e);}
finally{fs.writeFileSync(out+'/checks.json',JSON.stringify({checks,errors},null,2));await browser.close();}
