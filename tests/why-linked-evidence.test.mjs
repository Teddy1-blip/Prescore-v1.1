import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {analyzeBankStatements,analysisForStorage} from '../lib/prescore.ts';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {publicText} from '../lib/credit-engine/client-report/copy.ts';
import {linkedWhyClaims,whySources,whySourceDates,whyTitle} from '../lib/workspace/why-evidence.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
// Actual Why component and actual canonical pipeline; child components not rendered here.
function whyComponent(){
 const file='app/components/workspace/client-insights.tsx',exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('exports','require',code)(exports,id=>{
  if(id==='react'||id==='react/jsx-runtime')return require(id);
  if(id.endsWith('/client-report/copy'))return {publicText};
  if(id.endsWith('/workspace/why-evidence'))return require('../lib/workspace/why-evidence.ts');
  if(id==='./presentation')return {date:s=>s?s.slice(0,10).split('-').reverse().join('.'):'Период не указан'};
  if(id==='./credit-depth')return {sourceLabel:s=>s==='BANK_STATEMENT'?'Банковские выписки':s,label:s=>s};
  if(id==='./client-financials'||id==='./banking-ledger'||id==='./cash-movement')return {};
  throw Error('UNEXPECTED_IMPORT:'+id);
 });return exports.Why;
}
const statement=fs.readFileSync(new URL('./fixtures/why-july-synthetic.txt',import.meta.url),'utf8');
const analysis=analysisForStorage(analyzeBankStatements([{fileName:'why-july-synthetic.txt',text:statement}]));
analysis.createdAt='2026-10-26T00:00:00Z';
for(const s of analysis.sourceManifest.bankStatements)s.receivedAt='2026-10-26';
const canonical=buildCanonicalCreditAnalysis({analysis});
const explanation=canonical.explainability;
const constraint=explanation.claims.find(c=>c.claimCode==='CONSTRAINT:CREDIT_RISK');
assert.ok(constraint);
const model={analysisId:'isolated-why-july',access:{role:'OWNER',readOnly:false},full:{canonical}};
const html=(m=model,ids=[constraint.claimId])=>renderToStaticMarkup(createElement(whyComponent(),{model:m,ids}));
test('reproduction: readiness Why reveals linked concentration and its July bank period',()=>{
 const before=JSON.stringify(model),h=html();
 assert.ok(canonical.riskAssessment.findings.some(f=>f.reasonCodes.includes('CUSTOMER_CONCENTRATION_HIGH')));
 assert.match(h,/Концентрация поступлений/);
 assert.match(h,/крупнейшего прямого покупателя/);
 assert.match(h,/01\.07\.2026.*31\.07\.2026/);
 assert.doesNotMatch(h,/Период не указан.*Период не указан/);
 assert.equal(JSON.stringify(model),before);
});
test('canonical concentration values and units are shown without invented percent or penalty',()=>{
 const h=html();assert.match(h,/Доля крупнейшего прямого покупателя: 1 \(доля от 1\)/);
 assert.match(h,/Покрытие идентификации покупателей: 1 \(доля от 1\)/);
 assert.doesNotMatch(h,/105|35\s?%|100\s?%/);
 assert.equal(whyTitle(explanation,constraint.claimId,'fallback'),'Концентрация поступлений');
});
test('CLIENT and read-only BROKER use identical explanations without changing canonical data',()=>{
 const before=JSON.stringify(canonical),broker={...model,access:{role:'ASSIGNED_BROKER',readOnly:true}};
 assert.equal(html(),html(broker));assert.equal(JSON.stringify(canonical),before);
});
test('IDs select linked factors only, deduplicate roots and never join by equal text or source kind',()=>{
 const e=structuredClone(explanation),risk=e.claims.find(c=>c.claimCode==='RISK-CF-CUSTOMER-CONCENTRATION');
 e.claims.push({...structuredClone(risk),claimId:'foreign-claim',riskFindingIds:['foreign-finding']});
 const claims=linkedWhyClaims(e,[constraint.claimId,constraint.claimId,risk.claimId]);
 assert.deepEqual(claims.map(x=>x.claim.claimId),[risk.claimId,constraint.claimId]);
 assert.ok(claims.every(x=>x.claim.claimId!=='foreign-claim'));
 assert.equal(whySources(e,risk).length,1,'one bank identity and period, not four repeated metric rows');
});
test('multiple linked factors preserve their own source identities and periods',()=>{
 const e=structuredClone(explanation),risk=e.claims.find(c=>c.claimCode==='RISK-CF-CUSTOMER-CONCENTRATION'),root=e.claims.find(c=>c.claimId===constraint.claimId);
 const second=structuredClone(risk);second.claimId='second-risk';second.riskFindingIds=['second-finding'];second.titleRu='Другой фактор';
 second.sourceReferenceIds=['second-source'];second.valueBindings=second.valueBindings.filter(v=>v.bindingCode==='BANK_TOP1').map(v=>({...v,sourceReferenceIds:['second-source']}));
 e.claims.push(second);root.riskFindingIds.push('second-finding');
 e.sourceReferences.push({...structuredClone(whySources(e,risk)[0]),sourceReferenceId:'second-source',sourceIds:['bank-second'],periodFrom:'2026-06-01',periodTo:'2026-06-30',asOf:'2026-06-30'});
 const m={...model,full:{canonical:{...canonical,explainability:e}}},h=html(m);
 assert.match(h,/01\.07\.2026 — 31\.07\.2026/);assert.match(h,/01\.06\.2026 — 30\.06\.2026/);
 assert.equal(whySources(e,risk)[0].periodFrom,'2026-07-01');assert.equal(whySources(e,second)[0].periodFrom,'2026-06-01');
});
test('missing related claim never substitutes a different factor or analysis period',()=>{
 const e=structuredClone(explanation);e.claims=e.claims.filter(c=>c.claimKind!=='FINDING');
 const h=html({...model,full:{canonical:{...canonical,explainability:e}}});
 assert.match(h,/Связанное основание этого ограничения отсутствует/);assert.doesNotMatch(h,/Концентрация поступлений|01\.07\.2026/);
 assert.equal(whyTitle(e,constraint.claimId,'original'),'original');
 assert.match(html(model,['missing-claim']),/Подробные основания этого вывода/);
 assert.equal(whyTitle({},constraint.claimId,'original'),'original');
});
for(const [name,dates,expected] of [
 ['absent',{periodFrom:null,periodTo:null,asOf:null},'Период не подтверждён'],
 ['start only',{periodFrom:'2026-07-01',periodTo:null,asOf:null},'С 01.07.2026; конец периода не подтверждён'],
 ['end only',{periodFrom:null,periodTo:'2026-07-31',asOf:null},'По 31.07.2026; начало периода не подтверждено'],
 ['asOf only',{periodFrom:null,periodTo:null,asOf:'2026-08-02'},'Период не подтверждён · Сведения на 02.08.2026'],
 ['invalid',{periodFrom:'2026-02-30',periodTo:'2026-07',asOf:null},'Период не подтверждён'],
])test('source dates: '+name,()=>assert.equal(whySourceDates(dates),expected));
test('same source kind with no shared identity never coalesces independent references',()=>{
 const e=structuredClone(explanation),risk=e.claims.find(c=>c.claimCode==='RISK-CF-CUSTOMER-CONCENTRATION');
 for(const s of e.sourceReferences)s.sourceIds=[];
 assert.equal(whySources(e,risk).length,4);
});
