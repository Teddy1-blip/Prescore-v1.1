// Run only against the existing isolated Codespaces harness with PRESCORE_QA_PASSPORT=1.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const port=Number(process.argv[2]??4188);
assert.ok(Number.isInteger(port)&&port>0&&port<=65535);
const base='http://127.0.0.1:'+port;
const out=path.resolve(process.argv[3]??'build/client-v2-browser');
await fs.mkdir(out,{recursive:true});
const json=async(url,options={})=>{const r=await fetch(base+url,options);const payload=await r.json();assert.ok(r.ok,JSON.stringify(payload).slice(0,250));return payload;};
let companies=(await json('/api/dossier')).companies;
if(!companies.some(c=>c.inn==='9909000011')){await json('/__qa/seed?case=CL-RU-BUS-001&stage5Case=ready');companies=(await json('/api/dossier')).companies;}
const company=companies.find(c=>c.inn==='9909000011');
assert.ok(company,'Select the synthetic passport fixture.');
const get=()=>json('/api/dossier?id='+company.id);
const profile=await get();
assert.equal(profile.entitlement,'FULL');
const version=profile.versions.at(-1);
assert.ok(version?.id);
const url=view=>base+'/dashboard?'+new URLSearchParams({analysisId:version.id,view});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ru-RU'});
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const columns=['ИНН организации','Дата остатка','Счёт','Контрагент','Договор','Дебет, руб.','Кредит, руб.','Дата платежа по договору'];
const today=new Date().toISOString().slice(0,10);
const shift=days=>new Date(Date.parse(today)+days*86400000).toISOString().slice(0,10);
const csv=[columns,[company.inn,shift(-1),'62.01','Учебный покупатель','У-101','180000','0',shift(12)],[company.inn,shift(-1),'60.01','Учебный поставщик','У-202','0','95000',shift(5)]].map(row=>row.join(';')).join('\n');
const file={name:'ОСВ — учебный пример.csv',mimeType:'text/csv',buffer:Buffer.from('\uFEFF'+csv)};
const evidence={checks:[],pages:[],errors};
try{
 await page.goto(url('counterparties'));const buyers=page.getByRole('table',{name:'Покупатели',exact:true});
 await buyers.waitFor();await page.getByRole('table',{name:'Поставщики',exact:true}).waitFor();
 const form=page.locator('form').filter({has:page.locator('input[value="COUNTERPARTIES"]')});
 async function upload(){await form.locator('input[type=file]').setInputFiles(file);const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/api/dossier')&&r.request().method()==='POST'),form.getByRole('button',{name:'Добавить документ'}).click()]);assert.ok(r.ok(),'Статус загрузки '+r.status());}
 await upload();await buyers.getByText('Учебный покупатель',{exact:false}).first().waitFor();await upload();
 const populated=await get();assert.equal(populated.settlements.filter(r=>r.contract==='У-101').length,1);
 evidence.checks.push('ОСВ загружена через форму. Повторная загрузка сохраняет одно требование.');
 await buyers.locator('summary').first().click();await buyers.getByRole('button',{name:'Изменить по основанию'}).click();
 await buyers.locator('input[name=date]').fill(shift(15));await buyers.locator('input[name=note]').fill('Учебное допсоглашение № 2');
 const [updated]=await Promise.all([page.waitForResponse(r=>r.url().includes('/api/dossier')&&r.request().method()==='POST'),buyers.getByRole('button',{name:'Сохранить'}).click()]);assert.ok(updated.ok(),'Статус подтверждения '+updated.status());
 await page.reload();await buyers.locator('td').filter({hasText:shift(15)}).first().waitFor();assert.ok((await get()).settlements.some(p=>p.contract==='У-101'&&p.dueDate===shift(15)));
 evidence.checks.push('Изменённый срок сохраняется при перезагрузке.');
 await page.screenshot({path:path.join(out,'desktop-registers.png')});
 await page.goto(url('calendar'));await page.getByRole('table',{name:'Реестр событий'}).getByText('Учебный поставщик',{exact:false}).waitFor();
 await page.getByLabel('Горизонт').selectOption('180');await page.getByLabel('Сценарий поступлений').selectOption('30');
 evidence.checks.push('Требование и обязательство попали в календарь. Горизонт 180 дней и стрессовый сценарий выбираются через форму.');
 await page.screenshot({path:path.join(out,'desktop-calendar.png')});
 for(const view of ['home','banking','bfo','obligations','analysis','analyst','financing','documents']){
  await page.goto(url(view));await page.waitForLoadState('networkidle');const body=await page.locator('body').innerText();
  assert.ok(body.trim().length>110,view+' empty');evidence.pages.push(view);
  if(view==='analysis'){await page.getByText('Демонстрационная оценка бизнеса',{exact:true}).click();await page.getByLabel('Свободный поток для компании (FCFF), год 1',{exact:true}).fill('100000');}
 }
 await page.goto(url('home'));await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(out,'desktop-overview.png')});
 await page.setViewportSize({width:390,height:844});await page.goto(url('counterparties'));await buyers.getByText('Учебный покупатель',{exact:false}).first().waitFor();
 const mobile=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));evidence.mobile=mobile;
 await page.screenshot({path:path.join(out,'mobile-registers.png')});
 assert.ok(mobile.scroll<=mobile.viewport+1,'Mobile document overflows: '+JSON.stringify(mobile));
 const stranger=await fetch(base+'/api/dossier?id='+company.id,{headers:{cookie:'qa-role=stranger'}});assert.equal(stranger.status,404);evidence.checks.push('Досье недоступно постороннему клиенту.');
 assert.deepEqual(errors,[]);evidence.status='PASS';
}finally{await fs.writeFile(path.join(out,'result.json'),JSON.stringify(evidence,null,2));await browser.close();}
