import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
const forbidden=/WorkspaceModelV1|ClientReportModelV1|canonical|DRAFT|SHADOW|synthetic|\bUUID\b|\bFREE\b|\bFULL\b/i;
const visible=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
test('actual upload, saved selection/reload, BASIC/FULL render and assigned broker share model; stranger denied',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const response=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'flow.txt',text:statementFixture({openingBalance:null,endingBalance:null})}]})});assert.equal(response.status,200);const {analysis}=await response.json();
 const list=await(await rt.request('/api/workspace')).json();assert.equal(list.analyses[0].id,analysis.id);
 const url='/api/workspace-model?analysisId='+analysis.id;
 const basic=await(await rt.request(url)).json();assert.equal(basic.state,'READY_BASIC');
 const {Home,Financing,Obligations,EmptyHome}=rt.load('app/components/workspace/presentation.tsx');
 const html=renderToStaticMarkup(React.createElement(Home,{model:basic}));assert.match(html,/Недостаточно данных/);assert.ok(html.includes(new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(basic.basic.bankingFacts.operatingInflow.value)));assert.doesNotMatch(visible(html),forbidden);assert.equal(basic.basic.bankingFacts.endingBalance.value,null);
 const reload=await(await rt.request('/api/workspace')).json();assert.ok(reload.analyses.some(a=>a.id===analysis.id));assert.deepEqual(await(await rt.request(url)).json(),basic);
 await rt.full(analysis.id);const full=await(await rt.request(url)).json();assert.equal(full.state,'READY_FULL');const fullHtml=renderToStaticMarkup(React.createElement(Home,{model:full}));assert.match(fullHtml,/PRESCORE INDEX/);assert.match(fullHtml,/Готовность к финансированию/);assert.match(fullHtml,/Расчётный запас/);assert.match(fullHtml,/ФИНАНСОВАЯ КАРТИНА ПО ВЫПИСКАМ/);assert.ok(fullHtml.includes(new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(full.basic.bankingFacts.operatingInflow.value)));assert.ok(fullHtml.includes('/dashboard/report-v2?analysisId='+analysis.id));
 for(const Component of [Home,Financing,Obligations])assert.doesNotMatch(visible(renderToStaticMarkup(React.createElement(Component,{model:full}))),forbidden);
 assert.doesNotMatch(visible(renderToStaticMarkup(React.createElement(EmptyHome,{start(){}}))),forbidden);
 await rt.assign(analysis);const broker=await(await rt.request(url,{},rt.broker)).json();assert.equal(broker.access.readOnly,true);assert.deepEqual(broker.full,full.full);
 const denied=await rt.request(url,{},rt.stranger);assert.equal(denied.status,404);assert.equal('basic' in await denied.json(),false);
 }finally{await rt.close();}
});
test('new analytical presentation has one API source and no legacy analytical fallback',()=>{
 for(const file of ['presentation.tsx','client.tsx','broker.tsx','use-model.ts']){const s=fs.readFileSync('app/components/workspace/'+file,'utf8');assert.doesNotMatch(s,/analysis\.(?:score|grade|readiness)|estimatedLimit|baseMonthlyPaymentCapacity|stressLimit|calculatedLimit|analysisView\(/);}
 assert.match(fs.readFileSync('app/components/workspace/use-model.ts','utf8'),/\/api\/workspace-model\?analysisId=/);
 for(const route of ['app/dashboard/workspace-v4','app/dashboard/workspace-new','app/dashboard/new'])assert.equal(fs.existsSync(route),false);
});

test('production broker GET executes PostgreSQL curator ordering without alias errors',async()=>{
 const rt=await createWorkspaceRuntime();try{
  // This read query operates on an already connected broker; GET cannot enroll it.
  await rt.db.prepare('INSERT INTO agent_accounts(user_email,agent_code,name) VALUES(?,?,?)').bind(rt.broker.email,'qa-broker','Алексей · брокер').run();
  const response=await rt.request('/api/agent',{},rt.broker);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.ok(body.agent.code);assert.deepEqual(body.leads,[]);
  assert.deepEqual(body.applications,[]);assert.deepEqual(body.curator.agents,[]);
 }finally{await rt.close();}
});


test('BASIC conclusion keeps direct access to separate banking analysis',async()=>{
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 assert.match(client,/view==='banking'[\s\S]*?<BankingLedger/);
 const rt=await createWorkspaceRuntime();try{
 const {conclusionFixture}=await import('./fixtures/credit-conclusion.mjs');
 const model=conclusionFixture().model;model.full=null;model.state='READY_BASIC';model.entitlement='BASIC';model.fullAvailability='LOCKED';
 const {CreditConclusion}=rt.load('app/components/workspace/credit-conclusion.tsx');
 const html=renderToStaticMarkup(React.createElement(CreditConclusion,{model}));
 assert.match(html,/Банковский результат сохранён/);
 assert.ok(html.includes('view=banking'));
 }finally{await rt.close();}
});


test('CLIENT and BROKER routes use the shared canonical presentation contract',()=>{
 const route=fs.readFileSync('app/agent/page.tsx','utf8');
 const agent=fs.readFileSync('app/components/workspace/broker.tsx','utf8');
 const shell=fs.readFileSync('app/components/workspace/client-shell.tsx','utf8');
 const presentation=fs.readFileSync('app/components/workspace/presentation.tsx','utf8');
 const legacy=/analysis\.(?:score|grade|readiness)|estimatedLimit|baseMonthlyPaymentCapacity|stressLimit|analysisView\(/;
 assert.match(route,/export \{ default \} from "\.\.\/components\/workspace\/broker"/);
 for(const title of ['Рабочий стол','Клиенты','Заявки','Воронка','Документы','Партнёрство'])assert.ok(shell.includes(title));
 for(const name of ['ExecutiveOverview','FullCreditAnalysis','DebtPortfolio','FinancingProducts','BankingLedger','FinancialStatements'])assert.ok(agent.includes(name));
 assert.doesNotMatch(agent,/<Home\b|agent\/agent\.css/);
 assert.doesNotMatch(agent,legacy);
 assert.match(presentation,/function ClientRecoveryShell/);
 assert.match(presentation,/Новый анализ/);
 assert.match(presentation,/БКИ и портфель/);
 assert.match(presentation,/Финансирование/);
 assert.doesNotMatch(presentation,/label:\s*'Предложения банков'/);
 assert.doesNotMatch(presentation,legacy);
});


test('Recovery Release 1: one analysis is shared consistently across CLIENT, BROKER and ADMIN',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const upload=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'recovery.txt',text:statementFixture({openingBalance:null,endingBalance:null})}]})});
  assert.equal(upload.status,200);const {analysis}=await upload.json();
  const ownerFirst=await(await rt.request('/api/workspace')).json();
  assert.equal(ownerFirst.analyses[0].id,analysis.id);
  const ownerModel=await(await rt.request('/api/workspace-model?analysisId='+analysis.id)).json();
  assert.equal(ownerModel.basic.analysis.company.inn,analysis.companyInn);
  const ownerReload=await(await rt.request('/api/workspace')).json();
  assert.ok(ownerReload.analyses.some(item=>item.id===analysis.id));

  await rt.assign(analysis);
  const brokerModel=await(await rt.request('/api/workspace-model?analysisId='+analysis.id,{},rt.broker)).json();
  assert.equal(brokerModel.analysisId,ownerModel.analysisId);
  assert.equal(brokerModel.basic.analysis.company.inn,ownerModel.basic.analysis.company.inn);
  assert.equal(brokerModel.access.readOnly,true);

  const adminResponse=await rt.request('/api/admin',{},rt.admin);
  assert.equal(adminResponse.status,200,await adminResponse.clone().text());
  const adminModel=await(await rt.request('/api/workspace-model?analysisId='+analysis.id,{},rt.admin)).json();
  assert.equal(adminModel.analysisId,ownerModel.analysisId);
  assert.equal(adminModel.basic.analysis.company.inn,ownerModel.basic.analysis.company.inn);
  const dossierResponse=await rt.request('/api/workspace?client='+analysis.id,{},rt.admin);
  assert.equal(dossierResponse.status,200,await dossierResponse.clone().text());
  const dossier=await dossierResponse.json();
  assert.equal(dossier.analyses[0].id,analysis.id);
 }finally{await rt.close();}
});
