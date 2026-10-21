/** Isolated service/hook contract tests: real target source, synthetic inputs, stubbed engine/React/DB.
 * Not a Next.js build, a live browser run, or a proof of the scoring engine's arithmetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = process.env.REPAIR_SOURCE_ROOT ?? process.cwd();
function loader(overrides={}, context={}) {
 const cache=new Map();
 function load(name) {
  if(cache.has(name))return cache.get(name);
  const file=path.join(root,name),source=fs.readFileSync(file,'utf8');
  const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
  assert.deepEqual((result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  const module={exports:{}};cache.set(name,module.exports);
  const localRequire=id=>{
   if(Object.hasOwn(overrides,id))return overrides[id];
   if(!id.startsWith('.'))return require(id);
   let relative=path.normalize(path.join(path.dirname(name),id));
   if(!path.extname(relative))relative+='.ts';
   return load(relative);
  };
  new Function('require','module','exports','console','fetch',result.outputText)(localRequire,module,module.exports,context.console??console,context.fetch??globalThis.fetch);
  return module.exports;
 }
 return load;
}
const stage=new Set(['SAVED_INPUT','SAVED_IDENTITY','ENTITLEMENT_READ','BASIC_PROJECTION','PROFILE_READ','SOURCES','BANK_METRICS_REQUIRED','CAPACITY','PUBLIC_MODEL']);
const shared=loader();
const {diagnostic}=shared('lib/credit-engine/production/diagnostics.ts');
const {workspaceDiagnosticMessage}=shared('lib/workspace/diagnostic-view.ts');
class CanonicalUnavailable extends Error {constructor(stage,reason='UNEXPECTED_FAILURE'){super('CANONICAL_REPORT_UNAVAILABLE');this.stage=stage;this.reason=reason;}}
const id='fixture-analysis',inn='9900000012';
function fixture(options={}) {
 const calls=[],logs=[];
 const known=value=>({value,status:'KNOWN',confidence:'HIGH',unit:'RUB',periodFrom:'2026-01-01',periodTo:'2026-01-31'});
 const analysis={id,companyInn:inn,companyName:'Synthetic company',createdAt:'2026-02-01',periodFrom:'2026-01-01',periodTo:'2026-01-31',metrics:{accounts:1},
  sourceManifest:{bankStatements:[{sourceId:'synthetic',sourceType:'BANK_STATEMENT',status:'READY',periodFrom:'2026-01-01',periodTo:'2026-01-31'}]},
  metricsV2:{period:{from:'2026-01-01',to:'2026-01-31'},cashFlow:{grossExternalCashInflow:known(100000),grossExternalCashOutflow:known(0),netExternalCashFlow:known(100000)},operating:{operatingCashReceipts:known(100000)},debtService:{},tax:{},individualAndCash:{},liquidity:{endingBalance:known(150000)},customers:{},monthly:[]},
  ...options.analysis};
 const report={sentinel:'canonical-report',expertise:null};
 const canonical={model:report,sourceObservations:[],prescoreIndex:{value:123},financingReadiness:{level:'UNKNOWN'},creditAssessment:{},debtCapacity:{},productSelection:{},recommendationSet:{},actionPlan:{},explainability:{}};
 const overrides={
  './financing-request.ts':{savedCanonicalInput:(analysis,companyProfile)=>({analysis,companyProfile})},
  '../credit-engine/production/orchestrator.ts':{CanonicalUnavailable,buildCanonicalCreditAnalysis(input){calls.push('engine');if(options.engineError)throw options.engineError;return canonical;}},
  '../credit-engine/production/public-model.ts':{publicCanonicalModel(model){calls.push('public-model');if(options.publicError)throw options.publicError;return model;}},
  '../credit-engine/financial-analysis/source-selection.ts':{financialSources:manifest=>[manifest?.bfo,manifest?.quarterly].filter(Boolean)},
 };
 const load=loader(overrides,{console:{error:(...args)=>logs.push(args)}}),service=load('lib/workspace/service.ts');
 const deps={
  async readAccess(){calls.push('access');return options.denied?null:{access:options.access??'owner',row:{companyInn:inn,ownerEmail:'owner@fixture.test',payload:options.payload??JSON.stringify(analysis)}};},
  async readTier(){calls.push('tier');if(options.tierError)throw options.tierError;return options.tier??'FULL';},
  async readOperations(){calls.push('operations');if(options.operationsError)throw options.operationsError;return {documents:{status:'NONE',count:0,analysisCount:0},applications:{status:'NONE',count:0,activeCount:0,statuses:[]}};},
  async readProfile(){calls.push('profile');if(options.profileError)throw options.profileError;return undefined;},
 };
 return {run:()=>service.loadWorkspaceModelV1(id,deps),calls,logs,analysis,report};
}
function safe(d) {assert.ok(d);assert.ok(stage.has(d.stage));assert.match(d.id,/^[0-9a-f-]{36}$/);assert.ok(workspaceDiagnosticMessage(d));}

test('authorized READY_FULL remains unchanged and has no failure diagnostic',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.state,'READY_FULL');assert.equal(r.full.report,f.report);assert.equal(r.full.canonical.prescoreIndex.value,123);assert.equal(r.diagnostic,undefined);assert.equal(f.logs.length,0);
 assert.equal(r.basic.bankingFacts.grossInflow.value,100000);assert.equal(r.basic.bankingFacts.grossOutflow.value,0);
});
test('ownership precedes input parsing and diagnostics',async()=>{
 const f=fixture({denied:true,payload:'SECRET INVALID JSON'}),r=await f.run();assert.equal(r.state,'NOT_FOUND');assert.equal(r.diagnostic,undefined);assert.deepEqual(f.calls,['access']);assert.deepEqual(f.logs,[]);
});
for(const [name,payload,expected]of [['malformed JSON','secret{','INVALID_SAVED_JSON'],['null','null','INVALID_SAVED_SHAPE'],['array','[]','INVALID_SAVED_SHAPE']])test(`saved ${name} has a safe diagnostic`,async()=>{
 const f=fixture({payload}),r=await f.run();assert.equal(r.state,'UNAVAILABLE');assert.equal(r.diagnostic.reason,expected);safe(r.diagnostic);assert.deepEqual(f.calls,['access']);assert.doesNotMatch(JSON.stringify(r)+JSON.stringify(f.logs),/secret\{/);
});
test('saved identity mismatch is not silently shown as missing source data',async()=>{
 const f=fixture({analysis:{companyInn:'0000000000'}}),r=await f.run();assert.equal(r.diagnostic.stage,'SAVED_IDENTITY');assert.equal(r.diagnostic.reason,'SAVED_IDENTITY_MISMATCH');assert.ok(!f.calls.includes('engine'));
});
test('invalid saved shape does not enter basic projection',async()=>{const f=fixture({analysis:{createdAt:null}}),r=await f.run();assert.equal(r.diagnostic.reason,'INVALID_SAVED_SHAPE');assert.equal(r.state,'UNAVAILABLE');});
test('malformed basic metric structure is reported, not an unhandled projection exception',async()=>{const r=await fixture({analysis:{metricsV2:{}}}).run();assert.equal(r.state,'UNAVAILABLE');assert.equal(r.diagnostic.stage,'BASIC_PROJECTION');safe(r.diagnostic);});
test('missing BASIC bank metrics are distinct from a paid gate; no full computation',async()=>{
 const f=fixture({tier:'FREE',analysis:{metricsV2:undefined}}),r=await f.run();assert.equal(r.state,'READY_BASIC');assert.equal(r.fullAvailability,'LOCKED');assert.equal(r.basic.bankingFacts.grossInflow.value,null);assert.equal(r.diagnostic.reason,'BANK_METRICS_MISSING');assert.ok(!f.calls.includes('profile'));assert.ok(!f.calls.includes('engine'));
});
test('valid BASIC result is locked, not a computation failure',async()=>{const f=fixture({tier:'FREE'}),r=await f.run();assert.equal(r.fullAvailability,'LOCKED');assert.equal(r.diagnostic,undefined);assert.equal(r.basic.bankingFacts.grossOutflow.value,0);assert.ok(!f.calls.includes('engine'));});
test('entitlement lookup failure never grants FULL or sends user to repeat payment',async()=>{
 const f=fixture({tierError:Error('password SECRET_SENTINEL')}),r=await f.run();assert.equal(r.entitlement,'BASIC');assert.equal(r.fullAvailability,'UNAVAILABLE');assert.equal(r.diagnostic.stage,'ENTITLEMENT_READ');assert.ok(!f.calls.includes('profile'));assert.match(workspaceDiagnosticMessage(r.diagnostic),/повторная оплата не требуется/);assert.doesNotMatch(JSON.stringify(r)+JSON.stringify(f.logs),/SECRET_SENTINEL/);
});
test('optional operations read failure remains UNKNOWN while analytics can succeed',async()=>{const r=await fixture({operationsError:Error('db down')}).run();assert.equal(r.state,'READY_FULL');assert.equal(r.basic.operations.documents.status,'UNKNOWN');assert.equal(r.basic.operations.documents.count,null);});
test('profile read failure keeps bank facts and identifies the read stage',async()=>{
 const f=fixture({profileError:Error('SELECT secret_table')}),r=await f.run();assert.equal(r.state,'READY_BASIC');assert.equal(r.basic.bankingFacts.grossInflow.value,100000);assert.equal(r.diagnostic.stage,'PROFILE_READ');assert.ok(!f.calls.includes('engine'));assert.doesNotMatch(JSON.stringify(r)+JSON.stringify(f.logs),/secret_table/);
});
test('canonical validator stage and exact reason reach the existing workspace response',async()=>{
 const f=fixture({engineError:new CanonicalUnavailable('CAPACITY','FULL_MONTH_OUTSIDE_BANK_PERIOD')}),r=await f.run();assert.equal(r.fullAvailability,'UNAVAILABLE');assert.equal(r.diagnostic.stage,'CAPACITY');assert.equal(r.diagnostic.reason,'FULL_MONTH_OUTSIDE_BANK_PERIOD');assert.equal(r.full,undefined);assert.equal(r.basic.bankingFacts.grossInflow.value,100000);safe(r.diagnostic);
});
test('unexpected engine errors do not expose thrown text or fabricate financial results',async()=>{const f=fixture({engineError:Error('PRIVATE PAYLOAD')}),r=await f.run();assert.equal(r.diagnostic.reason,'UNEXPECTED_FAILURE');assert.equal(r.full,undefined);assert.doesNotMatch(JSON.stringify(r)+JSON.stringify(f.logs),/PRIVATE PAYLOAD/);});
test('presentation failure is distinguished from a failed financial calculation',async()=>{const f=fixture({publicError:Error('unsafe model data')}),r=await f.run();assert.equal(r.diagnostic.stage,'PUBLIC_MODEL');assert.ok(f.calls.includes('engine'));safe(r.diagnostic);});
test('assigned broker remains read-only on a diagnosed failure',async()=>{const r=await fixture({access:'agent',engineError:new CanonicalUnavailable('CAPACITY','BANK_VERSION_OR_SHAPE')}).run();assert.equal(r.access.readOnly,true);assert.equal(r.access.role,'ASSIGNED_BROKER');});
test('safe display ignores unexpected fields and refuses forged diagnostic metadata',()=>{
 const d=diagnostic('CAPACITY','BANK_METRICS_MISSING');assert.match(workspaceDiagnosticMessage({...d,payload:'SECRET',message:'SECRET'}),/BANK_METRICS_MISSING/);assert.ok(!workspaceDiagnosticMessage({...d,payload:'SECRET'}).includes('SECRET'));
 for(const bad of [null,[],{}, {...d,id:'SECRET'},{...d,stage:'__proto__'},{...d,reason:'MY_SECRET_PASSWORD'},{...d,version:'secret'}])assert.equal(workspaceDiagnosticMessage(bad),'');
});
test('diagnostics leave saved payload unchanged and do not require database writes',async()=>{const f=fixture({engineError:new CanonicalUnavailable('CAPACITY','BANK_PERIOD_ORDER')}),before=JSON.stringify(f.analysis);await f.run();assert.equal(JSON.stringify(f.analysis),before);assert.ok(f.calls.every(c=>['access','tier','operations','profile','engine','public-model'].includes(c)));});

// Minimal hook runner: real source and async fetch control, deliberately not React's scheduler.
function hookHarness() {
 const slots=[],effects=[],responses=[];let index=0,currentId='A',currentRevision=0;
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={
  useState(initial){const n=index++;slots[n]??={value:typeof initial==='function'?initial():initial};return [slots[n].value,v=>{slots[n].value=typeof v==='function'?v(slots[n].value):v;}];},
  useRef(value){const n=index++;slots[n]??={current:value};return slots[n];},
  useCallback(fn,deps){const n=index++;if(!slots[n]||!equal(slots[n].deps,deps))slots[n]={deps,fn};return slots[n].fn;},
  useEffect(fn,deps){const n=index++;if(!slots[n]||!equal(slots[n].deps,deps)){const old=slots[n];effects.push(()=>{old?.cleanup?.();slots[n]={deps,cleanup:fn()};});}},
 };
 const load=loader({'react':react},{fetch:async(url,options)=>{const next=responses.shift();assert.ok(next,'Unexpected extra fetch');return typeof next==='function'?next(url,options):next;}});
 const {useWorkspaceModel}=load('app/components/workspace/use-model.ts');
 return {responses,render(id=currentId,revision=currentRevision){currentId=id;currentRevision=revision;index=0;const result=useWorkspaceModel(id,revision);while(effects.length)effects.shift()();return result;},async tick(){await new Promise(resolve=>setImmediate(resolve));}};
}
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const valid=(id,extra={})=>({analysisId:id,state:'READY_BASIC',fullAvailability:'LOCKED',...extra});
test('successful BASIC response carries a safe missing-metrics diagnostic to the screen',async()=>{
 const h=hookHarness();h.responses.push(response(valid('A',{diagnostic:diagnostic('BANK_METRICS_REQUIRED','BANK_METRICS_MISSING')})));h.render();await h.tick();const r=h.render();assert.equal(r.error,'');assert.equal(r.model.analysisId,'A');assert.match(r.diagnostic,/BANK_METRICS_MISSING/);
});
test('HTTP 503 diagnostic survives initial model-load failure',async()=>{
 const h=hookHarness();h.responses.push(response({analysisId:'A',state:'UNAVAILABLE',diagnostic:diagnostic('SAVED_INPUT','INVALID_SAVED_JSON')},503));h.render();await h.tick();const r=h.render();assert.equal(r.model,null);assert.match(r.diagnostic,/INVALID_SAVED_JSON/);assert.ok(r.error);
});
test('failed refresh preserves only the previous same-analysis model and the new failure code',async()=>{
 const h=hookHarness();h.responses.push(response(valid('A')));h.render();await h.tick();const previous=h.render();h.responses.push(response({analysisId:'A',diagnostic:diagnostic('BASIC_PROJECTION','UNEXPECTED_FAILURE')},503));await previous.refresh();const r=h.render();assert.equal(r.model.analysisId,'A');assert.ok(r.refreshError);assert.match(r.diagnostic,/подготовка банковских показателей/);
});
for(const status of [401,403,404])test(`HTTP ${status} clears previously displayed model and withholds diagnostics`,async()=>{
 const h=hookHarness();h.responses.push(response(valid('A',{state:'READY_FULL',full:{sentinel:'private'}})));h.render();await h.tick();const previous=h.render();h.responses.push(response({analysisId:'A',diagnostic:diagnostic('SAVED_INPUT','INVALID_SAVED_JSON')},status));await previous.refresh();const r=h.render();assert.equal(r.model,null);assert.equal(r.diagnostic,'');assert.ok(r.error);
});
test('switching companies clears the previous diagnostic while the next request is pending',async()=>{
 const h=hookHarness();h.responses.push(response(valid('A',{diagnostic:diagnostic('BANK_METRICS_REQUIRED','BANK_METRICS_MISSING')})));h.render();await h.tick();assert.ok(h.render().diagnostic);h.responses.push(()=>new Promise(()=>{}));const r=h.render('B');assert.equal(r.diagnostic,'');assert.equal(r.model,null);assert.equal(r.loading,true);
});
test('a response for another analysis never contributes its model or diagnostic',async()=>{
 const h=hookHarness();h.responses.push(response(valid('B',{diagnostic:diagnostic('BANK_METRICS_REQUIRED','BANK_METRICS_MISSING')})));h.render('A');await h.tick();const r=h.render();assert.equal(r.model,null);assert.equal(r.diagnostic,'');assert.ok(r.error);
});
test('a recovered successful response clears the previous failure',async()=>{
 const h=hookHarness();h.responses.push(response({analysisId:'A',diagnostic:diagnostic('SAVED_INPUT','INVALID_SAVED_JSON')},503));h.render();await h.tick();const failed=h.render();h.responses.push(response(valid('A')));await failed.refresh();const r=h.render();assert.equal(r.error,'');assert.equal(r.diagnostic,'');assert.equal(r.model.analysisId,'A');
});
test('invalid JSON and raw server errors are never displayed as diagnostics',async()=>{
 const h=hookHarness();h.responses.push(new Response('SENSITIVE_SENTINEL',{status:503}));h.render();await h.tick();const r=h.render();assert.doesNotMatch(r.error+r.diagnostic,/SENSITIVE_SENTINEL/);assert.equal(r.model,null);
});
