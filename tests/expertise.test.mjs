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
 const r=buildCanonicalCreditAnalysis(loadBusiness(caseId).input),before=JSON.stringify(r),m=publicCanonicalModel(r.model,r);cases.set(caseId.slice(-3),{r,m});
 test(caseId+' expertise deterministic, immutable, unchanged canonical economics',()=>{assert.equal(JSON.stringify(r),before);assert.equal(crypto.createHash('sha256').update(before).digest('hex'),hashes[caseId]);assert.deepEqual(m.expertise,buildExpertise(r,m));validateExpertise(r,m,m.expertise);});
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
