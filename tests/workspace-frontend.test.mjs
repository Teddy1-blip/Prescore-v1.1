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
 await rt.full(analysis.id);const full=await(await rt.request(url)).json();assert.equal(full.state,'READY_FULL');const fullHtml=renderToStaticMarkup(React.createElement(Home,{model:full}));assert.match(fullHtml,/PRESCORE INDEX/);assert.match(fullHtml,/Готовность к финансированию/);assert.match(fullHtml,/Расчётный запас/);assert.ok(fullHtml.includes('/dashboard/report-v2?analysisId='+analysis.id));
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
  const response=await rt.request('/api/agent',{},rt.broker);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.ok(body.agent.code);assert.deepEqual(body.leads,[]);
  assert.deepEqual(body.applications,[]);assert.deepEqual(body.curator.agents,[]);
 }finally{await rt.close();}
});
