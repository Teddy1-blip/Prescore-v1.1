import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {syntheticPdf} from '../release/pdf-fixture.mjs';
import {financialFile,corporateBkiFile} from '../../tests/fixtures/polish-sources.mjs';
import {statementFixture} from '../../tests/fixtures/block1-statements.mjs';
import {checkoDouble,corporation as inn} from '../../tests/fixtures/stage4-external.mjs';
import {acquireChecko} from '../../lib/external/checko-provider.ts';

// Caller supplies the guarded localhost RC database, browser and real auth helpers.
export async function dossierBrowser({page,pool,out,origin,signup,signInAsRole,roleName,ok}){
 const evidence=path.join(out,'source-first');await fs.mkdir(evidence,{recursive:true});
 const provider=checkoDouble(),{profile}=await acquireChecko(inn,'isolated-fixture',provider.fetcher);
 await pool.query('INSERT INTO checko_profiles(inn,payload,fetched_at,updated_at) VALUES($1,$2,$3,$3) ON CONFLICT(inn) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at',[inn,JSON.stringify(profile),profile.fetchedAt]);
 async function actor(n){const role=roleName+'source'+n;for(let attempt=0;;attempt++){
   try{await signup(role);break;}catch(error){if(!String(error).includes('429')||attempt>=3)throw error;await new Promise(resolve=>setTimeout(resolve,21000));}
 }await signInAsRole(role);await page.goto(origin+'/dashboard');await page.getByLabel('ИНН компании',{exact:true}).waitFor();return role;}
 async function saveCompany(){
   await page.getByLabel('ИНН компании',{exact:true}).fill(inn);
   await page.getByRole('button',{name:'Сохранить компанию в досье'}).click();
   await page.waitForURL(/dossierId=/);await page.getByText('Досье компании · ИНН '+inn,{exact:true}).first().waitFor();
   return new URL(page.url()).searchParams.get('dossierId');
 }
 async function tab(id,view){await page.goto(origin+'/dashboard?'+new URLSearchParams({dossierId:id,view}));await page.getByText('Досье компании · ИНН '+inn,{exact:true}).first().waitFor();}
 async function upload(label,file){
   const input=page.getByLabel(label,{exact:true});await input.setInputFiles({name:file.name,mimeType:file.type||'application/octet-stream',buffer:Buffer.from(await file.arrayBuffer())});
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/dossier'&&r.request().method()==='POST');
   await input.locator('..').locator('..').getByRole('button',{name:'Добавить документ'}).click();const r=await pending;assert.ok(r.ok(),await r.text());
 }
 const ledger=new File(['ИНН организации;Дата остатка;Счёт;Контрагент;Договор;Дебет, руб.;Кредит, руб.\n'+inn+';2025-12-31;62.01;Учебный покупатель;Д-1;1800;'],'osv.csv');
 const first=await actor(1);
 await page.getByLabel('ИНН компании',{exact:true}).fill(inn);await page.getByRole('button',{name:'Проверить ИНН'}).click();
 await page.getByRole('heading',{name:profile.company.name,exact:true}).first().waitFor();const combined=await saveCompany();ok('ИНН без файлов: публичный профиль Checko из тестового кэша и сохранение компании');
 await actor(2);await page.goto(origin+'/dashboard?view=bfo');
 await upload('Годовая бухгалтерская отчётность',financialFile(inn,'csv',{period:'2024 год'}));
 await page.waitForURL(/dossierId=/);const accounting=new URL(page.url()).searchParams.get('dossierId');assert.ok(accounting);
 await page.getByRole('heading',{name:'Финансовый профиль БФО'}).waitFor();await page.screenshot({path:path.join(evidence,'bfo-one-year.png'),fullPage:true});
 await upload('Годовая бухгалтерская отчётность',financialFile(inn,'csv',{period:'2025 год'}));await page.waitForFunction(()=>[...document.querySelectorAll('select')].some(s=>s.options.length===2&&s.textContent.includes('2024')&&s.textContent.includes('2025')));
 await page.screenshot({path:path.join(evidence,'bfo-two-years.png'),fullPage:true});ok('БФО без банка: два периода FinancialAnalysisV2');
 const onlyReport=await page.context().newPage();
 await onlyReport.goto(page.url());await onlyReport.getByRole('button',{name:'Версия отчёта для PDF'}).click();
 await onlyReport.waitForURL(/snapshotId=/);
 await onlyReport.getByRole('heading',{name:'Финансовый профиль компании'}).waitFor();
 assert.ok((await onlyReport.getByText('Выручка',{exact:true}).count())>=2);
 const onlyPdf=await onlyReport.pdf({path:path.join(evidence,'bfo-only.pdf'),format:'A4',printBackground:true});assert.equal(onlyPdf.subarray(0,5).toString(),'%PDF-');await onlyReport.close();
 ok('Отчёт самостоятельной БФО сохранён как PDF');
 await actor(3);await page.getByRole('button',{name:'Загрузить банковскую выписку',exact:true}).first().click();
 async function bank(){
   await page.locator('input[type=file]').first().setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from(statementFixture({inn}))});
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/analysis'&&r.request().method()==='POST');
   const submit=page.getByRole('button',{name:'Рассчитать по выбранным файлам'});
   await submit.click();const r=await pending;assert.ok(r.ok(),await r.text());return (await r.json()).analysis.id;
 }
 await bank();ok('Банковская выписка как первый источник');
 await actor(4);const debt=await saveCompany();await tab(debt,'obligations');await upload('Корпоративный отчёт БКИ',corporateBkiFile(inn));await page.getByRole('heading',{name:'Подтверждённые обязательства'}).waitFor();ok('Кредитный портфель только по БКИ');
 await upload('Кредитный договор PDF',new File([syntheticPdf(['Кредитный договор','Кредитор: Банк Тест','Заёмщик: Компания Тест','ИНН заёмщика: '+inn,'Номер договора: Т-002','Дата договора: 2025-01-01','Валюта: RUB','Кредитный лимит: 100000'])],'review-credit.pdf',{type:'application/pdf'}));
 await page.getByRole('button',{name:'Распознать страницы для проверки'}).click();
 await page.getByText('Обработано страниц: 1 из 1').waitFor();
 const credit=page.getByLabel('Кредитор',{exact:false}).first();await credit.fill('Банк Тест');
 await credit.locator('..').locator('..').getByRole('button',{name:'Подтвердить поле'}).click();
 await page.getByText(/Подтверждено пользователем/).first().waitFor();await page.screenshot({path:path.join(evidence,'ocr-field-confirmation.png'),fullPage:true});ok('Подтверждение извлечённого поля с оригиналом и номером страницы');
 await actor(5);const ar=await saveCompany();await tab(ar,'counterparties');await upload('ОСВ 60, 62 и 76',ledger);await page.getByRole('cell',{name:'Учебный покупатель'}).waitFor();ok('Расчёты с контрагентами только по ОСВ');
 await signInAsRole(first);await tab(combined,'bfo');await upload('Годовая бухгалтерская отчётность',financialFile(inn));await tab(combined,'obligations');await upload('Корпоративный отчёт БКИ',corporateBkiFile(inn));await tab(combined,'counterparties');await upload('ОСВ 60, 62 и 76',ledger);await tab(combined,'home');await page.getByRole('button',{name:'Загрузить банковскую выписку',exact:true}).click();
 const analysisId=await bank();await tab(combined,'documents');const versions=await page.request.get(origin+'/api/dossier?id='+combined);const saved=await versions.json();assert.equal(saved.versions[0].id,analysisId);assert.equal(saved.obligations.length,1);assert.equal(saved.ledger.length,1);assert.equal(new Set(saved.sources.map(s=>s.kind)).size,5);
 ok('Пять источников объединены в одном досье без повторного обязательства');
}
