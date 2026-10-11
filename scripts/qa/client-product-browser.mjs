import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out=path.resolve(process.argv[2]??'/tmp/client-product-qa');fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['--experimental-strip-types','scripts/qa/workspace-harness.mjs',out+'/harness','4189'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(String(b).includes('listening'))resolve();});server.on('exit',c=>reject(Error('Harness exited '+c)));});
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext(),page=await context.newPage(),origin='http://127.0.0.1:4189',errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const seed=await(await page.request.get(origin+'/__qa/seed')).json();fs.writeFileSync(out+'/seed.json',JSON.stringify(seed));
 for(const width of [1440,1024,768,390,360]){
 await page.setViewportSize({width,height:1000});
 for(const view of ['home','analysis','banking','obligations','financing','documents','applications','analyst','upload']){
 await page.goto(origin+'/dashboard?analysisId='+seed.id+'&view='+view);await page.getByLabel('Сохранённый анализ').waitFor();await page.waitForFunction(()=>!document.body.innerText.includes('Загружаем финансовую картину')&&!document.body.innerText.includes('Загружаем кабинет'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+view+' '+width);
 if(width===1440||width===390)await page.screenshot({path:out+'/'+view+'-'+width+'.png',fullPage:true});
 if(view==='analysis'){for(const title of ['Оценка и риски','Долговая ёмкость','Финансовое состояние','Обязательства','Финансирование','Сопоставление данных','План действий','Источники']){await page.getByRole('navigation',{name:'Разделы анализа',exact:true}).getByRole('button',{name:title,exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'analysis '+title+' '+width);}}
 checks.push(view+' '+width);
 }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/dashboard?analysisId='+seed.id);await page.getByRole('heading',{name:'Обзор компании',exact:true}).waitFor();
 assert.equal(await page.getByRole('navigation',{name:'Разделы кабинета'}).getByRole('button').count(),8);assert.equal(await page.locator('.pc-content .pc-canonical').count(),0);
 const model=await(await page.request.get(origin+'/api/workspace-model?analysisId='+seed.id)).json();assert.match(await page.locator('[data-credit-index]').innerText(),new RegExp(String(model.full.canonical.prescoreIndex.value)));checks.push('canonical index and eight navigation entries');
 await page.getByRole('button',{name:'Почему?',exact:true}).first().click();await page.getByRole('dialog',{name:'Основания вывода'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);checks.push('evidence modal keyboard');
 const unknown=await(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-011')).json();await page.reload();await page.getByLabel('Сохранённый анализ').selectOption(unknown.id);await page.getByRole('heading',{name:'Обзор компании',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Обзор компании',exact:true}).waitFor();assert.equal(await page.getByLabel('Сохранённый анализ').inputValue(),unknown.id);checks.push('selection and reload');
 await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'Открыть меню',exact:true}).click();await page.getByRole('navigation',{name:'Разделы кабинета'}).getByRole('button',{name:'Документы',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Открыть меню'}).getAttribute('aria-expanded'),'false');checks.push('mobile navigation');
 assert.deepEqual(errors,[]);checks.push('no browser runtime errors');console.log('PASS',checks.length);
}catch(e){console.error(e);await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;}finally{fs.writeFileSync(out+'/result.json',JSON.stringify({checks,errors},null,2));await browser.close();server.kill('SIGTERM');}
