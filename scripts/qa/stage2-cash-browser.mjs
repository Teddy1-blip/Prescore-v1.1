// Exercise the real upload form, stored reports and scoped bank projection in the isolated workspace.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {realBankBrowser} from './bank-real-browser.mjs';
import {cashStatement} from '../../tests/fixtures/stage2-cash.mjs';
import {statementFixture} from '../../tests/fixtures/block1-statements.mjs';

const out=path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(),'stage2-cash-')));
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
 await page.goto(base+'/dashboard?view=upload');
 const upload=page.locator('input[type=file]').first();
 await upload.waitFor({state:'attached',timeout:15000});
 const book=Buffer.from(cashStatement()); const txt=statementFixture({inn:'9999999999'});
 const decode=new TextDecoder('windows-1251');const bytes=new Map(Array.from({length:256},(_,i)=>[decode.decode(new Uint8Array([i])),i]));
 await upload.setInputFiles([{name:'Контрольная выписка.txt',mimeType:'text/plain',buffer:book},{name:'Другой владелец.txt',mimeType:'text/plain',buffer:Buffer.from([...txt].map(c=>bytes.get(c))) }]);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/analysis')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Рассчитать по выбранным файлам'}).click();
 const r=await response; assert.equal(r.status(),200);
 const body=await r.json(), id=body.analysis.id;assert.deepEqual(body.screeningResults.map(r=>r.status),['ACCEPTED','COMPANY_MISMATCH']);
 await page.waitForURL(u=>u.searchParams.get('analysisId')===id,{timeout:12000});
 const url=base+'/dashboard?view=banking&analysisId='+id;
 await page.goto(url);
 await page.getByRole('group',{name:'Режим графика'}).waitFor({timeout:12000});
 assert.equal(await page.getByText('Список операций доступен в полном анализе.').count(),1);
 const basic=await page.request.get(base+'/api/workspace-model?analysisId='+id+'&projection=cash-operations&month=2026-07&series=externalInflows');assert.equal(basic.status(),403);
 const grant=await page.request.get(base+'/__qa/assign?id='+id+'&full=1');assert.equal(grant.status(),200);
 await page.reload();const buttons=page.getByRole('group',{name:'Режим графика'});
 await buttons.getByRole('button',{name:'Состав поступлений'}).click();
 const detail=page.getByRole('region',{name:'Расшифровка операций'});
 const check=async(label, value,rows)=>{
   await page.getByRole('button',{name:new RegExp('^'+label+' ·')}).click();
   await detail.locator('li').first().waitFor();
   assert.equal(await detail.locator('li').count(),rows);assert.ok((await detail.innerText()).replace(/\s/g,'').includes(value+'₽'));
 };
 await check('Внеоперационные поступления','20,03',1);
 await page.reload();await detail.locator('li').first().waitFor();assert.match(await detail.innerText(),/Возврат ранее перечисленных/);
 await buttons.getByRole('button',{name:'Долг и лизинг'}).click();await check('Основной долг','91,17',1);
 await buttons.getByRole('button',{name:'В бюджет'}).click();await check('Налоги','15,06',1);
 await buttons.getByRole('button',{name:'Общий поток'}).click();await check('Внешние поступления','1020,15',2);
 const screenshots=[];
 for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===1440?1000:844});
   await buttons.scrollIntoViewIfNeeded();
   const size=await page.evaluate(()=>({screen:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(size.content<=width,JSON.stringify(size));
   const panel=page.getByRole('region',{name:'Сверка остатков'}).locator('..');
   await panel.screenshot({path:path.join(out,'cash-'+width+'.png')});
   screenshots.push({...size,rows:await detail.locator('li').count(),balance:await panel.getByRole('heading',{name:'Изменение остатка'}).count()});
 }
 // A gap cannot be presented as a zero or as a clickable list of payments.
 const gapUpload=await page.request.post(base+'/api/analysis',{data:{statements:[
   {fileName:'first.txt',text:cashStatement()},{fileName:'last.txt',text:cashStatement().replaceAll('.07.2026','.09.2026').replaceAll('31.09.2026','30.09.2026')},
 ]}});
 assert.equal(gapUpload.status(),200);const gapId=(await gapUpload.json()).analysis.id;
 await page.goto(base+'/dashboard?view=banking&analysisId='+gapId);
 const gap=page.getByText('08.2026',{exact:true}).first().locator('../..');
 await gap.waitFor();assert.match(await gap.innerText(),/Нет покрытия/);assert.match(await gap.innerText(),/Нет данных/);
 assert.equal(await gap.getByRole('button').count(),0);
 const real=process.env.PRESCORE_QA_BANK_TXT ? await realBankBrowser(page,base,process.env.PRESCORE_QA_BANK_TXT,process.env.PRESCORE_QA_ZERO_TXT) : null;
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-acceptance.json'),JSON.stringify({real,missingMonthVisible:true,upload:['1C TXT accepted','CP1251 TXT other INN excluded'],sampleRows:4,basic:403,full:200,drilldownModes:4,reload:true,screenshots,pageErrors:errors},null,2));
 console.log('BROWSER PASS',screenshots);
 } finally {
  await browser?.close();
  server.kill('SIGTERM');
}
