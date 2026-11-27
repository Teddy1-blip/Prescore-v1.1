// Phase 1 presentation QA against the isolated workspace-harness, never live data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4187',out=path.resolve(process.argv[2]??'build/recovery-phase1');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),checks=[],errors=[];
await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const pass=name=>checks.push({name,status:'PASS'});
const ready=()=>page.locator('.ws-banking-kpis').waitFor();
async function layout(name){
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow '+width);
  const box=await page.locator('.ps-topbar').boundingBox(),company=await page.locator('.ps-company').boundingBox();
  assert.ok(company.x>=0&&company.x+company.width<=width&&company.y+company.height<=box.y+box.height+1);
  const actions=await page.locator('.ps-top-actions').boundingBox();
  assert.ok(company.x+company.width<=actions.x||company.y+company.height<=actions.y,'topbar overlap');
  if(width<=850){
   await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
   const nav=page.getByRole('navigation',{name:'Разделы кабинета'});
   await nav.getByRole('button',{name:'Обзор',exact:true}).click();await ready();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ps-sidebar')).visibility==='hidden');
  }
  await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});
  if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`${name}-mobile-viewport.png`)});}
 }
 pass(name+' desktop/tablet/mobile layout and menu');
 await page.setViewportSize({width:1440,height:1000});
}
try{
 const text=fs.readFileSync(process.argv[3]??'/tmp/p1-browser/harness/statement.txt','utf8');
 const uploaded=await page.request.post(origin+'/api/analysis',{data:{statements:[{fileName:'phase1.txt',text}]}});
 assert.equal(uploaded.status(),200);const basicId=(await uploaded.json()).analysis.id;
 await page.goto(origin+'/dashboard?analysisId='+basicId);await ready();
 assert.equal(await page.locator('.ws-credit-overview').count(),0);
 assert.ok(await page.locator('.ws-banking-details').isVisible());await layout('basic');
 await page.goto(origin+'/dashboard?analysisId='+basicId+'&view=upload');
 await page.locator('input[type=file]').waitFor({state:'attached'});await page.reload();
 await page.locator('input[type=file]').waitFor({state:'attached'});
 assert.equal(new URL(page.url()).searchParams.get('view'),'upload');pass('upload URL survives reload');
 const seed=await page.request.get(origin+'/__qa/seed');assert.equal(seed.status(),200);const fullId=(await seed.json()).id;
 await page.goto(origin+'/dashboard?analysisId='+fullId);await ready();
 const full=await(await page.request.get(origin+'/api/workspace-model?analysisId='+fullId)).json();
 assert.equal(await page.locator('.ws-index>strong').textContent(),String(full.full.canonical.prescoreIndex.value));
 assert.equal(await page.locator('.ps-company b').textContent(),full.basic.analysis.company.name);
 assert.ok(await page.locator('.ws-banking-details').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('.ws-credit-overview'))&Node.DOCUMENT_POSITION_FOLLOWING)));
 await layout('full');pass('credit follows banking and index matches canonical');
 await page.getByRole('combobox',{name:'Сохранённый анализ'}).selectOption(basicId);await ready();
 await page.reload();await ready();assert.equal(new URL(page.url()).searchParams.get('analysisId'),basicId);pass('saved analysis selection and reload');
 const unavailableSeed=await page.request.get(origin+'/__qa/seed?unavailable=1');assert.equal(unavailableSeed.status(),200);const unavailableId=(await unavailableSeed.json()).id;
 await page.goto(origin+'/dashboard?analysisId='+unavailableId);await ready();
 assert.equal(await page.locator('a[href^="/checkout"]').count(),0);
 await page.getByRole('button',{name:'Повторить загрузку расчёта'}).click();await ready();
 assert.equal(await page.locator('a[href^="/checkout"]').count(),0);await layout('full-unavailable');
 await page.route('**/api/modules',route=>route.fulfill({json:{modules:{analysis:false,analyst:false,company:false}}}));
 await page.reload();await ready();
 assert.equal(await page.getByRole('button',{name:'Новый анализ',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Компания и отчётность',exact:true}).count(),0);
 await page.goto(origin+'/dashboard?analysisId='+basicId+'&view=upload');
 await page.getByText('Раздел временно недоступен.',{exact:true}).waitFor();assert.equal(await page.locator('input[type=file]').count(),0);pass('disabled modules hide actions and give explicit deep-link state');
 await page.unroute('**/api/modules');
 await context.addCookies([{name:'qa-role',value:'broker',url:origin}]);
 await page.goto(origin+'/dashboard?client='+fullId+'&view=upload');
 await page.getByText('Загрузка выписок недоступна в режиме чтения.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Новый анализ',exact:true}).count(),0);
 assert.equal(await page.locator('input[type=file]').count(),0);pass('read-only has no upload action or empty screen');
 await context.addCookies([{name:'qa-role',value:'owner',url:origin}]);
 await page.goto(origin+'/dashboard?analysisId='+fullId);await ready();
 assert.doesNotMatch(await page.locator('body').innerText(),/WorkspaceModelV1|presentation|Расчётный модуль работает/);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.ws-flow-bar').first().evaluate(e=>parseFloat(getComputedStyle(e).transitionDuration)),0);
 assert.deepEqual(errors,[]);pass('client copy, reduced motion and no runtime errors');
}catch(e){checks.push({name:'failure',status:'FAIL',error:e.stack});await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;console.error(e);}
finally{fs.writeFileSync(out+'/checks.json',JSON.stringify({checks,errors},null,2));await browser.close();}
