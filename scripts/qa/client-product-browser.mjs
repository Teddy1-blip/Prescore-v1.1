import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out=path.resolve(process.argv[2]??'/tmp/client-product-qa');fs.mkdirSync(out,{recursive:true});
let server;
async function startServer(){
 server=spawn(process.execPath,['--experimental-strip-types','scripts/qa/workspace-harness.mjs',out+'/harness','4189'],{stdio:['ignore','pipe','inherit']});
 server.on('exit',(code,signal)=>console.log('QA harness exit',JSON.stringify({code,signal})));
 await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(String(b).includes('listening'))resolve();});server.on('error',reject);server.on('exit',(code,signal)=>reject(Error('Harness exited '+code+' '+signal)));});
}
async function stopServer(){
 if(!server||server.exitCode!==null||server.signalCode!==null)return;
 const exited=once(server,'exit');server.kill('SIGTERM');const timer=setTimeout(()=>server.kill('SIGKILL'),10000);
 try{await exited;}finally{clearTimeout(timer);}
}
await startServer();
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext(),page=await context.newPage(),origin='http://127.0.0.1:4189',errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 let seed=await(await page.request.get(origin+'/__qa/seed')).json();fs.writeFileSync(out+'/seed.json',JSON.stringify(seed));
 for(const [width,height] of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800]]){
 await page.setViewportSize({width,height});
 for(const view of ['home','analysis','banking','obligations','financing','documents','applications','analyst','upload']){
 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view='+view);await page.locator('.pc-company b').waitFor();await page.waitForFunction(()=>!document.body.innerText.includes('Загружаем финансовую картину')&&!document.body.innerText.includes('Загружаем кабинет'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+view+' '+width);
 if(view==='home'&&(width===1440||width===390))await page.screenshot({path:out+'/overview-'+width+'.png'});
 if(width===1440||width===390)await page.screenshot({path:out+'/'+view+'-'+width+'.png',fullPage:true});
 if(view==='analysis'){for(const title of ['Стоп-факторы и риски','Экспертная оценка','Долговая ёмкость','Финансовое состояние','Кредитный портфель','Финансирование','Сверка','Рекомендации','План 7 / 30 / 60','Основания','История']){await page.getByRole('navigation',{name:'Разделы анализа',exact:true}).getByRole('button',{name:title,exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'analysis '+title+' '+width);}}
 checks.push(view+' '+width);
 }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/dashboard?analysisId='+seed.id);await page.getByRole('heading',{name:'Финансовая картина',exact:true}).waitFor();
 const navigation=page.getByRole('navigation',{name:'Разделы кабинета'});
 assert.deepEqual(await navigation.getByRole('button').evaluateAll(buttons=>buttons.map(button=>({label:button.querySelector('span')?.firstChild?.textContent,disabled:button.disabled}))),
  [
   {label:'Обзор',disabled:false},
   {label:'Финансы',disabled:false},
   {label:'Кредитный профиль',disabled:false},
   {label:'Финансирование',disabled:false},
   {label:'Документы',disabled:false},
   {label:'Заявки',disabled:false},
   {label:'Мониторинг',disabled:true},
   {label:'Контрагенты',disabled:true},
   {label:'Контракты',disabled:true},
  ]);
 assert.equal(await page.locator('.pc-content .pc-canonical').count(),0);
 let model=await(await page.request.get(origin+'/api/workspace-model?analysisId='+seed.id)).json();assert.match(await page.locator('[data-credit-index]').innerText(),new RegExp(String(model.full.canonical.prescoreIndex.value)));checks.push('canonical index and released navigation with future modules disabled');
 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view=financing');
 await page.getByLabel('Цель финансирования',{exact:true}).selectOption('WORKING_CAPITAL');
 await page.getByLabel('Предпочтительный продукт',{exact:true}).selectOption('CREDIT_LINE');
 await page.getByLabel('Запрошенная сумма, ₽',{exact:true}).fill('1000000');
 await page.getByLabel('Срок, месяцев',{exact:true}).fill('12');
 await page.getByLabel('Ставка сценария, % годовых',{exact:true}).fill('0');
 await page.getByRole('button',{name:'Сохранить параметры',exact:true}).click();
 await page.getByText('Параметры сохранены. Результат серверного расчёта обновляется в анализе.',{exact:true}).waitFor();
 await page.reload();await page.getByLabel('Ставка сценария, % годовых',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Ставка сценария, % годовых',{exact:true}).inputValue(),'0');
 const requested=await(await page.request.get(origin+'/api/workspace-model?analysisId='+seed.id)).json();
 assert.equal(requested.full.report.analysisV3.scenarios[0].rate,0);
 assert.equal(requested.full.canonical.productSelection.financingPurpose.value,'WORKING_CAPITAL');
 checks.push('saved financing purpose and explicit zero-rate scenario survive reload');
 await page.goto(origin+'/dashboard?analysisId='+seed.id);await page.getByRole('heading',{name:'Финансовая картина',exact:true}).waitFor();

 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view=analysis&section=factors');await page.getByRole('heading',{name:'Кредитный профиль',exact:true}).waitFor();
 await page.getByRole('button',{name:'Почему?',exact:true}).first().click();await page.getByRole('dialog',{name:'Основания вывода'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);checks.push('evidence modal keyboard');
 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view=home');await page.getByRole('heading',{name:'Финансовая картина',exact:true}).waitFor();
 const unknown=await(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-011')).json();await page.goto(origin+'/dashboard?analysisId='+unknown.id+'&view=home');await page.getByRole('heading',{name:'Финансовая картина',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Финансовая картина',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('analysisId'),unknown.id);checks.push('deep-linked analysis and reload');
 await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'Открыть меню',exact:true}).click();await page.getByRole('navigation',{name:'Разделы кабинета'}).getByRole('button',{name:'Документы',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Открыть меню'}).getAttribute('aria-expanded'),'false');checks.push('mobile navigation');

 await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
 for(const name of ['Мониторинг','Контрагенты','Контракты']){
  const later=page.getByRole('navigation',{name:'Разделы кабинета'}).getByRole('button',{name:new RegExp(name)});
  assert.equal(await later.isDisabled(),true);assert.match(await later.innerText(),/Позже/);
 }
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Закрыть навигацию'}).waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'Открыть меню'}).getAttribute('aria-expanded'),'false');
 assert.equal(await page.getByRole('button',{name:'Открыть меню'}).evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'Спросить Prescore',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('view')==='analyst');
 checks.push('Later sections disabled; mobile Escape restores focus; Ask Prescore opens the analyst');

 // Refresh preserves the mounted application table and local search state.
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view=applications');
 await page.getByPlaceholder('Банк, компания или продукт').fill('Оборотный');
 await page.route('**/api/workspace-model?*',async route=>{await new Promise(resolve=>setTimeout(resolve,650));await route.continue();});
 await page.getByRole('button',{name:'Обновить',exact:true}).click();
 await page.getByText('Обновляем данные. Текущая версия остаётся на экране.',{exact:true}).waitFor();
 assert.equal(await page.getByPlaceholder('Банк, компания или продукт').inputValue(),'Оборотный');
 await page.waitForFunction(()=>!document.body.innerText.includes('Обновляем данные. Текущая версия остаётся на экране.'));
 assert.equal(await page.getByPlaceholder('Банк, компания или продукт').inputValue(),'Оборотный');
 await page.unroute('**/api/workspace-model?*');checks.push('application table preserved through refresh');
 // Real business fixtures with missing/partial/conflicting sources.
 for(const caseId of ['011','013','016','017','022']){
  // Each source scenario owns an isolated in-memory runtime; no accumulated analyses.
  await stopServer();await startServer();
  const current=await(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-'+caseId)).json();
  for(const view of ['home','analysis','banking','obligations','financing','documents','applications','analyst']){
   await page.setViewportSize({width:360,height:1000});await page.goto(origin+'/dashboard?analysisId='+current.id+'&view='+view);
   await page.waitForFunction(()=>!document.body.innerText.includes('Загружаем финансовую картину')&&!document.body.innerText.includes('Загружаем кабинет'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'fixture '+caseId+' '+view);
   assert.doesNotMatch(await page.locator('main').innerText(),/NaN|Infinity|undefined/);
   checks.push('source state '+caseId+' '+view);
  }
 }
 await stopServer();await startServer();
 seed=await(await page.request.get(origin+'/__qa/seed')).json();
 model=await(await page.request.get(origin+'/api/workspace-model?analysisId='+seed.id)).json();
 // Server models remain authoritative; BASIC and unavailable states disclose no FULL data.
 for(const state of ['basic','unavailable']){
  const altered=structuredClone(model);delete altered.full;altered.state='READY_BASIC';altered.entitlement=state==='basic'?'BASIC':'FULL';altered.fullAvailability=state==='basic'?'LOCKED':'UNAVAILABLE';
  await page.route('**/api/workspace-model?*',route=>route.fulfill({json:altered}));
  for(const view of ['home','analysis','banking','obligations','financing','documents','applications','analyst']){
   await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view='+view);
   await page.locator('.pc-company b').waitFor();
   await page.waitForFunction(()=>!document.body.innerText.includes('Загружаем финансовую картину')&&!document.body.innerText.includes('Загружаем кабинет'));
   assert.equal(await page.locator('[data-credit-index]').count(),0);assert.equal(await page.locator('[data-prudential-capacity]').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),state+' '+view);
   checks.push(state+' '+view);
  }
  await page.unroute('**/api/workspace-model?*');
 }
 // Read-only broker sees history without mutation controls.
 await context.addCookies([{name:'qa-role',value:'broker',url:origin}]);
 await page.goto(origin+'/dashboard?client='+seed.id+'&from=agent&view=applications');
 await page.getByText('Режим просмотра',{exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Новая заявка',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Отменить',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Обновить данные',exact:true}).count(),0);
 checks.push('broker read-only applications');await context.clearCookies();
 // Failed model refresh retains the last model; retry restores it.
 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view=applications');
 await page.getByPlaceholder('Банк, компания или продукт').waitFor();
 await page.route('**/api/workspace-model?*',route=>route.fulfill({status:503,json:{error:'QA unavailable'}}));
 await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.getByText(/Показана последняя полученная версия/).waitFor();
 assert.equal(await page.getByPlaceholder('Банк, компания или продукт').count(),1);
 await page.unroute('**/api/workspace-model?*');await page.getByRole('button',{name:'Повторить',exact:true}).click();
 await page.waitForFunction(()=>!document.body.innerText.includes('Показана последняя полученная версия'));
 checks.push('failed refresh retains application table and recovers');
 // No saved analyses and initial API errors.
 const workspaceURL=url=>url.origin===origin&&url.pathname==='/api/workspace';
 const workspaceResponse=response=>workspaceURL(new URL(response.url()))&&response.request().method()==='GET';
 const intercepted={empty:[],unavailable:[]};
 const emptyWorkspace=async route=>{intercepted.empty.push(route.request().url());await route.fulfill({status:200,json:{analyses:[],deals:[],readOnly:false}});};
 await page.route(workspaceURL,emptyWorkspace);
 const emptyResponse=page.waitForResponse(workspaceResponse);await page.goto(origin+'/dashboard');
 const empty=await emptyResponse;assert.equal(empty.status(),200);assert.deepEqual((await empty.json()).analyses,[]);
 assert.ok(intercepted.empty.includes(empty.url()));assert.equal(new URL(empty.url()).searchParams.get('projection'),'summary');
 await page.getByRole('button',{name:'Создать новый анализ',exact:true}).waitFor();
 assert.equal(await page.locator('[data-credit-index]').count(),0);assert.equal(await page.locator('.pc-recent-analyses').count(),0);checks.push('intercepted empty summary: no analysis actionable state');
 await page.unroute(workspaceURL,emptyWorkspace);
 const unavailableWorkspace=async route=>{intercepted.unavailable.push(route.request().url());await route.fulfill({status:503,json:{error:'QA unavailable'}});};
 await page.route(workspaceURL,unavailableWorkspace);
 const unavailableResponse=page.waitForResponse(workspaceResponse);await page.goto(origin+'/dashboard');
 const unavailable=await unavailableResponse;assert.equal(unavailable.status(),503);assert.deepEqual(await unavailable.json(),{error:'QA unavailable'});
 assert.ok(intercepted.unavailable.includes(unavailable.url()));assert.equal(new URL(unavailable.url()).searchParams.get('projection'),'summary');
 await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/Повторить/);
 await page.unroute(workspaceURL,unavailableWorkspace);
 const recoveredResponse=page.waitForResponse(workspaceResponse);await page.getByRole('button',{name:'Повторить',exact:true}).click();
 assert.equal((await recoveredResponse).status(),200);await page.getByRole('heading',{name:'Финансовая картина',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[role="alert"]')===null);
 checks.push('intercepted summary 503: visible alert and successful retry');
 assert.deepEqual(errors,[]);checks.push('no browser runtime errors');console.log('PASS',checks.length);
}catch(e){console.error(e);await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;}finally{fs.writeFileSync(out+'/result.json',JSON.stringify({checks,errors},null,2));await browser.close();await stopServer();}
