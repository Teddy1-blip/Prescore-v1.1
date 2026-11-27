import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';

test('uploaded quarterly source recalculates persisted canonical financials; duplicate and foreign-source rejected',async()=>{
 const rt=await createWorkspaceRuntime();try{
 const upload=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{fileName:'client-e2e.txt',text:statementFixture()}]})});
 assert.equal(upload.status,200);
 const {analysis}=await upload.json();
 await rt.full(analysis.id);
 const url='/api/workspace-model?analysisId='+analysis.id;
 const before=await(await rt.request(url)).json();
 const csv=`Бухгалтерская отчетность за Январь - Март 2026 г.\nОрганизация ООО ТЕСТ\nИНН ${analysis.companyInn}\nЕдиница измерения: тыс. руб.\nВнеоборотные активы 1100 100\nОборотные активы 1200 900\nДебиторская задолженность 1230 400\nДенежные средства 1250 300\nБАЛАНС 1600 1000\nКапитал и резервы 1300 600\nДолгосрочные обязательства 1400 100\nКраткосрочные обязательства 1500 300\nКредиторская задолженность 1520 200\nВыручка 2110 1200\nЧистая прибыль 2400 120`;
 const send=async(text,user=rt.owner)=>{const data=new FormData();data.set('analysisId',analysis.id);data.set('sourceType','QUARTERLY');data.set('file',new File([text],'quarter.csv',{type:'text/csv'}));return rt.request('/api/source-documents',{method:'POST',body:data},user);};
 const response=await send(csv);
 assert.equal(response.status,200,await response.clone().text());
 assert.equal((await response.json()).processedBy,'server');
 const model=await(await rt.request(url)).json();
 assert.equal(model.analysisId,analysis.id);
 assert.equal(model.state,'READY_FULL');
 assert.ok(model.full.report.financialAnalysis.history.length>0);
 assert.ok(model.basic.sources.availability.some(s=>s.source==='QUARTERLY_REPORT'&&s.status==='READY'));

 const {buildSourceDelta}=rt.load('app/components/workspace/source-operations.tsx');
 const delta=buildSourceDelta('QUARTERLY',before,model);
 assert.equal(delta.kind,'QUARTERLY');
 assert.equal(delta.sourceChanged,true);
 assert.equal(delta.fullComparisonAvailable,true);
 assert.ok(delta.facts.some(fact=>fact.includes('Выручка')));
 assert.equal(delta.next.code,'BFO');
 assert.equal(delta.next.view,'documents');

 const reload=await(await rt.request(url)).json();
 assert.deepEqual(reload.full.report.financialAnalysis,model.full.report.financialAnalysis);
 assert.equal((await send(csv)).status,409);
 assert.equal((await send(csv,rt.stranger)).status,404);
 assert.equal((await send(csv.replace(analysis.companyInn,'7701234567'))).status,400);
 assert.deepEqual((await(await rt.request(url)).json()).full.report.financialAnalysis,model.full.report.financialAnalysis);
 }finally{await rt.close();}
});

test('progressive enrichment keeps one ordered next source',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const {orderedNextSource}=rt.load('app/components/workspace/source-operations.tsx');
  const model=(availability)=>({basic:{sources:{availability}}});
  const ready=(source)=>({source,status:'READY',periodFrom:null,periodTo:null});
  assert.equal(orderedNextSource(model([])).code,'BFO');
  assert.equal(orderedNextSource(model([ready('FINANCIAL_STATEMENTS')])).code,'BKI');
  assert.equal(orderedNextSource(model([ready('FINANCIAL_STATEMENTS'),ready('CREDIT_HISTORY')])).code,'QUARTERLY');
  assert.equal(orderedNextSource(model([ready('FINANCIAL_STATEMENTS'),ready('CREDIT_HISTORY'),ready('QUARTERLY_REPORT')])).code,'ANALYSIS');
 }finally{await rt.close();}
});
