import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {integrationB} from './fixtures/integration-b.mjs';
import {syntheticPdf} from '../scripts/release/pdf-fixture.mjs';

// Isolated transport doubles only. No fixture key, test host or trust flag exists
// in the application. A real request for this non-existent token cannot verify it.
const url='https://egrul.nalog.ru/vyp-download/'+'a'.repeat(64);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const localDate=iso=>iso.split('-').reverse().join('.');
const shifted=days=>new Date(Date.parse(today)+days*86400000).toISOString().slice(0,10);
const pdf=({inn='9900002906',date=today,status='Действующее юридическое лицо',extra=''}={})=>syntheticPdf([
  'СИНТЕТИЧЕСКИЙ ТЕСТ, НЕ ДОКУМЕНТ ФНС','ВЫПИСКА','из Единого государственного реестра юридических лиц',
  'ИНН '+inn,'Сведения по состоянию на '+localDate(date),'Состояние юридического лица:',status,extra]);
async function seed(rt){const a=integrationB({noLegal:true}).analysis;
  await rt.db.prepare('INSERT INTO analyses (id,company_name,company_inn,file_name,period_from,period_to,score,grade,readiness,payload,owner_email,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(a.id,a.companyName,a.companyInn,a.fileName,a.periodFrom,a.periodTo,a.score,a.grade,a.readiness,JSON.stringify(a),rt.owner.email,a.createdAt).run();
  await rt.full(a.id);await rt.assign(a);return a;
}
function response(bytes,finalUrl=url,status=200){const r=new Response(bytes,{status,headers:{'content-type':'application/pdf'}});Object.defineProperty(r,'url',{value:finalUrl});return r;}

test('trusted legal intake: real handler/PDF/PGlite, fail-closed provenance, canonical coverage and access',async t=>{
  const rt=await createWorkspaceRuntime(),originalFetch=globalThis.fetch;let official=pdf(),fetches=0,fail=false;
  globalThis.fetch=async (u,options)=>{fetches++;assert.equal(u,url);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');if(fail)throw Error('network secret URL must not leak');return response(official);};
  try {
    const a=await seed(rt),server=rt.load('lib/legal-registry-server.ts');
    const post=async(bytes,link=url,user=rt.owner)=>{const body=new FormData();body.set('analysisId',a.id);body.set('file',new File([bytes],'synthetic-registry.pdf',{type:'application/pdf'}));body.set('officialUrl',link);body.set('verified','true');body.set('lifecycle','ACTIVE');return rt.request('/api/legal-source',{method:'POST',body},user);};
    const saved=async()=>JSON.parse((await rt.db.prepare('SELECT payload FROM analyses WHERE id=?').bind(a.id).first()).payload);
    const expectError=async(bytes,link,code,status=400)=>{const before=await saved(),r=await post(bytes,link);assert.equal(r.status,status,await r.clone().text());assert.equal((await r.json()).error,code);assert.deepEqual(await saved(),before);};
    await t.test('authorization before file processing or network',async()=>{
      for(const user of [rt.stranger,rt.broker,rt.admin,null])assert.equal((await post(pdf(),url,user)).status,user?404:401);
      assert.equal(fetches,0);
    });
    await t.test('foreign identity, corrupt PDF and unsupported origins cannot alter saved analysis',async()=>{
      await expectError(pdf({inn:'9900002907'}),url,'LEGAL_COMPANY_IDENTITY_MISMATCH');
      await expectError(Buffer.from('%PDF-broken'),url,'LEGAL_PDF_INVALID');
      for(const link of ['http://egrul.nalog.ru/vyp-download/'+'a'.repeat(64),'https://localhost/file.pdf','https://egrul.nalog.ru.evil.test/file.pdf',url+'?redirect=1',url+'#x',url.replace('egrul.nalog.ru','egrul.nalog.ru:444'),url.replace('/vyp-download/','/uploads/')])await expectError(pdf(),link,'OFFICIAL_DOWNLOAD_URL_REQUIRED');
      assert.equal(fetches,0);
    });
    await t.test('document text and client flags alone never verify provenance',async()=>{
      const r=await post(pdf(),'');assert.equal(r.status,200,await r.clone().text());const b=await r.json();
      assert.equal(b.legalRegistry.activeSourceId,null);assert.equal(b.legalRegistry.history[0].origin,'UNCONFIRMED');assert.equal(b.legalRegistry.history[0].eligible,false);
      assert.equal(fetches,0);const facts=rt.load('lib/credit-engine/risk/adapters/legal.ts').legalFacts({analysis:await saved(),asOfDate:today},[]);assert.equal(facts.length,0);
    });
    await t.test('server independently retrieved bytes reach existing adapter and canonical coverage',async()=>{
      const r=await post(pdf());assert.equal(r.status,200,await r.clone().text());const body=await r.json(),receipt=body.legalRegistry.history.at(-1);
      assert.equal(receipt.origin,'CONFIRMED');assert.equal(receipt.signatureChecked,false);assert.equal(receipt.eligible,true);assert.equal(receipt.contentHash,createHash('sha256').update(pdf()).digest('hex'));
      assert.equal(receipt.informationDate,today);assert.equal(receipt.verifier,'PRESCORE-FNS-INTAKE-1');assert.ok(receipt.checkedAt);assert.ok(!JSON.stringify(body).includes('a'.repeat(64)));
      const analysis=await saved(),facts=rt.load('lib/credit-engine/risk/adapters/legal.ts').legalFacts({analysis,asOfDate:today},[]);
      assert.equal(facts.length,1);assert.equal(facts[0].semanticCode,'LEGAL_LIFECYCLE');assert.equal(facts[0].value,'ACTIVE');assert.equal(facts[0].confidence,'HIGH');
      const build=rt.load('lib/credit-engine/production/orchestrator.ts').buildCanonicalCreditAnalysis;
      const r2=build({analysis,asOfDate:today});assert.ok(!r2.prescoreIndex.coverage.components.find(c=>c.component==='LEGAL_CORPORATE').missingFactCodes.includes('LEGAL_LIFECYCLE'));
      assert.equal(facts.some(f=>f.semanticCode==='LEGAL_ADDRESS_UNRELIABLE'),false);
      for(const user of [rt.owner,rt.broker,rt.admin]){const w=await rt.request('/api/workspace-model?analysisId='+a.id,{},user);assert.equal(w.status,200,await w.clone().text());const model=await w.json();assert.deepEqual(model.basic.legalRegistry,body.legalRegistry);assert.equal(model.access.readOnly,user===rt.broker);}
      assert.equal((await rt.request('/api/workspace-model?analysisId='+a.id,{},rt.stranger)).status,404);
    });
    await t.test('duplicate and tampering preserve the confirmed source',async()=>{
      await expectError(pdf(),url,'LEGAL_SOURCE_ALREADY_SAVED',409);
      await expectError(pdf({status:'Находится в процессе ликвидации'}),url,'OFFICIAL_CONTENT_HASH_MISMATCH');
    });
    await t.test('failed independent retrieval retains audit record and does not replace confirmed source',async()=>{
      const id=(await saved()).legalRegistryV1.activeSourceId;fail=true;
      const r=await post(pdf({extra:'network attempt'}));fail=false;assert.equal(r.status,200);const v=(await r.json()).legalRegistry;
      assert.equal(v.activeSourceId,id);assert.equal(v.history.at(-1).origin,'UNCONFIRMED');assert.deepEqual(v.history.at(-1).reasons,['OFFICIAL_SOURCE_UNAVAILABLE']);
    });
    await t.test('stale, future, ambiguous and missing explicit statuses cannot become known',async()=>{
      for(const [input,code] of [[{date:shifted(-31)},'INFORMATION_DATE_STALE'],[{date:shifted(1)},'INFORMATION_DATE_FUTURE'],[{status:'Неизвестно'},'LIFECYCLE_NOT_EXPLICIT_OR_AMBIGUOUS'],[{extra:'Статус юридического лица: Ликвидировано'},'LIFECYCLE_NOT_EXPLICIT_OR_AMBIGUOUS']]){
        official=pdf(input);const r=await post(official);assert.equal(r.status,200,await r.clone().text());const receipt=(await r.json()).legalRegistry.history.at(-1);assert.equal(receipt.eligible,false);assert.ok(receipt.reasons.includes(code));
      }
    });
    await t.test('replacement keeps lineage; verified same-date contradiction invalidates selection',async()=>{
      const old=(await saved()).legalRegistryV1.activeSourceId;official=pdf({extra:'second independently retrieved copy'});
      const r=await post(official);assert.equal(r.status,200);const v=(await r.json()).legalRegistry;assert.equal(v.history.at(-1).replacesSourceId,old);assert.notEqual(v.activeSourceId,old);assert.ok(v.history.find(h=>h.id===old));
      official=pdf({status:'Находится в процессе ликвидации'});assert.equal((await post(official)).status,200);
      let analysis=await saved();assert.equal(analysis.legalRegistryV1.activeSourceId,null);
      assert.equal(rt.load('lib/credit-engine/risk/adapters/legal.ts').legalFacts({analysis,asOfDate:today},[])[0].value,null);
      await post(pdf({extra:'later unverified attempt'}),'');analysis=await saved();
      assert.equal(rt.load('lib/credit-engine/risk/adapters/legal.ts').legalFacts({analysis,asOfDate:today},[])[0].value,null);
    });
    await t.test('redirected/final URL mismatch does not become origin confirmation',async()=>{
      globalThis.fetch=async()=>response(pdf(), 'https://other.test/file.pdf');
      const r=await server.verifyLegalSource(new Uint8Array(pdf()),'9900002906',url);assert.equal(r.eligible,false);assert.equal(r.origin,'UNCONFIRMED');
    });
  } finally {globalThis.fetch=originalFetch;await rt.close();}
});
