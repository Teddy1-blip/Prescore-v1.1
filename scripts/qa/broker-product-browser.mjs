import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out=path.resolve(process.argv[2]??'/tmp/broker-product-qa');fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['--experimental-strip-types','scripts/qa/workspace-harness.mjs',out+'/harness','4190'],{stdio:['ignore','pipe','inherit'],env:{...process.env,PRESCORE_STORAGE_ROOT:out+'/storage'}});
await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(String(b).includes('listening'))resolve();});server.on('error',reject);server.on('exit',c=>reject(Error('Harness exit '+c)));});
let browser;const checks=[],errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const context=await browser.newContext(),page=await context.newPage(),origin='http://127.0.0.1:4190';page.on('pageerror',e=>errors.push(e.message));
 const get=url=>page.request.get(url,{maxRetries:2});
 const seed=await(await get(origin+'/__qa/seed')).json();
 const owner=await(await get(origin+'/api/workspace-model?analysisId='+seed.id)).json();
 await context.addCookies([{name:'qa-role',value:'broker',url:origin}]);
 const assigned=await(await get(origin+'/api/workspace-model?analysisId='+seed.id)).json();
 assert.equal(assigned.access.role,'ASSIGNED_BROKER');assert.equal(assigned.access.readOnly,true);assert.deepEqual(assigned.full.canonical,owner.full.canonical);assert.deepEqual(assigned.full.report,owner.full.report);checks.push('owner and assigned broker canonical/report equality');
 const list=await(await get(origin+'/api/agent?surface=clients')).json();
 const lead=list.leads.find(l=>l.analysisId===seed.id);assert.ok(lead);const company='/agent/clients/'+lead.id;
 await page.goto(origin+'/agent/applications?action=new');await page.getByLabel('Цель финансирования',{exact:true}).fill('Оборотные средства');
 await page.locator('input[name=consent]').check();await page.getByRole('dialog').getByRole('button',{name:'Добавить заявку'}).click();
 await page.getByText('Заявка добавлена',{exact:true}).waitFor();
 const apps=await(await get(origin+'/api/agent?surface=applications')).json(),app=apps.applications.find(a=>a.leadId===lead.id);
 assert.ok(app);const application='/agent/applications/'+app.id;
 const screens=[['/agent','Рабочий стол'],['/agent/clients','Клиенты'],['/agent/leads','Gold44'],['/agent/pipeline','Воронка'],['/agent/applications','Заявки'],['/agent/documents','Документы'],
   ['/agent/partners','Банки и партнёры'],['/agent/commissions','Комиссии'],['/agent/network','Агентская сеть'],['/agent/notifications','Уведомления'],['/agent/assistant','Спросить Prescore'],
   ...['','credit-profile','finance','financing','documents','applications'].map(s=>[company+(s?'/'+s:''),seed.companyName]),
   ...['','comments','documents','history','prescore','partner'].map(s=>[application+(s?'/'+s:''),seed.companyName])];
 async function ready(path,title){
   await page.goto(origin+path);await page.locator('main').waitFor();
   if(path==='/agent/leads')await page.locator('.gp-shell').waitFor();
   else await page.getByRole('heading',{name:title,exact:true}).first().waitFor();
   await page.waitForFunction(()=>!['Загружаем раздел…','Загружаем комиссии…'].some(s=>document.querySelector('main')?.innerText.includes(s)));
   assert.equal(new URL(page.url()).pathname,path, 'real pathname');
   assert.equal(await page.locator('main').getByRole('alert').count(),0,path+' alert: '+await page.locator('main').innerText());
 }
 for(const [width,height] of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800]]){
   await page.setViewportSize({width,height});
   for(const [path,title] of screens){
     await ready(path,title);
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1?[]:
       Array.from(document.querySelectorAll('main, main *')).filter(n=>n.getBoundingClientRect().right>innerWidth+1&&!n.closest('.ag-board,.ag-table-wrap')).map(n=>n.tagName+'.'+n.className).slice(0,10));
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+path+' '+width+' '+overflow.join(', '));
     assert.doesNotMatch(await page.locator('body').innerText(),/кабинет брокера/i);
     if([1440,390].includes(width)&&['/agent','/agent/clients','/agent/pipeline',company,application].includes(path))
       await page.screenshot({path:out+'/'+(path==='/agent'?'desk':path.split('/').at(-1))+'-'+width+'.png',fullPage:true});
     checks.push(path+' '+width);
   }
 }
 await page.setViewportSize({width:1440,height:960});await ready('/agent','Рабочий стол');
 for(const [label,path] of [['Клиенты','/agent/clients'],['Заявки','/agent/applications'],['Воронка','/agent/pipeline']]){
   await page.getByRole('navigation',{name:'Разделы кабинета'}).getByRole('link',{name:label,exact:true}).click();
   await page.waitForURL(origin+path);await page.reload();await page.waitForURL(origin+path);
 }
 await page.goBack();assert.equal(new URL(page.url()).pathname,'/agent/applications');await page.goForward();assert.equal(new URL(page.url()).pathname,'/agent/pipeline');checks.push('links, reload, history back/forward');
 await ready(company,seed.companyName);assert.ok((await page.locator('main').innerText()).includes(String(assigned.full.canonical.prescoreIndex.value)));
 await page.getByRole('link',{name:'Кредитный профиль',exact:true}).click();await page.waitForURL(origin+company+'/credit-profile');
 await page.getByRole('button',{name:'Стоп-факторы и риски',exact:true}).click();await page.reload();assert.equal(new URL(page.url()).searchParams.get('section'),'factors');checks.push('canonical dossier and copied credit-profile URL');
 await ready('/agent/clients','Клиенты');await page.getByRole('button',{name:'+ Добавить клиента',exact:true}).click();
 await page.getByLabel('Компания',{exact:true}).fill('ООО Новый клиент');await page.getByLabel('ИНН',{exact:true}).fill('7701234567');
 await page.getByLabel('Контактное лицо',{exact:true}).fill('Тестовый контакт');await page.getByLabel('Email',{exact:true}).fill('new@qa.test');
 await page.locator('input[name=consent]').check();await page.getByRole('dialog').getByRole('button',{name:'Добавить клиента'}).click();await page.getByText('Клиент добавлен',{exact:true}).waitFor();
 await page.reload();await page.getByPlaceholder('Компания, ИНН или контакт').fill('7701234567');await page.getByRole('link',{name:'ООО Новый клиент',exact:true}).waitFor();checks.push('CRM creation, search, reload');
 await ready(application+'/partner',seed.companyName);await page.getByLabel('Статус заявки').selectOption('Требуются документы');
 await page.waitForFunction(()=>document.querySelector('.ag-title .ag-badge')?.textContent==='Требуются документы');await page.reload();
 assert.equal(await page.getByLabel('Статус заявки').inputValue(),'Требуются документы');
 await ready(application+'/history',seed.companyName);await page.getByText(/→ Требуются документы/).waitFor();checks.push('application status, reload and persisted timeline');
 await page.setViewportSize({width:390,height:844});await ready(application+'/comments',seed.companyName);
 await page.getByLabel('Сообщение',{exact:true}).fill('Уточните документы для заявки');await page.getByRole('button',{name:'Отправить сообщение'}).click();
 await page.getByText('Уточните документы для заявки',{exact:true}).waitFor();await page.locator('.ps-chat-panel input[type=file]').setInputFiles({name:'agent-qa.txt',mimeType:'text/plain',buffer:Buffer.from('QA attachment')});
 await page.getByText('Прикреплён документ: agent-qa.txt',{exact:true}).waitFor();await page.reload();await page.getByText('Уточните документы для заявки',{exact:true}).waitFor();
 await ready(application+'/documents',seed.companyName);await page.getByRole('link',{name:'agent-qa.txt'}).waitFor();
 await ready('/agent/documents','Документы');await page.getByRole('link',{name:'agent-qa.txt'}).waitFor();checks.push('chat, attachment and authorised document centre');
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Открыть меню'}).getAttribute('aria-expanded'),'false');
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.getByRole('navigation',{name:'Разделы кабинета'}).getByRole('link',{name:'Воронка'}).click();await page.waitForURL(origin+'/agent/pipeline');checks.push('keyboard drawer and mobile navigation');
 await context.addCookies([{name:'qa-role',value:'stranger',url:origin}]);assert.equal((await get(origin+'/api/workspace-model?analysisId='+seed.id)).status(),404);checks.push('stranger forbidden');
 // Real components and real API on isolated data: owner confirmation is exercised
 // through the form; switching to BROKER never borrows ADMIN authority.
 await context.addCookies([{name:'qa-role',value:'owner',url:origin}]);
 await page.goto(origin+'/dashboard?view=documents&analysisId='+seed.id);
 const permissions=page.locator('section.ps-card').filter({has:page.getByRole('heading',{name:'Разрешения агенту',exact:true})});
 await permissions.getByRole('button',{name:'Отозвать',exact:true}).waitFor();
 let permissionResponse=page.waitForResponse(r=>r.url()===origin+'/api/workspace'&&r.request().method()==='POST');
 await permissions.getByRole('button',{name:'Отозвать',exact:true}).click();assert.equal((await permissionResponse).status(),200);
 await page.reload();await permissions.getByRole('heading',{name:'Разрешения агенту',exact:true}).waitFor();
 assert.equal(await permissions.getByRole('button',{name:'Отозвать',exact:true}).count(),0);
 await context.addCookies([{name:'qa-role',value:'broker',url:origin}]);
 assert.equal((await get(origin+'/api/workspace-model?analysisId='+seed.id)).status(),404);
 assert.equal((await get(origin+'/api/workspace?client='+seed.id)).status(),404);
 await context.addCookies([{name:'qa-role',value:'owner',url:origin}]);
 await page.goto(origin+'/dashboard?view=documents&analysisId='+seed.id);
 await permissions.getByLabel('Почта агента',{exact:true}).fill('broker@workspace.test');
 await permissions.getByRole('combobox',{name:'Вид разрешения',exact:true}).selectOption('DOSSIER');
 await permissions.getByRole('checkbox').check();
 for(const width of [1440,390,360]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'owner permission form overflow '+width);await permissions.screenshot({path:out+'/owner-permission-'+width+'.png'});}
 permissionResponse=page.waitForResponse(r=>r.url()===origin+'/api/workspace'&&r.request().method()==='POST');
 await permissions.getByRole('button',{name:'Подтвердить разрешение',exact:true}).click();assert.equal((await permissionResponse).status(),201);
 await page.reload();await permissions.getByRole('button',{name:'Отозвать',exact:true}).waitFor();
 const freshGrants=await(await get(origin+'/api/workspace?projection=broker-authorizations&analysisId='+seed.id)).json();assert.equal(freshGrants.grants.length,1);assert.equal(freshGrants.grants[0].action,'GRANT_DOSSIER');
 await context.addCookies([{name:'qa-role',value:'broker',url:origin}]);
 await page.goto(origin+company+'/documents');await page.getByRole('navigation',{name:'Разделы досье'}).waitFor();await page.reload();await page.getByRole('navigation',{name:'Разделы досье'}).waitFor();
 assert.equal((await get(origin+'/api/workspace-model?analysisId='+seed.id)).status(),200);
 assert.equal(await page.getByRole('heading',{name:'Разрешения агенту',exact:true}).count(),0);
 checks.push('owner permission form at desktop/390/360, revoke stale broker, separate dossier grant, reload, no ADMIN');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors}));
}catch(error){console.error(error);const pages=browser?.contexts().flatMap(c=>c.pages())??[];if(pages[0]){await pages[0].screenshot({path:out+'/failure.png',fullPage:true});fs.writeFileSync(out+'/failure.txt',await pages[0].locator('body').innerText());}fs.writeFileSync(out+'/result.json',JSON.stringify({checks,errors,failure:String(error)},null,2));throw error;}finally{await browser?.close();server.kill('SIGTERM');}
