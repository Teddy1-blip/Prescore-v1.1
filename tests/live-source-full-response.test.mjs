/** Regression for the real workspace service -> serialized response -> displayed fields.
 * DB access, canonical engine, public-model adapter, React scheduling and child widgets
 * are explicit synthetic boundaries. Not a database, browser or scoring acceptance run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=process.env.REPAIR_SOURCE_ROOT??process.cwd();
const jsx=(type,props)=>({type,props:props??{}});
const date=value=>value?String(value).slice(0,10).split('-').reverse().join('.'):'Период не указан';
const empty=()=>null;
const views={
 'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:Symbol.for('fragment')},
 react:{useState:initial=>[typeof initial==='function'?initial():initial,empty]},
 './presentation':{date,money:String,FullAccessNotice:()=>jsx('p',{children:'FULL_LOCKED'})},
 './credit-depth':{sourceLabel:String,sourceState:String,label:String,PublishedValue:empty},
 './external-sources':{ExternalSourceCards:()=>null},
  './client-insights':{Panel:props=>jsx('section',props),FactorRows:empty,ActionItem:empty,
  Why:props=>jsx('button',{'data-claims':props.ids.join(','),children:'Почему?'}),CreditSummary:empty,SourceSummary:empty,AssessmentLimits:empty},
 './client-financials':{ReconciliationDetails:empty,FinancialStatements:empty},
 './product-copy':{productPurpose:String,productReason:String},
 './banking-ledger':{BankingSnapshot:empty},
 './explanation-library':{ExplanationLibrary:empty},
 '../../dashboard/report-v2/analysis-v3':{Financing:empty},
};
function loader(overrides={}){
 const cache=new Map();
 function load(name){
  if(cache.has(name))return cache.get(name);
  const file=path.join(root,name);
  const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
  assert.deepEqual((result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  const loadedModule={exports:{}};cache.set(name,loadedModule.exports);
  const localRequire=id=>{
   if(Object.hasOwn(overrides,id))return overrides[id];
   if(Object.hasOwn(views,id))return views[id];
   if(!id.startsWith('.'))return require(id);
   let relative=path.normalize(path.join(path.dirname(name),id));
   if(!path.extname(relative))relative+=fs.existsSync(path.join(root,relative+'.ts'))?'.ts':'.tsx';
   return load(relative);
  };
  new Function('require','module','exports',result.outputText)(localRequire,loadedModule,loadedModule.exports);
  return loadedModule.exports;
 }
 return load;
}
function expand(node){
 if(node==null||typeof node==='boolean')return [];
 if(Array.isArray(node))return node.flatMap(expand);
 if(typeof node!=='object')return [String(node)];
 if(typeof node.type==='function')return expand(node.type(node.props));
 return [{type:node.type,props:node.props},...expand(node.props.children)];
}
const text=node=>expand(node).filter(item=>typeof item==='string').join(' ');
const inn='9900002001',id='synthetic-full-source';
const legacyTitle='Кредитный фактор, уже отраженный в индексе';
const legacyText='Используется исходная причина ограничения.';
function reportFixture(){return {
 meta:{asOfDate:'2026-10-26'},hero:{headline:'Недостаточно данных',summary:'Нужны сопоставимые источники',globalStop:false,confidence:'Низкая'},
 readiness:{constraints:[{id:'constraint',claimId:'claim-1',title:legacyTitle,text:legacyText}],level:'Недостаточно данных',text:'Ограничение'},
 primaryFactors:[],contextHighlights:[],detailedSections:[],limitations:[],dataQuality:[],expertise:null,
 analysisV3:{observations:[{type:'BKI',receivedAt:'2026-10-26'}]},index:{value:null,components:[]},
};}
class CanonicalUnavailable extends Error {constructor(stage,reason){super('CANONICAL_REPORT_UNAVAILABLE');this.stage=stage;this.reason=reason;}}
function fixture(options={}){
 const known=value=>({value,status:'KNOWN',confidence:'HIGH',unit:'RUB',periodFrom:'2026-07-01',periodTo:'2026-07-31'});
 const bki={sourceId:'bki:synthetic',sourceType:'BKI',status:'READY',companyInn:inn,receivedAt:'2026-10-26'};
 const analysis={id,companyInn:inn,companyName:'SYNTHETIC',createdAt:'2026-10-26',periodFrom:'2026-07-01',periodTo:'2026-07-31',metrics:{accounts:1},
  creditHistory:{subjectInn:inn,reportDate:'2026-08-02',...options.creditHistory},
  sourceManifest:{bankStatements:[{sourceId:'bank:synthetic',sourceType:'BANK_STATEMENT',status:'READY',periodFrom:'2026-07-01',periodTo:'2026-07-31'}],bki},
  metricsV2:{period:{from:'2026-07-01',to:'2026-07-31'},cashFlow:{grossExternalCashInflow:known(100000),grossExternalCashOutflow:known(0),netExternalCashFlow:known(100000)},operating:{operatingCashReceipts:known(100000)},debtService:{},tax:{},individualAndCash:{},liquidity:{endingBalance:known(150000)},customers:{},monthly:[]}};
 if(options.withoutBki)delete analysis.sourceManifest.bki;
 const observations=options.observations??[analysis.sourceManifest.bankStatements[0],bki,
  {sourceId:'external-bfo',sourceType:'BFO',status:'READY',periodFrom:'2025-01-01',periodTo:'2025-12-31'}];
 const canonical={model:reportFixture(),sourceObservations:observations.map(s=>({sourceId:s.sourceId,sourceType:s.sourceType,status:s.status,periodFrom:s.periodFrom??null,periodTo:s.periodTo??null,receivedAt:s.receivedAt??'2026-10-26'})),
  prescoreIndex:{value:null,coverage:{components:[
   {component:'LEGAL_CORPORATE',state:'INSUFFICIENT',missingFactCodes:['LEGAL_LIFECYCLE']},
   {component:'OPERATING_BEHAVIOR',state:'LIMITED',missingFactCodes:['BANK_OPERATING_TREND']},
  ]}},financingReadiness:{level:'UNKNOWN'},creditAssessment:{},debtCapacity:{},productSelection:{},recommendationSet:{},actionPlan:{},explainability:{}};
 let engineCalls=0;
 const load=loader({
  './financing-request.ts':{savedCanonicalInput:(analysis,companyProfile)=>({analysis,companyProfile})},
  '../credit-engine/production/orchestrator.ts':{CanonicalUnavailable,buildCanonicalCreditAnalysis(){engineCalls++;return canonical;}},
  '../credit-engine/production/public-model.ts':{publicCanonicalModel:model=>model},
  '../credit-engine/financial-analysis/source-selection.ts':{financialSources:manifest=>[manifest?.bfo,manifest?.quarterly].filter(Boolean)},
 });
 const deps={readAccess:async()=>options.denied?null:{access:options.access??'owner',row:{companyInn:inn,ownerEmail:'synthetic@test.invalid',payload:JSON.stringify(analysis)}},
  readTier:async()=>options.tier??'FULL',readOperations:async()=>({documents:{status:'NONE',count:0,analysisCount:0},applications:{status:'NONE',count:0,activeCount:0,statuses:[]}}),readProfile:async()=>undefined};
 return {analysis,canonical,load,engineCalls:()=>engineCalls,run:()=>load('lib/workspace/service.ts').loadWorkspaceModelV1(id,deps)};
}
const row=model=>model.basic.sources.availability.find(item=>item.source==='CREDIT_HISTORY');

test('FULL response preserves validated BKI date through JSON to DocumentSources',async()=>{
 const f=fixture(),before=JSON.stringify({a:f.analysis,c:f.canonical});
 const result=JSON.parse(JSON.stringify(await f.run()));
 assert.equal(result.state,'READY_FULL');assert.equal(row(result).reportDate,'2026-08-02');
 assert.equal(row(result).periodFrom,null);assert.equal(row(result).periodTo,null);
 const rendered=text(f.load('app/components/workspace/client-documents.tsx').DocumentSources({model:result}));
 assert.match(rendered,/Дата отчёта: 02\.08\.2026/);assert.match(rendered,/Получен: 26\.10\.2026/);
 assert.doesNotMatch(rendered,/Дата отчёта не подтверждена/);
 assert.equal(JSON.stringify({a:f.analysis,c:f.canonical}),before);
 assert.equal(result.basic.bankingFacts.grossInflow.value,100000);assert.equal(result.basic.bankingFacts.endingBalance.value,150000);
});
test('BASIC and FULL use the same validated report date without changing access',async()=>{
 const basic=fixture({tier:'FREE'}),full=fixture(),a=await basic.run(),b=await full.run();
 assert.equal(a.state,'READY_BASIC');assert.equal(a.fullAvailability,'LOCKED');assert.equal(a.full,undefined);assert.equal(b.state,'READY_FULL');
 assert.equal(row(a).reportDate,'2026-08-02');assert.equal(row(b).reportDate,row(a).reportDate);assert.equal(basic.engineCalls(),0);
});
for(const [name,creditHistory] of [
 ['missing date',{reportDate:undefined}],['null date',{reportDate:null}],['invalid date',{reportDate:'2026-02-29'}],
 ['timestamp',{reportDate:'2026-08-02T12:00:00Z'}],['foreign subject',{subjectInn:'9900002010'}],['unknown subject',{subjectInn:''}],
])test('FULL does not invent a report date for '+name,async()=>{
 const f=fixture({creditHistory}),r=await f.run();assert.equal(r.state,'READY_FULL');assert.equal(row(r).reportDate,null);
 assert.match(text(f.load('app/components/workspace/client-documents.tsx').DocumentSources({model:r})),/Дата отчёта не подтверждена/);
});
test('FULL never attaches the saved date to a different canonical BKI source',async()=>{
 const f=fixture({observations:[{sourceId:'bki:other',sourceType:'BKI',status:'READY'}]});
 assert.equal(row(await f.run()).reportDate,null);
});
test('FULL without a saved BKI manifest cannot claim the date for an observation',async()=>{
 const f=fixture({withoutBki:true});assert.equal(row(await f.run()).reportDate,null);
});
test('canonical sources remain authoritative and non-BKI rows keep their shape',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.basic.sources.availability.length,3);
 assert.deepEqual(r.basic.sources.availability.find(s=>s.source==='FINANCIAL_STATEMENTS'),{source:'FINANCIAL_STATEMENTS',status:'READY',periodFrom:'2025-01-01',periodTo:'2025-12-31'});
 assert.equal('reportDate' in r.basic.sources.availability.find(s=>s.source==='BANK_STATEMENTS'),false);
 assert.deepEqual(r.full.report,f.canonical.model);assert.deepEqual(r.full.canonical.prescoreIndex,f.canonical.prescoreIndex);
});
test('permission denial still precedes calculation and publishing source metadata',async()=>{
 const f=fixture({denied:true}),r=await f.run();assert.equal(r.state,'NOT_FOUND');assert.equal(r.basic,undefined);assert.equal(f.engineCalls(),0);
});
test('assigned broker retains read-only access and the same displayed report date',async()=>{
 const f=fixture({access:'agent'}),r=await f.run();assert.equal(r.access.readOnly,true);assert.equal(r.access.role,'ASSIGNED_BROKER');assert.equal(row(r).reportDate,'2026-08-02');
});
for(const group of ['constraints','limitations','dataQuality'])test('Conclusion applies public wording to its '+group+' constraint',async()=>{
 const f=fixture(),m=await f.run(),r=m.full.report;
 if(group!=='constraints'){r[group]=r.readiness.constraints;r.readiness.constraints=[];}
 const before=JSON.stringify(m),view=f.load('app/components/workspace/client-analysis.tsx').FullCreditAnalysis({model:m,retry:empty});
 const output=text(view);assert.doesNotMatch(output,/Кредитный фактор, уже отраженный в индексе/);assert.doesNotMatch(output,/Используется исходная причина ограничения\./);
 assert.match(output,/Фактор кредитной оценки; числовое влияние учитывается только при рассчитанном индексе/);
 assert.match(output,/Для уточнения готовности проверьте связанный источник/);
 assert.ok(expand(view).some(n=>n?.props?.['data-claims']==='claim-1'));
 assert.equal(JSON.stringify(m),before);assert.equal(m.full.canonical.prescoreIndex.value,null);
  assert.match(output,/Не подтверждён юридический статус компании/);
  assert.match(output,/Не подтверждена динамика банковского оборота/);
});
test('unrelated constraint and its explicit zero remain untouched',async()=>{
 const f=fixture(),m=await f.run();Object.assign(m.full.report.readiness.constraints[0],{title:'Подтверждённая просрочка 0 ₽',text:'Отчёт на 02.08.2026'});
 const output=text(f.load('app/components/workspace/client-analysis.tsx').FullCreditAnalysis({model:m,retry:empty}));
 assert.match(output,/Подтверждённая просрочка 0 ₽/);assert.match(output,/Отчёт на 02\.08\.2026/);
});
test('Conclusion keeps the existing empty-constraint and locked states',async()=>{
 const f=fixture(),m=await f.run();m.full.report.readiness.constraints=[];
 const component=f.load('app/components/workspace/client-analysis.tsx').FullCreditAnalysis;
 assert.match(text(component({model:m,retry:empty})),/Отдельное ограничение не выделено/);
 delete m.full;assert.equal(text(component({model:m,retry:empty})),'FULL_LOCKED');
});
