import {historicalBusinessResult} from './fixtures/historical-bank-inputs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import './fixtures/client-report/render.mjs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {businessCatalog,loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../lib/credit-engine/production/public-model.ts';
import {buildClientReportModel} from '../lib/credit-engine/client-report/adapter.ts';
import {buildExpertise,validateExpertise,canonicalExpertiseContext} from '../lib/credit-engine/expertise/model.ts';
const {ExpertiseMemo}=await import('../app/dashboard/report-v2/expertise.tsx');
const {PrintReport}=await import('../app/dashboard/report-v2/print-report.tsx');
const cases=new Map();const hashes=JSON.parse(fs.readFileSync('tests/fixtures/client-report/analysis-v3-canonical-hashes.json'));
for(const {caseId}of businessCatalog()){
 const input=loadBusiness(caseId).input,r=buildCanonicalCreditAnalysis(input),before=JSON.stringify(r),m=publicCanonicalModel(r.model,r);cases.set(caseId.slice(-3),{r,m});
 test(caseId+' expertise deterministic, immutable, unchanged canonical economics',()=>{assert.equal(JSON.stringify(r),before);assert.equal(crypto.createHash('sha256').update(JSON.stringify(historicalBusinessResult(caseId,input))).digest('hex'),hashes[caseId]);assert.deepEqual(m.expertise,buildExpertise(r,m));validateExpertise(r,m,m.expertise);});
 test(caseId+' all statements have upstream lineage and no bank promises',()=>{for(const i of m.expertise.items){assert.ok(i.claimIds.length);assert.ok(i.sourceReferenceIds.length);assert.ok(i.affectedObjects.length);assert.equal(i.asOfDate,r.asOfDate);for(const cid of i.claimIds)assert.ok(r.explainability.claims.some(c=>c.claimId===cid));for(const sid of i.sourceReferenceIds)assert.ok(r.explainability.sourceReferences.some(s=>s.sourceReferenceId===sid));assert.doesNotMatch(JSON.stringify(i),/банк (?:одобрит|откажет|выдаст)|гарантировано|идеальный заёмщик/);}});
 test(caseId+' screen/print expose same expertise statements and unique IDs',()=>{for(const print of [false,true]){const h=renderToStaticMarkup(createElement(ExpertiseMemo,{model:m,print}));for(const i of m.expertise.items)assert.ok(h.includes('id="'+i.id+'"'),i.id);const ids=[...h.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);assert.ok(!/NaN|undefined|Infinity/.test(h));}const h=renderToStaticMarkup(createElement(PrintReport,{model:m}));assert.ok(h.includes('data-expertise-version="PRESCORE-EXPERTISE-1.0.0"'));assert.match(h,/<details(?=[^>]*class="ex-proof")(?=[^>]*open="")[^>]*>/);});
 test(caseId+' FREE redacts memo, creditor view, structure and AI seam server-side',()=>{const free=buildClientReportModel(r,{entitlement:'FREE'});free.expertise=m.expertise;const projection=publicCanonicalModel(free,r);assert.equal(projection.expertise,undefined);assert.equal(buildExpertise(r,free),undefined);assert.equal(canonicalExpertiseContext(r,free),undefined);assert.equal(renderToStaticMarkup(createElement(ExpertiseMemo,{model:free})), '');});
}
const get=n=>cases.get(n);const text=n=>JSON.stringify(get(n).m.expertise);
test('001 strength is evidence of recurring capacity, not 1000 guarantee',()=>{const {m,r}=get('001');assert.ok(m.expertise.strengthIds.length);const s=m.expertise.items.find(i=>i.id===m.expertise.strengthIds[0]);assert.equal(r.debtCapacity.recurringView.incrementalHeadroom.state,'POSITIVE');assert.equal(s.knowledge,'KNOWN');assert.ok(s.limitation.includes('частичным'));assert.ok(!s.claimIds.includes(r.explainability.claims.find(c=>c.claimCode==='INDEX_VALUE').claimId));});
for(const n of ['011','016','022'])test(n+' missing/contradictory capacity never fabricated as strength',()=>assert.equal(get(n).m.expertise.strengthIds.length,0));
test('017 global stop no optimistic products or principal scenarios',()=>{const {m,r}=get('017');assert.equal(m.expertise.strengthIds.length,0);for(const id of m.expertise.structureIds){const i=m.expertise.items.find(x=>x.id===id);assert.ok(i.limitation.includes('Глобальное ограничение'));assert.ok(i.claimIds.every(cid=>!r.explainability.claims.some(c=>c.claimId===cid&&(c.claimKind==='PRODUCT_FIT'||c.claimCode==='CAPACITY_SCENARIO'))));}});
test('013 current 1000 RUB and historical zero DAYS remain separate',()=>{const s=text('013');assert.match(s,/Текущая просроченная сумма/);assert.match(s,/1[\s\u00a0\u202f]000/);assert.match(s,/0 дней/);assert.doesNotMatch(s,/идеальн.*истори/);});
test('022 conflict 11.8m remains subtotal; dependent capacity UNKNOWN',()=>{const {m}=get('022');const cap=m.expertise.items.find(i=>i.title==='Расчетный запас обслуживания долга');assert.ok(cap.fact.includes('Конфликт версий операции'));assert.match(cap.fact,/11[\s\u00a0\u202f]800[\s\u00a0\u202f]000/);assert.match(cap.fact,/не полный/);assert.equal(cap.knowledge,'UNKNOWN');assert.equal(m.capacity.headline.value,null);assert.equal(m.expertise.structureIds.length,9);});
test('checklists differ with actual limitations, overdue and conflict',()=>{assert.notEqual(text('001'),text('013'));const a=get('001').m.expertise.items.filter(i=>i.category==='CHECK').map(i=>i.title);const b=get('013').m.expertise.items.filter(i=>i.category==='CHECK').map(i=>i.title);assert.ok(b.some(x=>x.includes('просроч')));assert.ok(!a.some(x=>x.includes('просроч')));});
for(const [name,mutate,error]of [
 ['orphan claim',x=>x.items[0].claimIds=['orphan'],/ORPHAN/],
 ['orphan source',x=>x.items[0].sourceReferenceIds=['orphan'],/ORPHAN/],
 ['unknown strength',x=>x.items.find(i=>i.category==='STRENGTH').knowledge='UNKNOWN',/UNKNOWN_STRENGTH/],
 ['mixed asOf',x=>x.items[0].asOfDate='1999-01-01',/ASOF/],
 ['bank promise',x=>x.items[0].fact='банк одобрит',/BANK_PROMISE/],
 ['untracked sentence',x=>x.items[0].fact+=' Всё прекрасно.',/UNSUPPORTED/],
 ['fabricated approval',x=>x.items[0].fact='APPROVE',/UNSUPPORTED/],
 ['untracked field',x=>x.rawDocument='hidden',/UNSUPPORTED/],
])test('validator rejects '+name,()=>{const {r,m}=get('001'),x=structuredClone(m.expertise);mutate(x);assert.throws(()=>validateExpertise(r,m,x),error);});
test('mixed upstream asOf rejected, older evidence dates not relabelled',()=>{const {r,m}=get('001');const v=structuredClone(r);v.debtCapacity.asOfDate='1999-01-01';assert.throws(()=>buildExpertise(v,m),/ASOF/);});
test('legacy injected metrics cannot affect memo',()=>{const {r,m}=get('001');const x=structuredClone(r);Object.assign(x,{score:999,readiness:100,estimatedLimit:99999999});assert.deepEqual(buildExpertise(x,m),m.expertise);const source=fs.readFileSync('lib/credit-engine/expertise/model.ts','utf8');assert.doesNotMatch(source,/estimatedLimit|\.score\b|Date\.now|Math\.random|fetch\(|providers|\/engine/);});
test('future seam is allowlisted cloned public context with no raw documents/policies',()=>{const {r,m}=get('001');const x=canonicalExpertiseContext(r,m);assert.deepEqual(Object.keys(x).sort(),['asOfDate','expertise','explainabilityReference','reportReference','version']);assert.doesNotMatch(JSON.stringify(x),/rawValue|rawField|contractNumber|accountNumber|policyFingerprint|policyVersion|20_PERCENT|25_PERCENT|threshold|weights/);x.expertise.items[0].fact='mutated';assert.notEqual(x.expertise.items[0].fact,m.expertise.items[0].fact);});
test('memo renderer escapes malicious text',()=>{const m=structuredClone(get('001').m);m.expertise.items[0].fact='<img src=x onerror=alert(1)>';const h=renderToStaticMarkup(createElement(ExpertiseMemo,{model:m}));assert.ok(h.includes('&lt;img'));assert.ok(!h.includes('<img'));});

test('old optional-model previews do not link to absent expertise',async()=>{const {AnalysisV3}=await import('../app/dashboard/report-v2/analysis-v3.tsx');const m=structuredClone(get('001').m);delete m.expertise;const h=renderToStaticMarkup(createElement(AnalysisV3,{model:m}));assert.ok(!h.includes('href="#expertise"'));});

test('memo summary container does not share its layout class with items',()=>{const h=renderToStaticMarkup(createElement(ExpertiseMemo,{model:get('001').m}));assert.equal((h.match(/class="ex-summary"/g)??[]).length,1);assert.ok(h.includes('ex-item-summary'));});

const {expertiseEditorial,expertiseStatementStatus}=await import('../lib/credit-engine/expertise/editorial.ts');
for(const [n,{m}]of cases){
 test(n+' editorial is deterministic, read-only and each thesis clause has exact item lineage',()=>{
  const before=JSON.stringify(m),v=expertiseEditorial(m);assert.deepEqual(v,expertiseEditorial(m));assert.equal(JSON.stringify(m),before);
  assert.ok(v.sentences.length>=2&&v.sentences.length<=4);
  assert.equal(v.sentences[0].role,'POSITION');assert.equal(v.sentences.at(-1).role,'STEP');
  for(const s of v.sentences){const items=s.itemIds.map(id=>m.expertise.items.find(i=>i.id===id));assert.ok(items.every(Boolean));assert.deepEqual(s.claimIds,[...new Set(items.flatMap(i=>i.claimIds))]);assert.deepEqual(s.sourceReferenceIds,[...new Set(items.flatMap(i=>i.sourceReferenceIds))]);assert.ok(s.claimIds.length&&s.sourceReferenceIds.length);}
  assert.equal(v.sentences.some(s=>s.role==='STRENGTH'),m.expertise.strengthIds.length>0);
  assert.equal(expertiseEditorial({...m,meta:{...m.meta,entitlement:'FREE'}}),undefined);
 });
 test(n+' all checklist evidence retained with blockers and existing day7 focus first',()=>{
  const v=expertiseEditorial(m),e=m.expertise,all=[...v.checklistFirst,...v.checklistOther];
  assert.equal(v.checklistFirst.length,Math.min(5,e.checklistIds.length));assert.deepEqual([...all].sort(),[...e.checklistIds].sort());
  const focus=new Set([...m.actionPlan.focusIds,...m.actionPlan.horizons.filter(h=>h.id==='day7').flatMap(h=>h.items.map(a=>a.id))]);
  const group=id=>{const i=e.items.find(i=>i.id===id);return i.applicationStatus==='BLOCKS_ASSESSMENT'?0:i.actionIds.some(a=>focus.has(a))?1:i.applicationStatus==='CLARIFY'&&(m.recommendations.primary.some(a=>i.claimIds.includes(a.claimId))||m.readiness.constraints.some(f=>i.factorIds.includes(f.id)))?2:3;};
  assert.deepEqual(all.map(group),all.map(group).sort());
  for(const tier of [0,1,2,3])assert.deepEqual(all.filter(id=>group(id)===tier),e.checklistIds.filter(id=>group(id)===tier));
 });
 test(n+' financing hierarchy follows canonical primary/other products without losing items',()=>{
  const v=expertiseEditorial(m),e=m.expertise;assert.deepEqual([...v.structurePrimary,...v.structureOther].sort(),[...e.structureIds].sort());
  for(const id of v.structureOther){const i=e.items.find(i=>i.id===id);assert.ok(m.productFit.other.some(p=>i.claimIds.includes(p.claimId)));assert.ok(!m.productFit.primary.some(p=>i.claimIds.includes(p.claimId)));}
  for(const p of m.productFit.primary)for(const i of e.items.filter(i=>i.category==='STRUCTURE'&&i.claimIds.includes(p.claimId)))assert.ok(v.structurePrimary.includes(i.id));
 });
 test(n+' CLIENT and print hide technical lineage and show supported creditor interpretation',()=>{
  for(const print of [false,true]){const h=renderToStaticMarkup(createElement(ExpertiseMemo,{model:m,print}));const visible=h.replace(/<[^>]*>/g,' ');
   assert.match(visible,/Вывод Prescore/);assert.match(visible,/Сформировано на основе данных анализа/);assert.doesNotMatch(visible,/Детерминированный анализ|explanation-claim:|source-reference:|claimIds|sourceReferenceIds/);
   for(const i of m.expertise.items)for(const id of [...i.claimIds,...i.sourceReferenceIds])assert.ok(!visible.includes(id),id);
   assert.doesNotMatch(h,/class="ex-lineage"/);assert.match(h,/class="ex-checklist-first"/);
   if(m.expertise.checklistIds.length>5)assert.match(h,print?/<details(?=[^>]*class="ex-group ex-checklist-other")(?=[^>]*open="")[^>]*>/:/<details class="ex-group ex-checklist-other">/);
   for(const id of [...m.expertise.creditor.convincing,...m.expertise.creditor.review,...m.expertise.creditor.structureLimits,...m.expertise.creditor.unknowns]){const i=m.expertise.items.find(i=>i.id===id);const text=i.knowledge==='KNOWN'?i.interpretation:i.limitation;assert.ok(h.includes(renderToStaticMarkup(createElement('p',null,text))));}
  }
 });
}
test('summary fact status never reuses CLARIFY checklist label; confidence preserved',()=>{
 for(const {m}of cases.values())for(const i of m.expertise.items.filter(i=>i.category==='SUMMARY'||i.category==='STRENGTH'))assert.notEqual(expertiseStatementStatus(i),'Требуется документ или уточнение');
 const i=get('001').m.expertise.items[0];assert.equal(i.confidence,'UNKNOWN');assert.equal(i.knowledge,'PARTIAL');assert.equal(expertiseStatementStatus(i),'Оценка ограничена данными');
 assert.equal(expertiseStatementStatus({...i,knowledge:'KNOWN',confidence:'HIGH'}),'Рассчитано по доступным данным');
});
test('editorial thesis retains global stop and conflicting-source constraints, without positive invention',()=>{
 for(const n of ['011','017','022'])assert.ok(!expertiseEditorial(get(n).m).sentences.some(s=>s.role==='STRENGTH'));
 assert.match(expertiseEditorial(get('017').m).sentences.find(s=>s.role==='LIMITATION').text,/глобального ограничения/);
 assert.match(expertiseEditorial(get('022').m).sentences.find(s=>s.role==='LIMITATION').text,/Расхождение версий/);
});
test('011 thesis leads with missing capacity evidence, not mere appearance of an obligation',()=>{
 assert.match(expertiseEditorial(get('011').m).sentences.find(s=>s.role==='LIMITATION').text,/Согласованных оснований недостаточно/);
});
