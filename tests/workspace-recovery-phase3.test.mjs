import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
test('Phase 3 server screening, persistence and operational contexts',async t=>{
 const oldRoot=process.env.PRESCORE_STORAGE_ROOT,storageRoot=fs.mkdtempSync(path.join(os.tmpdir(),"phase3-documents-"));process.env.PRESCORE_STORAGE_ROOT=storageRoot;
 const rt=await createWorkspaceRuntime();const json=body=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{
 const text=statementFixture(),second=statementFixture({periodFrom:'01.08.2026',periodTo:'31.08.2026',transactionDate:'15.08.2026',number:'2'});
 const r=await rt.request('/api/analysis',json({statements:[{fileName:'same.txt',text},{fileName:'same.txt',text:second},{fileName:'copy.txt',text},{fileName:'other.txt',text:statementFixture({inn:'7723456789',company:'SYNTHETIC OTHER',amount:'999999'})},{fileName:'bad.txt',text:'not a statement'},{fileName:'parse.txt',text:'1CClientBankExchange\nКонецФайла'}]}));assert.equal(r.status,200);const payload=await r.json(),a=payload.analysis;
 const {ScreeningSummary,AnalysisHistory}=rt.load('app/components/workspace/client-operations.tsx');const {documentContext}=rt.load('app/dashboard/documents-hub.tsx');const render=(C,p)=>renderToStaticMarkup(React.createElement(C,p));
 await t.test('all returned screening rows and reasons visible',()=>{const html=render(ScreeningSummary,{receipt:payload,open:true});for(const row of payload.screeningResults){assert.ok(html.includes(row.fileName));if(row.reason)assert.ok(html.includes(row.reason));}assert.match(html,/Приняты сервером: 2/);assert.match(html,/Исключены: 4/);});
 await t.test('same name and account different periods accepted by server',()=>assert.equal(payload.screeningResults.filter(x=>x.status==='ACCEPTED').length,2));
 await t.test('content duplicate excluded',()=>assert.equal(payload.screeningResults.find(x=>x.fileName==='copy.txt').status,'DUPLICATE'));
 await t.test('other company excluded',()=>assert.equal(payload.screeningResults.find(x=>x.fileName==='other.txt').status,'COMPANY_MISMATCH'));
 await t.test('unsupported and parse errors returned',()=>{assert.equal(payload.screeningResults.find(x=>x.fileName==='bad.txt').status,'UNSUPPORTED');assert.equal(payload.screeningResults.find(x=>x.fileName==='parse.txt').status,'UNRECOGNIZED');});
 const model=await(await rt.request('/api/workspace-model?analysisId='+a.id)).json();
 await t.test('rejected amounts absent in persisted banking facts',()=>{assert.equal(model.basic.bankingFacts.grossInflow.value,200000);assert.equal(model.basic.sources.statements.count,2);});
 const workspace=await(await rt.request('/api/workspace')).json();
 await t.test('screening persists across workspace reload',()=>assert.deepEqual(workspace.analyses.find(x=>x.id===a.id).screeningResults,payload.screeningResults));
 await t.test('history uses server period tier and selected state',()=>{const html=render(AnalysisHistory,{analyses:workspace.analyses,selectedId:a.id,select:()=>{}});assert.match(html,/BASIC/);assert.match(html,/aria-current="true"/);assert.ok(html.includes(a.periodTo.split("-").reverse().join(".")));});
 await t.test('missing history data not invented',()=>assert.match(render(AnalysisHistory,{analyses:[{id:'x',companyName:'X',companyInn:''}],selectedId:'x',select:()=>{}}),/Доступ не уточнён/));
 await t.test('unknown analysis is not returned as another model',async()=>assert.equal((await rt.request('/api/workspace-model?analysisId=missing')).status,404));
 const deal={id:crypto.randomUUID(),analysisId:a.id,companyName:a.companyName,product:'Оборотный кредит',bank:'Synthetic Bank',amount:100,status:'Черновик',owner:'Клиент',nextAction:'Проверить'};
 await t.test('create persists application history',async()=>{assert.equal((await rt.request('/api/workspace',json({type:'deal',deal}))).status,201);const d=(await(await rt.request('/api/workspace')).json()).deals.find(x=>x.id===deal.id);assert.equal(d.nextAction,'Проверить');assert.ok(d.statusHistory.length);});
 await t.test('cancel persists status nextAction history and counter',async()=>{assert.equal((await rt.request('/api/workspace',{...json({id:deal.id,status:'Отменена клиентом'}),method:'PATCH'})).status,200);const d=(await(await rt.request('/api/workspace')).json()).deals.find(x=>x.id===deal.id);assert.equal(d.status,'Отменена клиентом');assert.equal(d.nextAction,'Заявка отменена клиентом');assert.equal(d.statusHistory.length,2);const m=await(await rt.request('/api/workspace-model?analysisId='+a.id)).json();assert.equal(m.basic.operations.applications.count,1);});
 await t.test('document associations explicit and missing association honest',()=>{assert.equal(documentContext({companyInn:'1',analysisId:a.id,applicationId:deal.id},a.id).analysis,'Выбранный анализ');assert.match(documentContext({companyInn:'1',analysisId:'other',applicationId:''},a.id).analysis,/Другой/);assert.equal(documentContext({companyInn:'1',analysisId:'',applicationId:''},a.id).analysis,'Без привязки к анализу');});
 await t.test('document stored listed downloaded with existing contract',async()=>{const r=await rt.request('/api/documents',json({companyInn:a.companyInn,analysisId:a.id,applicationId:deal.id,category:'Прочее',fileName:'synthetic.txt',mimeType:'text/plain',sizeBytes:4,contentBase64:Buffer.from('TEST').toString('base64')}));assert.equal(r.status,201);const d=(await r.json()).document;const list=await(await rt.request('/api/documents?inn='+a.companyInn)).json();assert.ok(list.documents.some(x=>x.id===d.id&&x.analysisId===a.id&&x.applicationId===deal.id));assert.equal(await(await rt.request('/api/documents?download='+d.id)).text(),'TEST');});
 }finally{await rt.close();if(oldRoot===undefined)delete process.env.PRESCORE_STORAGE_ROOT;else process.env.PRESCORE_STORAGE_ROOT=oldRoot;fs.rmSync(storageRoot,{recursive:true,force:true});}
});
test('Phase 3 frontend has no legacy analytical dependencies or client dedup parser',()=>{for(const name of ['client-operations.tsx','client.tsx','use-model.ts','source-operations.tsx']){const s=fs.readFileSync('app/components/workspace/'+name,'utf8');assert.doesNotMatch(s,/analysis\.(score|grade|readiness)|estimatedLimit|stressLimit|baseMonthlyPaymentCapacity|compareCreditPortfolio\(|buildActionPlan\(/);}assert.doesNotMatch(fs.readFileSync('app/components/workspace/client-operations.tsx','utf8'),/inspectBankStatement|inspection\.accounts/);});
