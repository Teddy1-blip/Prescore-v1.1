// Isolated browser acceptance of the source forms, reload and role-specific projections.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {financialFile,corporateBkiFile} from '../../tests/fixtures/polish-sources.mjs';
import {syntheticPdf} from '../release/pdf-fixture.mjs';
import {statementFixture} from '../../tests/fixtures/block1-statements.mjs';

const out=path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(),'stage3-sources-')));
fs.mkdirSync(out,{recursive:true});
const listener=createServer().listen(0,'127.0.0.1');
await once(listener,'listening');
const port=listener.address().port;
await new Promise(resolve=>listener.close(resolve));
const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['--experimental-strip-types','scripts/qa/workspace-harness.mjs',path.join(out,'harness'),String(port)],{stdio:['ignore','pipe','inherit']});
let browser;
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Workspace startup timed out')),60000);
    server.stdout.on('data',chunk=>{if(String(chunk).includes('Workspace QA listening')){clearTimeout(timeout);resolve();}});
    server.once('exit',()=>{clearTimeout(timeout);reject(new Error('Workspace exited'));});
    server.once('error',error=>{clearTimeout(timeout);reject(error);});
  });
  browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.request.post(base+'/api/analysis',{data:{statements:[{fileName:'synthetic.txt',text:statementFixture()}]}});
  assert.equal(response.status(),200);
  const {analysis:{id,companyInn}}=await response.json();
  const client=(view)=>base+'/dashboard?view='+view+'&analysisId='+id;
  const endpoint=base+'/api/workspace-model?analysisId='+id;
  const model=async p=>{const r=await p.request.get(endpoint);assert.equal(r.status(),200);return r.json();};
  const year=(period,revenue,ext='csv')=>financialFile(companyInn,ext,{period,revenue});
  const formUpload=async(kind,file,status)=>{
    const form=page.locator('#source-'+kind);
    await form.locator('input[type=file]').setInputFiles({name:file.name,mimeType:file.type||'application/octet-stream',buffer:Buffer.from(await file.arrayBuffer())});
    await form.locator('input[type=checkbox]').check();
    const [r]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/source-documents')&&r.request().method()==='POST'), form.getByRole('button',{name:'Загрузить документ',exact:true}).click()]);
    const body=await r.json();assert.equal(r.status(),status,body.error);
    if(status>=400) await form.getByRole('alert').waitFor();
    await page.waitForFunction(sel=>document.querySelector(sel)?.getAttribute('aria-busy')==='false','#source-'+kind);
    return body;
  };
  await page.goto(client('documents'));
  const basicUpload=await formUpload('bfo',year('2024 год',1000),200);
  assert.deepEqual(Object.keys(basicUpload.source).sort(),['sourceType','status']);
  const basic=await model(page);assert.ok(!basic.full);
  assert.equal((await page.request.get(base+'/__qa/assign?id='+id+'&full=1')).status(),200);
  await page.reload();
  await formUpload('bfo',year('2025 год',1200,'pdf'),200);
  await formUpload('quarterly',year('Январь - Март 2026 г.',350,'xlsx'),200);
  await formUpload('bki',corporateBkiFile(companyInn),200);
  const old=await model(page);
  const annual=m=>m.full.report.financialAnalysis.history.find(p=>p.period.to==='2025-12-31');
  const revenue=p=>p.groups.flatMap(g=>g.metrics).find(v=>v.key==='REVENUE').value;
  assert.equal(revenue(annual(old)),1200000);
  await formUpload('bfo',year('2025 год',1350),200);
  const current=await model(page), history=current.full.report.financialAnalysis.history;
  assert.equal(history.length,3);assert.equal(revenue(annual(current)),1350000);
  assert.notEqual(annual(current).id,annual(old).id);
  await formUpload('bfo',year('2025 год',1350),409);
  await formUpload('bfo',year('2025 год',1200,'pdf'),409);
  const failed=await formUpload('bfo',new File([syntheticPdf([' '])],'blank.pdf',{type:'application/pdf'}),400);
  assert.match(failed.error,/текст|скан/i);
  assert.deepEqual((await model(page)).full,current.full);
  for(const code of ['BANK_STATEMENTS','FINANCIAL_STATEMENTS','QUARTERLY_REPORT','CREDIT_HISTORY']){
    assert.ok(current.basic.sources.availability.some(s=>s.source===code && s.status==='READY'),code);
  }
  const broker=await browser.newContext({viewport:{width:1440,height:1000}});
  await broker.addCookies([{name:'qa-role',value:'broker',url:base}]);
  const bp=await broker.newPage();
  assert.deepEqual((await model(bp)).full,current.full);
  const card=page.getByRole('region',{name:'Динамика и структура отчётности'});
  const bureau=page.getByLabel('Таблица обязательств');
  const proofs=[];
  for(const width of [1440,390]){
    const size={width,height:width===390?844:1000};
    await page.setViewportSize(size);await bp.setViewportSize(size);
    await page.goto(client('banking'));await card.waitFor();
    assert.equal(await card.locator('[data-flow-group]').count(),2);
    assert.match((await card.innerText()).replace(/\s/g,''),/1350000₽/);
    const visible=await card.innerText();await page.reload();await card.waitFor();assert.equal(await card.innerText(),visible);
    await bp.goto(base+'/agent?view=dossier&analysisId='+id+'&dossierView=banking');
    const brokerCard=bp.getByRole('region',{name:'Динамика и структура отчётности'});await brokerCard.waitFor();
    assert.equal(await brokerCard.innerText(),visible);
    for(const p of [page,bp]) assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'financial overflow '+width);
    await card.screenshot({path:path.join(out,'financial-'+width+'.png')});
    await page.goto(client('obligations'));await bureau.waitFor();
    const portfolio=await bureau.innerText();assert.match(portfolio,/Тест Банк/);assert.match(portfolio,/Неиспользованный лимит/);
    await bp.goto(base+'/agent?view=dossier&analysisId='+id+'&dossierView=obligations');
    const bt=bp.getByLabel('Таблица обязательств');await bt.waitFor();assert.equal(await bt.innerText(),portfolio);
    await bureau.screenshot({path:path.join(out,'portfolio-'+width+'.png')});
    await page.goto(client('analysis')+'&section=reconciliation');
    const drill=page.getByText('Сравнить исходные показатели',{exact:true}).first();await drill.click();
    const details=drill.locator('..');assert.ok(await details.locator('.pc-recon-value').count()>0);
    await details.screenshot({path:path.join(out,'reconciliation-'+width+'.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'reconciliation overflow '+width);
    proofs.push({width,clientBrokerFinancialAndDebt:true,drilldown:true});
  }
  assert.deepEqual(errors,[]);
  const evidence={forms:['annual PDF/CSV','interim XLSX','corporate bureau PDF'],activePeriods:3,replacement:true,
    duplicateCurrent:409,duplicateRetired:409,unreadablePdf:400,preservedAfterRejection:true,basicUploadRedacted:true,reload:true,proofs,pageErrors:0};
  fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(evidence,null,2));console.log('PASS',JSON.stringify(evidence));
} finally {await browser?.close();server.kill('SIGTERM');}
