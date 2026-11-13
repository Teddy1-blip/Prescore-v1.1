import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {conclusionFixture} from './fixtures/credit-conclusion.mjs';

test('approved core pages expose canonical detail without hidden disclosure', async()=>{
 const rt=await createWorkspaceRuntime();
 try {
  const {ApprovedPage}=rt.load('app/components/workspace/approved/pages.tsx');
  const {liveView}=rt.load('app/components/workspace/approved/adapter.ts');
  const {model}=conclusionFixture();
  const data=liveView(model,'ООО ТЕСТ','');
  const detail=React.createElement('div',{'data-testid':'canonical-evidence'},'CANONICAL_EVIDENCE_SENTINEL');
  const renderWith = (page, viewData) => renderToStaticMarkup(React.createElement(ApprovedPage,{page,data:viewData,focus:'Финансист',go:()=>{},apps:[],details:detail}));
  const render = (page) => renderWith(page, data);
  for(const page of ['analysis','banking','financing','documents','applications','actions']){
   const html=render(page);
   assert.match(html,/CANONICAL_EVIDENCE_SENTINEL/,page);
   assert.match(html,/class="approved-canonical-section"/,page);
   assert.doesNotMatch(html,/class="details"/,page);
   assert.match(html,/id="approved-source-operations"/,page);
  }
  assert.match(render('home'),/class="details"/);
  const analysis=render('analysis');
  assert.match(analysis,/Финансово-кредитное заключение Prescore/);
  assert.match(analysis,/независимая финансовая диагностика/);
  assert.match(analysis,/не показывает/);
  assert.match(analysis,/Направления финансирования/);
  assert.match(analysis,/Рассмотреть финансирование/);
  assert.match(analysis,/Риски и стоп-факторы/);
  assert.match(analysis,/не объявление решения или стоп-критериев конкретного банка/);
  const stopped=conclusionFixture('CL-RU-BUS-017');
  const stoppedView=liveView(stopped.model,'ООО СИНТЕТИЧЕСКОЕ','');
  assert.ok(stoppedView.riskSummary?.some((item) => item.status === 'GLOBAL_STOP'));
  assert.match(renderWith('analysis',stoppedView),/Критический фактор/);
  const basic=structuredClone(stopped.model);
  delete basic.full;
  basic.entitlement='BASIC';
  assert.equal(liveView(basic,'ООО СИНТЕТИЧЕСКОЕ','').riskSummary,null,'BASIC must not expose FULL risk findings');
  const bankView={...data, months:[
    {id:'2026-01',label:'2026-01',coverage:'FULL',incoming:200,outgoing:320,operating:200,debt:0,tax:0,net:-120},
    {id:'2026-02',label:'2026-02',coverage:'MISSING',incoming:null,outgoing:null,operating:null,debt:null,tax:null,net:null},
  ]};
  const banking=renderWith('banking',bankView);
  assert.match(banking,/Отрицательный денежный поток/);
  assert.match(banking,/Месяцы с отрицательным денежным потоком/);
  assert.match(banking,/не прогноз кассового разрыва/);
  assert.match(banking,/-120/);
  const noCoverage={...bankView,months:bankView.months.map(month=>({...month,coverage:'MISSING'}))};
  assert.doesNotMatch(renderWith('banking',noCoverage),/Месяцы с отрицательным денежным потоком/);
 } finally {await rt.close();}
});

test('action plan uses canonical renderer and password eye is display-only',()=>{
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 const live=fs.readFileSync('app/components/workspace/approved/live-shell.tsx','utf8');
 assert.match(client,/view==='actions'&&model&&\(model\.full\?<ActionPlan/);
 assert.match(client,/view==='analysis'&&model&&<FullCreditAnalysis/);
 assert.match(live,/details=\{billing \|\| ar \? undefined/);
 for(const file of ['app/login/credentials.tsx','app/reset-password/page.tsx']){
  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/aria-label=\{passwordVisible\?'Скрыть пароль':'Показать пароль'\}/);
  assert.match(source,/type=\{passwordVisible\?'text':'password'\}/);
  assert.match(source,/type="button" className="ps-password-visibility"/);
 }
});
