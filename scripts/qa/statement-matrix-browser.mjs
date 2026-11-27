import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {financialText} from '../../tests/fixtures/polish-sources.mjs';
import {statementFixture} from '../../tests/fixtures/block1-statements.mjs';

const out=path.resolve(process.argv[2]??'/tmp/prescore-statement-matrix');
await fs.mkdir(out,{recursive:true});
const port=4237,origin='http://127.0.0.1:'+port,inn='9900000017',checks=[];
const server=spawn(process.execPath,['scripts/qa/workspace-harness.mjs',out+'/runtime',String(port)],{stdio:['ignore','pipe','inherit'],
  env:{...process.env,PRESCORE_QA_EXTERNAL:'1',PRESCORE_QA_MATRIX:'1',PRESCORE_RUNTIME_MODE:'release-candidate',
    PRESCORE_STAGING_FREE_FULL:'1',PRESCORE_BASE_URL:'https://prescore-staging-dorogovab.msk1.amvera.tech'}});
let browser,page;
function ok(name){checks.push(name);console.log('PASS',name);}
try{
  await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(String(b).includes('listening'))resolve();});server.once('exit',code=>reject(Error('Harness '+code)));});
  browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/dashboard?view=bfo');
  await page.getByLabel('ИНН компании',{exact:true}).fill(inn);await page.getByRole('button',{name:'Получить данные'}).click();
  await page.waitForURL(/dossierId=/);
  const dossierId=new URL(page.url()).searchParams.get('dossierId');
  const api=origin+'/api/dossier?id='+dossierId;
  const dossier=async()=>(await page.request.get(api)).json();
  const matrix=page.getByRole('region',{name:'Многолетняя бухгалтерская отчётность',exact:true});
  await matrix.waitFor();
  let data=await dossier();assert.equal(data.company.inn,inn);ok('01 · Компания по ИНН');
  assert.equal(data.matrix.periods.length,8);assert.equal((await(await page.request.get(origin+'/__qa/external-calls')).json()).filter(s=>s==='finances').length,1);
  ok('02 · Восемь лет по контракту Checko, один вызов finances в изолированном стенде');
  await matrix.getByLabel('Периоды',{exact:true}).selectOption('all');
  const income=matrix.getByRole('region',{name:'Ф2 · отчётные периоды'}),balance=matrix.getByRole('region',{name:'Ф1 · отчётные периоды'});
  assert.equal(await income.getByRole('columnheader',{name:'2020',exact:true}).count(),1);
  await matrix.screenshot({path:out+'/01-history.png'});ok('03 · Ф1 и Ф2, годы 2017–2025 с пропуском 2020');
  async function upload(period,revenue,profit){
    const file={name:'Отчёт-'+period+'.csv',mimeType:'text/csv',buffer:Buffer.from(financialText(inn,{period,revenue,profit}))};
    await page.locator('#bfo-upload-file').setInputFiles(file);
    const wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/dossier'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Загрузить и проанализировать'}).click();const response=await wait;
    assert.ok(response.ok(),JSON.stringify(await response.json()));return file;
  }
  await upload('3 месяца 2026',320,-7);const q3=await upload('9 месяцев 2026',900,-19);
  ok('04 · Квартальные CSV загружены через кабинет');
  await matrix.getByLabel('Периоды',{exact:true}).selectOption('recent');
  await income.getByRole('button',{name:/Выручка · 2026 · 3 кв/}).waitFor();
  let row=income.getByRole('rowheader',{name:/Выручка/}).locator('..');
  assert.deepEqual((await row.locator('td').allTextContents()).slice(-3),['320','—','900']);
  await income.getByRole('button',{name:/Выручка · 2026 · 3 кв/}).click();
  const original=await matrix.getByRole('link',{name:'Открыть оригинал'}).getAttribute('href');
  assert.deepEqual(await(await page.request.get(origin+original)).body(),q3.buffer);
  await matrix.getByRole('button',{name:'Закрыть основание'}).click();
  await income.screenshot({path:out+'/02-interim.png'});await row.screenshot({path:out+'/03-missing-quarter.png'});
  ok('05 · Q1 и Q3 заполнены, Q2 пуст, оригинал совпал побайтно');
  await page.getByText('Финансовые коэффициенты за выбранный период',{exact:true}).click();
  await page.locator('.pc-bfo-detail').screenshot({path:out+'/04-ratios.png'});
  for(const width of [1440,1280,1024,768,390,360]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
    const scroller=await balance.evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));
    if(width<769)assert.ok(scroller.content>scroller.width);
    await balance.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
    const sticky=await balance.evaluate(el=>Math.abs(el.querySelector('tbody th').getBoundingClientRect().left-el.getBoundingClientRect().left));
    assert.ok(sticky<4,'sticky '+width);
    await balance.screenshot({path:out+'/width-'+width+'.png'});
  }
  await page.setViewportSize({width:1440,height:1000});ok('Шесть ширин · 360–1440 px, закреплённый столбец и прокрутка');
  await page.getByRole('button',{name:'Отчёт PDF',exact:true}).click();await page.waitForURL(/snapshotId=/);
  const reportUrl=page.url(),reportId=new URL(reportUrl).searchParams.get('snapshotId');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать отчёт PDF'}).click();
  await(await download).saveAs(out+'/statement.pdf');
  const snapshot=(await(await page.request.get(api+'&snapshotId='+reportId)).json()).model;
  assert.deepEqual(snapshot.matrix,(await dossier()).matrix);ok('10–11 · Скачан PDF, снимок и матрица кабинета совпали');
  const target=view=>origin+'/dashboard?'+new URLSearchParams({dossierId,view});
  await page.goto(target('upload'));
  await page.locator('input[type=file]').first().setInputFiles({name:'Выписка.txt',mimeType:'text/plain',buffer:Buffer.from(statementFixture({inn}))});
  const bankSaved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/analysis'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Рассчитать по выбранным файлам'}).click();
  const bank=await bankSaved;const bankData=await bank.json();assert.ok(bank.ok(),JSON.stringify(bankData.error));
  const analysisId=bankData.analysis.id;ok('06 · Принята выписка 1С в досье');
  const workspace=await(await page.request.get(origin+'/api/workspace-model?analysisId='+analysisId)).json();
  assert.ok(workspace.basic.bankingFacts);assert.ok(workspace.full.report.financialAnalysis.history.length>=10);
  assert.ok(workspace.full.report.reconciliation);ok('07 · Финансовая история, банковские обороты и сверка доступны вместе');
  await page.goto(target('analysis')+'&analysisId='+analysisId+'&section=financials');await matrix.waitFor();ok('08 · Матрица в кредитном профиле');
  await page.getByRole('navigation',{name:'Разделы анализа'}).getByRole('button',{name:'Рекомендации'}).click();
  await page.getByRole('heading',{name:'Приоритетные рекомендации',exact:true}).first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/05-credit-recommendations.png'});
  assert.ok(workspace.full.report.recommendations&&workspace.full.report.actionPlan);ok('09 · Рекомендации и план текущего заключения');
  await page.goto(target('banking')+'&analysisId='+analysisId);await page.getByRole('button',{name:'Бухгалтерская отчётность',exact:true}).click();await matrix.waitFor();
  await page.goto(target('bfo'));await page.reload();await matrix.waitFor();assert.deepEqual((await dossier()).matrix,snapshot.matrix);ok('12 · Досье после обновления страницы');
  const another=await page.request.post(origin+'/api/dossier',{data:{action:'save',inn:'7707083893'}});
  const second=(await another.json()).company;assert.ok(second.id!==dossierId);
  await page.goto(origin+'/dashboard?view=bfo&dossierId='+second.id);await page.locator('.pc-bfo-identity').waitFor();
  assert.equal(await matrix.count(),0);assert.equal((await(await page.request.get(origin+'/api/dossier?id='+second.id)).json()).matrix.periods.length,0);
  assert.deepEqual(errors,[]);ok('13 · Переключение компании исключает предыдущие данные');
} catch(error){if(page){console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}throw error;}
finally{await fs.writeFile(out+'/checks.json',JSON.stringify(checks,null,2));await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await Promise.race([once(server,'exit'),new Promise(r=>setTimeout(r,1500))]);}

