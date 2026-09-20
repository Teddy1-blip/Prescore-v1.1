import test from 'node:test';import assert from'node:assert/strict';import fs from'node:fs';import ts from'typescript';import{PGlite}from'@electric-sql/pglite';
import{PortableDatabase}from'../lib/db/compatibility.ts';
function load(path,imports){const exports={};const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,name=>{if(name in imports)return imports[name];throw Error('UNEXPECTED_IMPORT:'+name);});return exports;}
test('actual SQL authorization: owner, assigned agent, unrelated client, admin, document relationships',async()=>{
 const pg=new PGlite();const catalog=JSON.parse(fs.readFileSync(new URL('../lib/db/catalog.json',import.meta.url)));
 const query=async(s,v)=>{const r=await pg.query(s,v);return{rows:r.rows,rowCount:r.affectedRows};};const db=new PortableDatabase({query,connect:async()=>({query,release(){}})},catalog);
 try{
  for(const f of ['0001_product.sql','0003_runtime_indexes.sql'])await pg.exec(fs.readFileSync(new URL('../lib/db/migrations/'+f,import.meta.url),'utf8'));
  await query(`INSERT INTO analyses(id,company_name,company_inn,file_name,period_from,period_to,score,grade,readiness,payload,owner_email) VALUES('a','Synthetic','7700000000','synthetic','2026-01-01','2026-01-31',1,'A','test','{}','owner@test.invalid')`);
  await query(`INSERT INTO agent_accounts(user_email,agent_code,name) VALUES('agent@test.invalid','agent','Synthetic')`);
  await query(`INSERT INTO agent_leads(id,agent_code,company_name,company_inn,consent_at) VALUES('l','agent','Synthetic','7700000000','2026-01-01')`);
  let current={email:'owner@test.invalid',isAdmin:false};
  const api=load('../app/api/api-auth.ts',{'../chatgpt-auth':{getChatGPTUser:async()=>null}});
  assert.equal((await api.readableAnalysis(db,'a',current)).access,'owner');
  assert.equal((await api.readableAnalysis(db,'a',{email:'agent@test.invalid',isAdmin:false})).access,'agent');
  assert.equal(await api.readableAnalysis(db,'a',{email:'stranger@test.invalid',isAdmin:false}),null);
  assert.equal((await api.readableAnalysis(db,'a',{email:'admin@test.invalid',isAdmin:true})).access,'admin');
  let stored=0;const storage={put:async()=>{stored++;return{key:'synthetic-key'};},get:async()=>new TextEncoder().encode('hello'),delete:async()=>{stored--;}};
  const route=load('../app/api/documents/route.ts',{'../../../lib/platform/runtime':{getRuntime:()=>({DB:db})},'../../../lib/storage/documents':{documentStorage:()=>storage},'../api-auth':{requireApiUser:async()=>current,unauthorized:api.unauthorized}});
  const body={companyInn:'7700000000',analysisId:'a',fileName:'test.txt',mimeType:'text/plain',sizeBytes:5,contentBase64:Buffer.from('hello').toString('base64')};
  const upload=b=>route.POST(new Request('https://prescore.test/api/documents',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}));
  assert.equal((await upload({...body,companyInn:'7711111111'})).status,403);assert.equal(stored,0);
  assert.equal((await upload({...body,applicationId:'unrelated'})).status,403);assert.equal(stored,0);
  const created=await upload(body);assert.equal(created.status,201);const id=(await created.json()).document.id;
  const download=()=>route.GET(new Request('https://prescore.test/api/documents?download='+id));
  assert.equal((await download()).status,200);current={email:'stranger@test.invalid',isAdmin:false};assert.equal((await download()).status,404);
  current={email:'agent@test.invalid',isAdmin:false};assert.equal((await download()).status,200);
  current={email:'admin@test.invalid',isAdmin:true};assert.equal((await download()).headers.get('x-content-type-options'),'nosniff');
  current=null;assert.equal((await download()).status,401);
 }finally{await pg.close();}
});
