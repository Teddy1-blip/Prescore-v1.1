import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {financialText} from '../../tests/fixtures/polish-sources.mjs';

const out=path.resolve(process.argv[2]??'build/premium-client-qa');
await fs.mkdir(out,{recursive:true});
const port=4258;
const origin='http://127.0.0.1:'+port;
const checks=[];
function passed(name){ checks.push(name);console.log('PASS',name); }
const server=spawn(process.execPath,['scripts/qa/workspace-harness.mjs',path.join(out,'runtime'),String(port)],{
  env:{...process.env,PRESCORE_QA_PASSPORT:'1'},stdio:['ignore','pipe','inherit'],
});
let browser;
try{
  await new Promise((resolve,reject)=>{
    server.stdout.on('data',chunk=>{if(String(chunk).includes('listening'))resolve();});
    server.once('exit',code=>reject(Error('QA server exited '+code)));
    server.once('error',reject);
  });
  browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(err.message));
  page.setDefaultTimeout(15000);
  const company=await(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-017')).json();
  const url=new URL('/dashboard',origin);
  url.searchParams.set('analysisId',company.id);
  url.searchParams.set('view','analysis');
  await page.goto(url.href);
  const nav=page.getByRole('navigation',{name:'Разделы анализа'});
  const tabs=[['Стоп-факторы и риски','factors'],['Рекомендации','recommendations'],['План 7 / 30 / 60','plan']];
  for(const [label,id] of tabs){
    await nav.getByRole('button',{name:label,exact:true}).click();
    assert.equal(new URL(page.url()).searchParams.get('section'),id);
    await nav.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,id+'.png')});
    if(id==='factors'){
      await page.getByRole('button',{name:'Почему Prescore сделал этот вывод?'}).first().click();
      const evidence=page.getByRole('dialog',{name:'Основания вывода'});
      assert.ok(await evidence.locator('[data-claim-id]').count());
      await evidence.getByRole('button',{name:'Закрыть'}).click();
    }
    passed('Раздел профиля · '+label);
  }
  url.searchParams.set('view','documents');
  await page.goto(url.href);
  const register=page.getByRole('region',{name:'Документы компании',exact:true});
  await register.waitFor();
  assert.equal(await register.locator('.pc-register-group').count(),6);
  const form=page.locator('#dossier-intake');
  await register.getByRole('link',{name:'Добавить документ'}).focus();
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,'#dossier-intake');
  passed('Шесть групп документов и клавиатурный переход к загрузке');
  const sourceName='QA-БФО-2025.csv';
  const source={name:sourceName,mimeType:'text/csv',buffer:Buffer.from(financialText(company.companyInn,{period:'2025 год',revenue:2601,profit:127}))};
  const receipt=register.getByRole('status');
  async function upload(){
    await form.getByLabel('Вид документа').selectOption('BFO');
    await form.locator('input[type=file]').setInputFiles(source);
    const completed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/dossier'&&r.request().method()==='POST'&&r.request().headers()['content-type']?.startsWith('multipart/'));
    await form.getByRole('button',{name:'Добавить документ'}).click();
    const response=await completed;
    assert.ok(response.ok(),await response.text());
    return response.json();
  }
  const first=await upload();assert.equal(first.duplicate,false);
  await receipt.getByText(sourceName,{exact:true}).waitFor();
  await receipt.getByRole('button',{name:'Посмотреть результаты'}).waitFor();
  await register.screenshot({path:path.join(out,'upload-receipt.png')});
  const second=await upload();assert.equal(second.duplicate,true);
  assert.equal(second.id,first.id);
  await register.locator('summary').filter({hasText:'Бухгалтерская отчётность'}).click();
  const row=register.getByRole('listitem').filter({hasText:sourceName});
  assert.equal(await row.count(),1);
  const href=await row.getByRole('link',{name:'Открыть оригинал'}).getAttribute('href');
  assert.deepEqual(await(await page.request.get(new URL(href,origin).href)).body(),source.buffer);
  passed('Загрузка БФО, результат, один документ после повтора и побайтная проверка оригинала');
  await receipt.getByRole('button',{name:'Посмотреть результаты'}).click();
  await page.getByRole('region',{name:'Многолетняя бухгалтерская отчётность',exact:true}).waitFor();
  passed('Переход из результата загрузки в БФО действующей компании');
  const dossierId=new URL(page.url()).searchParams.get('dossierId');
  assert.ok(dossierId);
  url.searchParams.set('dossierId',dossierId);
  const route='**/api/dossier?*';
  await page.route(route,r=>r.fulfill({status:503,contentType:'text/html',body:'QA service temporarily unavailable'}));
  await page.goto(url.href);
  await page.getByText(/Связь с сервисом прервалась/).first().waitFor();
  await page.unroute(route);
  await page.getByRole('button',{name:'Обновить сведения досье'}).click();
  await register.waitFor();
  passed('Восстановление после недоступности источника без повторной отправки файла');
  const raster={name:'QA-неполный-скан.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ5kAAAAASUVORK5CYII=','base64')};
  await page.route('**/api/dossier',r=>{
    if(r.request().headers()['content-type']?.includes('application/json')&&r.request().postDataJSON()?.action==='recognize')
      return r.abort('connectionreset');
    return r.continue();
  });
  await form.getByLabel('Вид документа').selectOption('BFO_REVIEW');
  await form.locator('input[type=file]').setInputFiles(raster);
  await form.getByRole('button',{name:'Добавить документ'}).click();
  await page.getByText(/Связь с сервисом прервалась/).first().waitFor();
  await receipt.getByText(raster.name,{exact:true}).waitFor();
  assert.equal(await receipt.getByRole('button',{name:'Посмотреть результаты'}).count(),0);
  await receipt.getByRole('link',{name:'Проверить поля'}).click();
  const target=new URL(page.url()).hash;
  assert.ok(target.startsWith('#review-'));
  await page.reload();
  const review=page.locator('[id='+JSON.stringify(decodeURIComponent(target.slice(1)))+']');
  await review.waitFor();
  assert.ok((await review.innerText()).includes('Оригинал')||(await review.innerText()).includes('оригинал'));
  passed('Обрыв OCR после записи оригинала: сохранена проверка и повторный вход по ссылке, суммы исключены');
  assert.deepEqual(pageErrors,[]);
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(checks,null,2));
}finally{
  await browser?.close();
  if(server.exitCode===null&&server.signalCode===null){const closed=once(server,'exit');server.kill();await closed;}
}
