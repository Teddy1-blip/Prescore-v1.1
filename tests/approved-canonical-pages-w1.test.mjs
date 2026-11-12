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
  const render=(page)=>renderToStaticMarkup(React.createElement(ApprovedPage,{page,data,focus:'Финансист',go:()=>{},apps:[],details:detail}));
  for(const page of ['analysis','banking','financing','documents','applications','actions']){
   const html=render(page);
   assert.match(html,/CANONICAL_EVIDENCE_SENTINEL/,page);
   assert.match(html,/class="approved-canonical-section"/,page);
   assert.doesNotMatch(html,/class="details"/,page);
   assert.match(html,/id="approved-source-operations"/,page);
  }
  assert.match(render('home'),/class="details"/);
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
