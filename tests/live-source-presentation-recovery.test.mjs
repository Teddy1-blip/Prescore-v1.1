/** Focused presentation checks. Real target code; JSX/React and imported child components
 * are explicit stand-ins. These checks are not a browser, SQL, full build or scoring validation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=process.env.REPAIR_SOURCE_ROOT??process.cwd();
const isoDate=s=>s?String(s).slice(0,10).split('-').reverse().join('.'):'Период не указан';
const jsx=(type,props)=>({type,props:props??{}});
function load(file,basis=0){
 const compiled=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};let state=0;
 const imports={
  'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:Symbol.for('fragment')},
  'react':{useState:initial=>[state++===0?basis:initial,()=>{}],useEffect:()=>{}},
  './expertise.tsx':{ExpertiseMemo:()=>null},
  './presentation':{date:isoDate},
  './credit-depth':{sourceLabel:s=>s,sourceState:s=>s},
  './client-insights':{Panel:p=>jsx('section',p)},
  '../credit-engine/financial-analysis/source-selection.ts':{financialSources:m=>[m?.bfo,m?.quarterly].filter(Boolean)},
 };
 new Function('exports','require',compiled.outputText)(exports,id=>{
  if(Object.hasOwn(imports,id))return imports[id];
  if(id.endsWith('/client-report/copy.ts'))return load('lib/credit-engine/client-report/copy.ts');
  throw Error('UNEXPECTED_IMPORT:'+id);
 });
 return exports;
}
function expand(node){
 if(node===null||node===undefined||typeof node==='boolean')return [];
 if(Array.isArray(node))return node.flatMap(expand);
 if(typeof node!=='object')return [String(node)];
 if(typeof node.type==='function')return expand(node.type(node.props));
 return [{type:node.type,props:node.props},...expand(node.props.children)];
}
const text=node=>expand(node).filter(n=>typeof n==='string').join(' ');
const project=load('lib/workspace/model.ts').projectWorkspaceBasic;
const companyInn='9900002001';
function analysis(reportDate='2026-08-02',subjectInn=companyInn){return {id:'synthetic-ui',companyInn,companyName:'SYNTHETIC',createdAt:'2026-10-26',periodFrom:'2026-07-01',periodTo:'2026-07-31',metrics:{accounts:1},creditHistory:{reportDate,subjectInn},sourceManifest:{bankStatements:[],bki:{status:'READY',receivedAt:'2026-10-26',sourceType:'BKI',companyInn}}};}
const dateRow=a=>project(a).sources.availability.find(s=>s.source==='CREDIT_HISTORY');
test('BKI source exposes its report date, not the upload day',()=>{const a=analysis(),before=JSON.stringify(a);const row=dateRow(a);assert.equal(row.reportDate,'2026-08-02');assert.equal(row.periodFrom,null);assert.equal(row.periodTo,null);assert.equal(JSON.stringify(a),before);});
for(const [name,value] of [['missing',undefined],['null',null],['empty',''],['invalid leap date','2026-02-29'],['invalid month','2026-13-01'],['partial date','2026-08'],['timestamp','2026-08-02T12:00:00Z']])test('BKI '+name+' date is not guessed',()=>{const a=analysis();a.creditHistory.reportDate=value;assert.equal(dateRow(a).reportDate,null);});
test('another subject never supplies the displayed report date',()=>assert.equal(dateRow(analysis('2026-08-02','9900002010')).reportDate,null));
test('valid leap-day date remains exact',()=>assert.equal(dateRow(analysis('2024-02-29')).reportDate,'2024-02-29'));
test('non-BKI source rows retain their original shape and periods',()=>{const a=analysis();a.sourceManifest.bfo={status:'READY',sourceType:'BFO',periodFrom:'2025-01-01',periodTo:'2025-12-31'};const row=project(a).sources.availability.find(s=>s.source==='FINANCIAL_STATEMENTS');assert.deepEqual(row,{source:'FINANCIAL_STATEMENTS',status:'READY',periodFrom:'2025-01-01',periodTo:'2025-12-31'});});
function workspace(a){return {basic:project(a),access:{readOnly:false},full:{report:{analysisV3:{observations:[{type:'BKI',receivedAt:'2026-10-26'}]}}}};}
test('DocumentSources shows report date and receipt separately',()=>{const m=workspace(analysis()),before=JSON.stringify(m),view=load('app/components/workspace/client-documents.tsx').DocumentSources({model:m}),html=text(view);assert.match(html,/Дата отчёта: 02\.08\.2026/);assert.match(html,/Получен: 26\.10\.2026/);assert.doesNotMatch(html,/Период не указан — Период не указан/);assert.equal(JSON.stringify(m),before);});
test('DocumentSources makes additional-file counts distinct from analytical sources',()=>{const html=text(load('app/components/workspace/client-documents.tsx').DocumentSources({model:workspace(analysis())}));assert.match(html,/дополнительным файлам досье/);assert.match(html,/а не к обработанным выпискам, БФО и БКИ/);});
test('missing BKI report date is explicit even with a receipt',()=>{const a=analysis();delete a.creditHistory.reportDate;const html=text(load('app/components/workspace/client-documents.tsx').DocumentSources({model:workspace(a)}));assert.match(html,/Дата отчёта не подтверждена/);assert.doesNotMatch(html,/Дата отчёта: 26\.10\.2026/);});
const value=(n,asOf='2026-08-02')=>({value:n,asOf,knowledge:n===null?'UNKNOWN':'KNOWN',origin:'REPORTED',verification:'UNCONFIRMED',confidence:'HIGH'});
function report(){return {hero:{globalStop:false},capacity:{headline:null,status:'Недостаточно данных',confidence:'Низкая',text:'Ограниченный расчёт',details:[],disclaimer:'Не одобрение'},analysisV3:{financing:{observed:value(0,'2026-07-31'),scheduled:value(9000),views:[{kind:'RECURRING',operatingBasis:'CENTRAL',operatingAmount:100000,current:value(0),cautious:null,upper:null,headroom:null,confidence:'LOW'},{kind:'NEAR_TERM_30D',operatingBasis:'CENTRAL',operatingAmount:100000,current:value(9000),cautious:null,upper:null,headroom:null,confidence:'LOW'}]},scenarios:[]}};}
for(const [basis,label] of [[0,'По выпискам / месяц'],[1,'База ближайших 30 дней']])test('Financing distinguishes basis '+basis+' without changing values',()=>{const m=report(),before=JSON.stringify(m),view=load('app/dashboard/report-v2/analysis-v3.tsx',basis).Financing({model:m}),html=text(view);assert.ok(html.includes(label));assert.match(html,/0 ₽/);assert.match(html,/9\s000 ₽/);assert.match(html,/2026-08-02/);assert.doesNotMatch(html,/Действующее обслуживание/);assert.ok(expand(view).some(n=>n?.type==='details'&&n.props.open===true));assert.equal(JSON.stringify(m),before);});
test('zero observed cash payments are not asserted to mean zero company debt',()=>{const html=text(load('app/dashboard/report-v2/analysis-v3.tsx').Financing({model:report()}));assert.match(html,/не отсутствие долга компании/);assert.match(html,/Платёж в БКИ относится к дате источника/);});
test('unknown payment stays unknown rather than zero in financing',()=>{const m=report();m.analysisV3.financing.views[0].current=value(null);m.analysisV3.financing.observed=value(null);const html=text(load('app/dashboard/report-v2/analysis-v3.tsx').Financing({model:m}));assert.match(html,/Недостаточно данных/);assert.doesNotMatch(html,/(?:^|\s)0 ₽/);});
const legacyTitle='Проверить основание нулевого остатка долга';
const legacySummary='Если источник показывает ноль, подтвердите, что это заявленный остаток, а не результат отсутствующего поля.';
test('public action copy asks for a confirmed current principal balance without asserting zero',()=>{const copy=load('lib/credit-engine/client-report/copy.ts');assert.equal(copy.publicText(legacyTitle),'Подтвердить текущий остаток основного долга');assert.match(copy.publicText(legacySummary),/Исторический остаток и нулевая просрочка не подтверждают/);assert.equal(copy.clientText(legacyTitle),legacyTitle);assert.equal(copy.clientText(legacySummary),legacySummary);});
test('public generic factor copy does not assert that an unknown index was calculated',()=>{const copy=load('lib/credit-engine/client-report/copy.ts');assert.equal(copy.publicText('Кредитный фактор, уже отраженный в индексе'),'Фактор кредитной оценки; числовое влияние учитывается только при рассчитанном индексе');});
test('print Action uses the same public wording and preserves source report',()=>{const item={id:'a',claimId:'c',canonicalId:'r',title:legacyTitle,summary:legacySummary,steps:[legacySummary],why:'Основание неизвестно',prerequisites:[],status:'Нужны данные',group:'Долг',evidence:['Справка'],recheck:'Остаток'},before=JSON.stringify(item);const html=text(load('app/dashboard/report-v2/analysis-v3.tsx').Action({item,all:[]}));assert.match(html,/Подтвердить текущий остаток основного долга/);assert.doesNotMatch(html,/Проверить основание нулевого/);assert.equal(JSON.stringify(item),before);});
test('unrelated public copy and explicit numeric text remain unchanged',()=>{const copy=load('lib/credit-engine/client-report/copy.ts');for(const v of ['Подтверждённый долг 0 ₽','Просрочка 0 ₽','Исторический остаток 120 000 ₽','Без изменения'])assert.equal(copy.publicText(v),v);});
