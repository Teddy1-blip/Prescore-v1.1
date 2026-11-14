import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {financialFile,corporateBkiFile} from './fixtures/polish-sources.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {corporation,checkoDouble} from './fixtures/stage4-external.mjs';

test('Private company dossier, independent inputs and canonical combined analysis',async t=>{
 const old=process.env.PRESCORE_STORAGE_ROOT,root=await mkdtemp(path.join(tmpdir(),'prescore-source-test-'));
 process.env.PRESCORE_STORAGE_ROOT=root;
 const provider=checkoDouble(),rt=await createWorkspaceRuntime({checkoFetch:provider.fetcher});
 const inn=corporation;
 async function post(body,user){
   return rt.request('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},user);
 }
 async function attach(id,kind,file,user){
   const form=new FormData();form.set('id',id);form.set('kind',kind);form.set('file',file);
   return rt.request('/api/dossier',{method:'POST',body:form},user);
 }
 async function read(id,user){const r=await rt.request('/api/dossier?id='+id,{},user);assert.equal(r.status,200);return r.json();}
 async function save(user){const r=await post({action:'save',inn},user);assert.equal(r.status,200);return (await r.json()).company.id;}
 const bank=async(dossierId,user)=>rt.request('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dossierId,statements:[{fileName:'bank.txt',text:statementFixture({inn})}]})},user);
 const actor=n=>({roles:['CLIENT'],email:'source'+n+'@workspace.test'});
 try{
  let id,publicOwner=actor(1);
  await t.test('authenticated INN-only preview does not create a private record',async()=>{
    const r=await post({action:'preview',inn},publicOwner);assert.equal(r.status,200);const result=await r.json();
    assert.equal(result.profile.inn,inn);assert.ok(result.profile.company.name);assert.equal(result.profile.finances,undefined);
    assert.deepEqual((await (await rt.request('/api/dossier',{},publicOwner)).json()).companies,[]);
    id=(await (await post({action:'save',inn,attachPublic:true},publicOwner)).json()).company.id;
    assert.equal((await read(id,publicOwner)).publicProfile.inn,inn);
  });
  await t.test('BFO-only supports two periods and authentic originals without bank rows',async()=>{
    const user=actor(2),id=await save(user);
    for(const year of [2024,2025]){
      const file=financialFile(inn,'csv',{period:year+' год'});const r=await attach(id,'BFO',file,user);assert.equal(r.status,201,await r.clone().text());
      assert.equal((await attach(id,'BFO',file,user)).status,200);
    }
    const d=await read(id,user);assert.equal(d.versions.length,0);assert.equal(d.sources.length,2);assert.equal(d.financial.history.length,2);assert.equal(d.entitlement,'BASIC');
    assert.equal(d.financial.history[0].groups[0].metrics.find(m=>m.key==='REVENUE').value,1200000);
    const url='/api/documents?download='+d.sources[0].documentId;
    assert.equal((await rt.request(url,{},publicOwner)).status,404);
    const bytes=await (await rt.request(url,{},user)).text();assert.match(bytes,/2024/);
    assert.equal((await attach(id,'BFO',financialFile('500100732259'),user)).status,400);
  });
  await t.test('BANK-only keeps version identity and uses existing cash analysis',async()=>{
    const user=actor(3),r=await bank(undefined,user);assert.equal(r.status,200,await r.clone().text());
    const a=(await r.json()).analysis,d=await read(await save(user),user);
    assert.equal(d.versions[0].id,a.id);assert.ok(d.sources.some(s=>s.kind==='BANK_STATEMENT'));
  });
  await t.test('BKI-only resolves contractual debt through BLK-06.5 without capacity',async()=>{
    const user=actor(4),id=await save(user),r=await attach(id,'BKI',corporateBkiFile(inn),user);assert.equal(r.status,201,await r.clone().text());
    const d=await read(id,user);assert.equal(d.obligations.length,1);assert.equal(d.obligations[0].principal,120000);assert.equal(d.capacity,undefined);assert.equal(d.versions.length,0);
  });
  const ledger=new File(['ИНН организации;Дата остатка;Счёт;Контрагент;Договор;Дебет, руб.;Кредит, руб.\n'+inn+';2025-12-31;62.01;Покупатель;Д-1;1800;'],'balances.csv');
  await t.test('OSV-only preserves missing credit balance and tenant boundaries',async()=>{
    const user=actor(5),id=await save(user);const r=await attach(id,'COUNTERPARTIES',ledger,user);assert.equal(r.status,201);
    const d=await read(id,user);assert.equal(d.ledger[0].debit,1800);assert.equal(d.ledger[0].credit,null);assert.equal(d.versions.length,0);
    assert.equal((await rt.request('/api/dossier?id='+id,{},publicOwner)).status,404);
    assert.equal((await attach(id,'COUNTERPARTIES',ledger,publicOwner)).status,404);
  });
  await t.test('combine in a single owner dossier, reload and keep historical report sources',async()=>{
    for(const [kind,file] of [['BFO',financialFile(inn)],['BKI',corporateBkiFile(inn)],['COUNTERPARTIES',ledger]]){
      const r=await attach(id,kind,file,publicOwner);assert.equal(r.status,201,await r.clone().text());
    }
    const r=await bank(id,publicOwner);assert.equal(r.status,200,await r.clone().text());const analysis=(await r.json()).analysis;
    const d=await read(id,publicOwner);assert.equal(d.versions[0].id,analysis.id);assert.equal(d.obligations.length,1);assert.equal(d.ledger.length,1);
    assert.deepEqual(new Set(d.sources.map(s=>s.kind)),new Set(['CHECKO','BANK_STATEMENT','BFO','BKI','COUNTERPARTIES']));
    const saved=JSON.parse((await rt.pg.query('SELECT payload FROM analyses WHERE id=$1',[analysis.id])).rows[0].payload);
    assert.ok(saved.financialAnalysisV2.history.length);assert.equal(saved.creditPortfolioV1.obligations.length,1);
    assert.equal((await save(publicOwner)),id);
  });
 }finally{await rt.close();if(old===undefined)delete process.env.PRESCORE_STORAGE_ROOT;else process.env.PRESCORE_STORAGE_ROOT=old;await rm(root,{recursive:true,force:true});}
});
