// Offline, end-to-end desk acceptance. Only the account identity and external
// services are supplied by the isolated harness. Both roles read the real model API.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const out=path.resolve(process.argv[2]??'/tmp/prescore-stage5-browser');
fs.mkdirSync(out,{recursive:true});
const socket=createServer().listen(0,'127.0.0.1');await once(socket,'listening');
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['scripts/qa/workspace-harness.mjs',out+'/harness',String(port)],{stdio:['ignore','pipe','inherit']});
let browser;
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Harness startup timeout')),60000);
    server.stdout.on('data',b=>{if(String(b).includes('listening')){clearTimeout(timer);resolve();}});
    server.once('exit',c=>{clearTimeout(timer);reject(Error('Harness stopped '+c));});});
  browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage(),external=[],errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route(/^https?:\/\//,route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    external.push(new URL(route.request().url()).hostname);return route.abort();
  });
  const seed=async id=>(await page.request.get(origin+'/__qa/seed?case=CL-RU-BUS-'+id+(id==='001'?'&stage5Case=ready':''))).json();
  const first=await seed('001'),empty=await seed('011'),stop=await seed('017');
  const model=async id=>(await page.request.get(origin+'/api/workspace-model?analysisId='+id)).json();
  const a=await model(first.id);assert.equal(a.access.role,'OWNER');
  const home=id=>origin+'/dashboard?view=home&analysisId='+id;
  const route=()=>page.locator('[data-client-route]');
  const overview=async(id,expected)=>{
    await page.goto(home(id));await page.locator('[data-client-route="'+expected+'"]').waitFor();
    assert.equal(await route().count(),1);assert.equal(await page.getByLabel('Сохранённый анализ').inputValue(),id);
  };
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:900});
    await overview(first.id,'READY_FOR_FINANCING');
    const index=a.full.canonical.prescoreIndex.value;
    assert.match(await page.locator('[data-credit-index]').innerText(),new RegExp('^'+index));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.getByRole('button',{name:'Почему?',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:'Основания вывода'});await dialog.waitFor();
    assert.ok(await dialog.locator('[data-source-ref]').count());await page.keyboard.press('Escape');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:out+'/home-'+width+'.png'});
    checks.push({width,role:'OWNER',index,route:a.full.report.hero.route,disclosure:true});
  }
  // Use the dossier selector, including navigation back to the original numerical model.
  await page.getByLabel('Сохранённый анализ').selectOption(empty.id);
  await page.locator('[data-client-route="INSUFFICIENT_DATA"]').waitFor();
  assert.equal(await page.locator('[data-credit-index]').count(),0);
  await page.getByLabel('Сохранённый анализ').selectOption(first.id);
  await page.locator('[data-client-route="READY_FOR_FINANCING"]').waitFor();
  await page.reload();await page.locator('[data-client-route="READY_FOR_FINANCING"]').waitFor();
  assert.deepEqual((await model(first.id)).full,a.full);
  await overview(stop.id,'NEEDS_PREPARATION');
  assert.equal(await page.locator('[data-credit-index]').count(),0);
  await page.goto(origin+'/dashboard?view=analysis&section=conclusion&analysisId='+first.id);
  await page.getByRole('heading',{name:'Анализ Prescore',exact:true}).waitFor();
  assert.ok((await page.locator('main').innerText()).includes(String(a.full.canonical.prescoreIndex.value)));
  await context.addCookies([{name:'qa-role',value:'broker',url:origin}]);
  const b=await model(first.id);
  assert.deepEqual(b.access,{...b.access,role:'ASSIGNED_BROKER',readOnly:true});assert.deepEqual(b.full,a.full);
  await page.goto(origin+'/agent?view=dossier&dossierView=home&analysisId='+first.id);
  await page.locator('[data-client-route="READY_FOR_FINANCING"]').waitFor();
  assert.equal(await page.getByRole('button',{name:'Создать заявку на финансирование'}).count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(out+'/results.json',JSON.stringify({checks,legacyProfile:true,insufficient:true,globalStop:true,
    switchReload:true,detailParity:true,brokerReadOnly:true,canonicalParity:true,errors,external},null,2));
  console.log('Unified home, three widths, evidence, switch/reload, stop, gap, owner/broker parity and read-only controls passed.');
}finally{await browser?.close();server.kill();}
