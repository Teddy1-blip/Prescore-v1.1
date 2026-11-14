import * as dossier from '../lib/workspace/dossier.ts';
import * as dossierSources from '../lib/workspace/dossier-sources.ts';
import * as dossierBank from '../lib/workspace/dossier-bank.ts';
import * as checkoCache from '../lib/external/checko-cache.ts';
import * as brokerAuthorization from '../lib/auth/broker-authorizations.ts';
import * as releaseSecurity from '../lib/release/security.ts';
/** Real upload handler + PostgreSQL-compatible disposable DB + protected report service.
 * Only the authentication boundary is a controlled synthetic principal. No runtime DB,
 * production auth changes, actual browser sign-in, PDF extraction or live providers.
 */
import {postLoopbackJson} from './fixtures/loopback-json.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import http from 'node:http';
import {PGlite} from '@electric-sql/pglite';import {PortableDatabase} from '../lib/db/compatibility.ts';
import * as prescore from '../lib/prescore.ts';import * as sources from '../lib/credit-engine/source-foundation.ts';import * as controls from '../lib/admin-controls.ts';import * as entitlements from '../lib/entitlements.ts';
import {loadCanonicalReport} from '../lib/credit-engine/production/report-service.ts';import {businessCatalog,loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
function load(file,imports){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,n=>{if(n.endsWith('/lib/auth/broker-authorizations'))return brokerAuthorization;if(n in imports)return imports[n];throw Error('UNEXPECTED_IMPORT:'+n);});return exports;}
test('Credit Lab isolated HTTP upload → SQL persistence → ownership/FULL → canonical report, all 24 sources',async t=>{
 const pg=new PGlite();const catalog=JSON.parse(fs.readFileSync('lib/db/catalog.json'));
 const query=async(s,v)=>{const r=await pg.query(s,v);return{rows:r.rows,rowCount:r.affectedRows};};const db=new PortableDatabase({query,connect:async()=>({query,release(){}})},catalog);
 let current={email:'lab-owner@test.invalid',isAdmin:false};const api=load('app/api/api-auth.ts',{'../chatgpt-auth':{getChatGPTUser:async()=>null}});
 const route=load('app/api/analysis/route.ts',{
    '../../../lib/workspace/dossier':dossier,'../../../lib/workspace/dossier-sources':dossierSources,'../../../lib/workspace/dossier-bank':dossierBank,
'../../../lib/external/checko-cache':checkoCache,'../../../lib/platform/runtime':{getRuntime:()=>({DB:db})},'../../../lib/prescore':prescore,'../../../lib/credit-engine/source-foundation':sources,'../../../lib/admin-controls':controls,'../api-auth':{requireApiUser:async()=>current,unauthorized:api.unauthorized},'../../../lib/entitlements':entitlements,'../../../lib/release/security':releaseSecurity});
 const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await route.POST(new Request('http://127.0.0.1/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:Buffer.concat(chunks)}));res.writeHead(response.status,{'content-type':'application/json'});res.end(await response.text());}catch{res.writeHead(500);res.end('Isolated harness failure');}});
 try{
  for(const f of ['0001_product.sql','0003_runtime_indexes.sql','0009_analysis_archive.sql','0011_company_dossiers.sql','0012_dossier_reports.sql'])await pg.exec(fs.readFileSync('lib/db/migrations/'+f,'utf8'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/api/analysis`;
  const upload=(statements,label)=>postLoopbackJson(url,{statements},label);
  current=null;assert.equal((await upload([],'PRECHECK_UNAUTHORIZED')).status,401);current={email:'lab-owner@test.invalid',isAdmin:false};assert.equal((await upload([],'PRECHECK_EMPTY')).status,400);
  for(const c of businessCatalog())await t.test(c.caseId,async()=>{
   const b=loadBusiness(c.caseId);const response=await upload(b.statements,c.caseId);const body=response.body;assert.equal(response.status,200,JSON.stringify(body));
   const id=body.analysis.id;assert.ok(id);const access=await api.readableAnalysis(db,id,current);assert.ok(access);const saved=JSON.parse(access.row.payload);
   assert.deepEqual(saved.metricsV2,b.full.metricsV2);assert.equal(saved.companyInn,c.companyInn);assert.ok(saved.transactions.length<=10000);
   if(c.caseId==='CL-RU-BUS-024'){assert.equal(saved.transactionsTruncated,true);assert.equal(saved.transactions.length,10000);}
   const deps={readAccess:async id=>api.readableAnalysis(db,id,current),readTier:(id,a)=>entitlements.resolveAnalysisTier(db,{analysisId:id,userEmail:a.row.ownerEmail,companyInn:a.row.companyInn,readOnly:true}),readProfile:async()=>undefined};
   assert.equal((await loadCanonicalReport(id,deps)).status,'LOCKED');
   current={email:'unrelated@test.invalid',isAdmin:false};assert.equal((await loadCanonicalReport(id,deps)).status,'NOT_FOUND');current={email:'lab-owner@test.invalid',isAdmin:false};
   // Test-only fixture entitlement, only in this in-memory DB. Never calls deployed routes.
   await entitlements.grantFullEntitlement(db,{analysisId:id,userEmail:current.email,companyInn:c.companyInn,grantedBy:'SYNTHETIC_TEST'});
   // Attach documented BFO/BKI parser/provider-boundary inputs, not computed metrics.
   // Receipt timestamps are deterministic fixture metadata, not an economic override.
   saved.sourceManifest=b.input.analysis.sourceManifest;saved.createdAt=b.input.analysis.createdAt;
   if(b.input.analysis.financialStatementsV2)saved.financialStatementsV2=b.input.analysis.financialStatementsV2;
   if(b.input.analysis.creditHistory)saved.creditHistory=b.input.analysis.creditHistory;
   await db.prepare('UPDATE analyses SET payload = ? WHERE id = ?').bind(JSON.stringify(saved),id).run();
   const before=await api.readableAnalysis(db,id,current);const report=await loadCanonicalReport(id,{...deps,readProfile:async()=>b.input.companyProfile});assert.equal(report.status,'READY');assert.equal(report.model.company.inn,c.companyInn);assert.deepEqual(await api.readableAnalysis(db,id,current),before);
  });
 }finally{await new Promise(resolve=>server.close(resolve));await pg.close();}
});
