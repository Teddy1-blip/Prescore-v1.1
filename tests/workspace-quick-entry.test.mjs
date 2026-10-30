import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=process.env.REPAIR_SOURCE_ROOT??process.cwd();
const route=path.join(root,'app/api/workspace/route.ts');
function loadRoute(user,db){
 const src=fs.readFileSync(route,'utf8');
 const compiled=ts.transpileModule(src,{fileName:route,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};
 function mocked(id){
  if(id.endsWith('/platform/runtime'))return {getRuntime:()=>({DB:db})};
  if(id.endsWith('/api-auth'))return {requireApiUser:async()=>user,unauthorized:()=>Response.json({error:'Unauthorized'},{status:401})};
  if(id.endsWith('/release/security'))return {safeErrorText:()=> 'SAFE_ERROR'};
  return {};
 }
 new Function('exports','require',compiled.outputText)(exports,mocked);
 return exports;
}
function fakeDb(){
 const queries=[];
 const db={prepare(sql){queries.push(sql);return {bind(...xs){queries.push(xs);return this;},async all(){return {results:[{id:'safe1',companyName:'SYNTHETIC',companyInn:'9900002001',periodFrom:'2026-07-01',periodTo:'2026-07-31',createdAt:'2026-10-26'}]}},async run(){throw Error('MUTATION_FORBIDDEN')},async first(){throw Error('UNEXPECTED_FULL_PROJECTION')}};},async batch(){throw Error('UNEXPECTED_SCHEMA_OR_FULL_READ')}};
 return {db,queries};
}
test('owner summary is metadata-only, protected, and does not run schema checks or full analysis',async()=>{
 const {db,queries}=fakeDb();const api=loadRoute({email:'owner@example.test',isAdmin:false},db);
 const response=await api.GET(new Request('http://example.test/api/workspace?projection=summary'));
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.analyses.length,1);assert.equal(data.analyses[0].companyInn,'9900002001');assert.deepEqual(data.deals,[]);
 assert.match(queries[0],/SELECT id, company_name AS companyName/);
 assert.match(queries[0],/owner_email = \?/);
 assert.doesNotMatch(queries[0],/\b(?:payload|CREATE|ALTER|DROP|TRUNCATE|UPDATE)\b/i);
 assert.deepEqual(queries[1],['owner@example.test']);
});
test('summary has no anonymous access',async()=>{
 const {db,queries}=fakeDb();const api=loadRoute(null,db);
 const response=await api.GET(new Request('http://example.test/api/workspace?projection=summary'));
 assert.equal(response.status,401);assert.equal(queries.length,0);
});
test('administrator personal summary is read-only and excludes unassigned history',async()=>{
 const {db,queries}=fakeDb();const api=loadRoute({email:'admin@example.test',isAdmin:true},db);
 const response=await api.GET(new Request('http://example.test/api/workspace?projection=summary'));
 assert.equal(response.status,200);
 assert.doesNotMatch(queries[0],/owner_email = ''/);
 assert.doesNotMatch(queries[0],/UPDATE|payload/i);
});
