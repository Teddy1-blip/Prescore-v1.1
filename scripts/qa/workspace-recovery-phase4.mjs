// Synthetic local QA. Every AI response is mocked; external requests are blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4187',out=path.resolve(process.argv[2]??'/tmp/p4-browser/ai');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),checks=[],errors=[];
const pass=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
page.on('pageerror',e=>errors.push(e.message));
let state='empty',releaseGet,releasePost,postCount=0;
const message=text=>({id:crypto.randomUUID(),role:'assistant',content:text,createdAt:new Date().toISOString()});
const long='Подтверждённый банковский результат. Ограничения источников сохранены. Следующее действие взято из готового плана.\n\n'.repeat(35)+'ДлиннаяСтрока'.repeat(60);
await context.route('**/api/ai-analyst*',async r=>{
 if(r.request().method()==='POST'){postCount++;await new Promise(resolve=>{releasePost=resolve;});return r.fulfill({status:state==='error'?503:200,json:state==='error'?{error:'Тестовая ошибка провайдера'}:{message:message('Ответ по выбранному анализу'),mode:'rules'}});}
 if(state==='loading')await new Promise(resolve=>{releaseGet=resolve;});
 if(state==='locked')return r.fulfill({status:403,json:{locked:true,error:'Кредитный аналитик доступен в Prescore Full'}});
 if(state==='unavailable')return r.fulfill({status:503,json:{error:'Полный кредитный анализ временно недоступен. Банковские результаты сохранены.'}});
 return r.fulfill({json:{available:true,mode:state==='provider'?'provider':'rules',messages:state==='long'?[message(long)]:[],promptVersion:'PRESCORE-AI-ANALYST-CANONICAL-1.0'}});
});
const go=async id=>{await page.goto(origin+'/dashboard?analysisId='+id+'&view=analyst');await page.getByRole('heading',{name:'Кредитный аналитик Prescore',exact:true}).waitFor();};
try{
 const a=await(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-001')).json(),b=await(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-011')).json();
 await go(a.id);await page.locator('.ps-ai-empty').waitFor();assert.match(await page.locator('.ps-heading').innerText(),/Сам расчёт он не изменяет/);assert.doesNotMatch(await page.locator('.ps-ai-shell').innerText(),/Risk Context|UnifiedRiskContext|WorkspaceModelV1|legacy|\bscore\b|расчётный диапазон/);assert.match(await page.locator('.ps-ai-shell>header').innerText(),/Локальный разбор/);pass('canonical copy and empty local conversation');
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:1000});
  for(const scenario of ['empty','long','locked','unavailable','provider']){
   state=scenario;await go(a.id);await page.waitForFunction(()=>!document.querySelector('.ps-ai-state'));
   if(scenario==='long')await page.locator('.ps-ai-messages article').waitFor();
   if(scenario==='locked'||scenario==='unavailable')assert.equal(await page.getByLabel('Вопрос кредитному аналитику').isDisabled(),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),scenario+' overflow '+width);
   await page.screenshot({path:path.join(out,scenario+'-'+width+'.png'),fullPage:true});
  }
  state='loading';await go(a.id);await page.locator('.ps-ai-state').waitFor();assert.equal(await page.getByLabel('Вопрос кредитному аналитику').isDisabled(),true);await page.screenshot({path:path.join(out,'loading-'+width+'.png'),fullPage:true});state='empty';releaseGet();await page.locator('.ps-ai-empty').waitFor();
  await page.getByLabel('Вопрос кредитному аналитику').fill('Почему такой индекс?');await page.getByRole('button',{name:'Отправить',exact:true}).click();await page.locator('.pending').waitFor();assert.equal(await page.getByLabel('Вопрос кредитному аналитику').isDisabled(),true);state='error';releasePost();await page.locator('.ps-ai-error').waitFor();assert.equal(await page.getByLabel('Вопрос кредитному аналитику').inputValue(),'Почему такой индекс?');await page.screenshot({path:path.join(out,'error-'+width+'.png'),fullPage:true});
 }
 pass('long empty loading error locked local/provider and textarea at five widths');
 state='empty';await go(a.id);await page.locator('.ps-ai-empty').waitFor();await page.getByRole('button',{name:'Почему такой Prescore Index?',exact:true}).click();assert.equal(await page.getByLabel('Вопрос кредитному аналитику').inputValue(),'Почему такой Prescore Index?');await page.getByRole('button',{name:'Отправить',exact:true}).click();await page.locator('.pending').waitFor();releasePost();await page.getByText('Ответ по выбранному анализу',{exact:true}).waitFor();pass('quick question and local response');
 await page.getByLabel('Вопрос кредитному аналитику').fill('НЕ ПЕРЕНОСИТЬ A');await page.getByRole('button',{name:'Отправить',exact:true}).click();await page.locator('.pending').waitFor();await page.getByLabel('Сохранённый анализ',{exact:true}).selectOption(b.id);await page.locator('.ps-ai-empty').waitFor();releasePost();await page.waitForTimeout(100);assert.equal(await page.locator('.ps-ai-messages article').count(),0);assert.equal(await page.getByLabel('Вопрос кредитному аналитику').inputValue(),'');await page.getByLabel('Сохранённый анализ',{exact:true}).selectOption(a.id);await page.locator('.ps-ai-empty').waitFor();assert.equal(await page.getByLabel('Вопрос кредитному аналитику').inputValue(),'');pass('A B A isolates local state and late POST');
 await page.reload();await page.locator('.ps-ai-empty').waitFor();assert.equal(new URL(page.url()).searchParams.get('analysisId'),a.id);assert.equal(new URL(page.url()).searchParams.get('view'),'analyst');pass('AI deep link reload');
 assert.deepEqual(errors,[]);pass('no browser runtime errors');assert.ok(postCount>0);
}catch(e){checks.push({name:'failure',status:'FAIL',error:e.stack});console.error(e);await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;}finally{fs.writeFileSync(out+'/checks.json',JSON.stringify({checks,errors},null,2));await browser.close();}
