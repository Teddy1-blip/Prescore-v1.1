// Synthetic visual stress only: never persisted, never used for credit assertions.
import assert from 'node:assert/strict';
export async function densityQA(page,{origin,out,full,record}){
 const tabs=page.getByRole('tablist',{name:'Банковские визуализации'}), labels=['Обороты','Денежный поток','Платежи','Концентрация'];
 await tabs.getByRole('tab',{name:'Обороты',exact:true}).focus();
 for(const [key,label]of[['ArrowRight','Денежный поток'],['End','Концентрация'],['ArrowRight','Обороты'],['ArrowLeft','Концентрация'],['Home','Обороты']]){
  await page.keyboard.press(key);const selected=tabs.getByRole('tab',{selected:true});assert.equal(await selected.textContent(),label);assert.ok(await selected.evaluate(e=>e===document.activeElement&&e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle!=='none'));assert.equal(await tabs.locator('[tabindex="0"]').count(),1);assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'),await selected.getAttribute('id'));
 }record('chart tabs ArrowLeft/Right wrapping, Home/End, roving focus and ARIA');
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:1000});
  if(width<=768){const sizes=await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('button').evaluateAll(items=>items.map(e=>({height:e.getBoundingClientRect().height,wrap:getComputedStyle(e).whiteSpace})));assert.ok(sizes.every(s=>s.height>=44&&s.height<=48&&s.wrap==='nowrap'),JSON.stringify(sizes));record('compact mobile navigation keeps labels on one line',{width});}
  for(const label of labels){await tabs.getByRole('tab',{name:label,exact:true}).click();const panel=page.getByRole('tabpanel');assert.ok(await panel.isVisible());const geometry=await panel.evaluate(e=>({width:innerWidth,page:document.documentElement.scrollWidth,panel:e.clientWidth,scroll:e.scrollWidth}));assert.ok(geometry.page<=width+1&&geometry.scroll<=geometry.panel+1,JSON.stringify({label,geometry}));assert.ok((await panel.innerText()).includes('Недостаточно')||(await panel.locator('.ws-chart-legend').count())>0);record('chart no overflow and text legend',{label,width});
   if(width===1440||width===390){await page.locator('.ws-data-panel').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-90));if(width===1440){assert.ok(await page.getByRole('navigation',{name:'Основные разделы'}).evaluate(e=>e.getBoundingClientRect().top>=0));}await page.screenshot({animations:'disabled',path:`${out}/client-chart-${labels.indexOf(label)}-${width}-after.png`});}
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 if(process.env.WORKSPACE_QA_BASELINE_ROOT){const before=await page.context().newPage();await before.goto(`${origin}/dashboard?analysisId=${full.analysisId}&qa-before=1`);await before.locator('.ws-flow').waitFor();await before.locator('.ws-flow').evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-90));await before.screenshot({animations:'disabled',path:`${out}/client-chart-before.png`});await before.close();}
 for(const state of ['unknown','zero','long']){
  const fixture=structuredClone(full),b=fixture.basic.bankingFacts;
  for(const k of ['taxPayments','loanPrincipalPayments','interestPayments','unsplitDebtPayments','leasingPayments','transfersToIndividuals','directCustomerTop1','directCustomerTop3']){b[k].value=state==='unknown'?null:state==='zero'?0:k.startsWith('direct')?.95:999999999999999;b[k].status=state==='unknown'?'UNKNOWN':'KNOWN';}
  b.monthly=[{month:'2026-01',coverage:'PARTIAL',externalInflows:state==='unknown'?null:state==='zero'?0:999999999999999,externalOutflows:state==='unknown'?null:state==='zero'?0:1999999999999999}];
  const route=async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)});
  await page.route('**/api/workspace-model?*',route);await page.reload();await page.locator('.ws-data-panel').waitFor();
  for(const width of [390,360]){await page.setViewportSize({width,height:1000});for(const label of labels){await tabs.getByRole('tab',{name:label,exact:true}).click();const panel=page.getByRole('tabpanel');const text=await panel.innerText();if(state==='unknown')assert.match(text,/Недостаточно данных/);if(state==='zero')assert.match(text,/равны нулю/);assert.doesNotMatch(text,/NaN|Infinity/);assert.ok(await panel.evaluate(e=>document.documentElement.scrollWidth<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1));if(state!=='long')assert.equal(await panel.locator('svg rect,.ws-chart-track i').count(),0);record('synthetic chart state',{state,label,width});}
   await page.locator('.ws-data-panel').scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`${out}/client-chart-${state}-${width}.png`});}
  await page.unroute('**/api/workspace-model?*',route);
 }
 await page.reload();await page.locator('.ws-data-panel').waitFor();await page.emulateMedia({reducedMotion:'reduce'});for(const label of labels){await tabs.getByRole('tab',{name:label,exact:true}).click();assert.equal(await page.locator('.ws-data-panel').evaluate(root=>[root,...root.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return parseFloat(c.transitionDuration)>0||(c.animationName!=='none'&&parseFloat(c.animationDuration)>0);}).length),0);}record('all chart tabs respect reduced motion');await page.emulateMedia({reducedMotion:'no-preference'});await tabs.getByRole('tab',{name:'Обороты',exact:true}).click();
 await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>scrollTo(0,0));
}
export async function brokerDensityQA(page,{out,record}){
 const response=await page.request.get(new URL('/api/agent',page.url()).toString()),data=await response.json();
 const rows=page.locator('.ws-status-distribution>div');assert.equal(await rows.count(),new Set(data.applications.map(a=>a.status||'Статус не указан')).size);
 assert.equal((await rows.locator('dd').allTextContents()).reduce((a,b)=>a+Number(b),0),data.applications.length);
 assert.match(await page.locator('.ws-broker-overview').innerText(),/не конверсия/);
 for(const width of [1440,1024,768,390,360]){await page.setViewportSize({width,height:1000});assert.ok(await page.locator('.ws-broker-overview').evaluate(e=>document.documentElement.scrollWidth<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1));record('broker actual status distribution, no fictional pipeline and no overflow',{width});if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({animations:'disabled',path:out+'/broker-home-390-after.png',fullPage:true});}}
 const emptyRoute=r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...data,leads:[],applications:[]})});
 await page.route('**/api/agent',emptyRoute);await page.reload();await page.getByText('Клиентов пока нет.',{exact:false}).waitFor();assert.equal(await page.locator('.ws-portfolio-bar,.ws-status-distribution').count(),0);assert.match(await page.locator('.ws-broker-overview').innerText(),/Заявок пока нет/);await page.screenshot({animations:'disabled',path:out+'/broker-empty-360.png',fullPage:true});record('empty broker portfolio and applications show text without invented distribution');await page.unroute('**/api/agent',emptyRoute);await page.reload();await page.locator('.ws-queue').waitFor();
 await page.setViewportSize({width:1440,height:1000});record('broker chart totals match actual applications including non-pipeline statuses');
}
