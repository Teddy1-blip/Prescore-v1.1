import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import ts from 'typescript';
import React from 'react';
import {PGlite} from '@electric-sql/pglite';
import {PortableDatabase} from '../../lib/db/compatibility.ts';
const require=createRequire(import.meta.url);
export async function createWorkspaceRuntime(){
 const pg=new PGlite(),scope=new AsyncLocalStorage(),cache=new Map();
 // UTC timestamps/date filters must not inherit PGlite's packaged timezone.
 await pg.exec("SET TIME ZONE 'UTC'");
 const query=async(sql,values)=>{const r=await pg.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows};};
 let transactionTail=Promise.resolve();
 const pool={query,connect:async()=>{let unlock;const turn=new Promise(resolve=>{unlock=resolve;});const previous=transactionTail;transactionTail=turn;await previous;let released=false;return{query,release(){if(released)return;released=true;unlock();}};}};
 const db=new PortableDatabase(pool,JSON.parse(fs.readFileSync('lib/db/catalog.json','utf8')));
 for(const m of ['0001_product.sql','0002_platform_auth.sql','0003_runtime_indexes.sql','0004_admin_observations.sql','0005_admin_cache_invalidation.sql','0006_billing_v1.sql','0007_rc1_operations.sql','0008_rc1_lookup_indexes.sql','0009_analysis_archive.sql'])await pg.exec(fs.readFileSync('lib/db/migrations/'+m,'utf8'));
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('exports','require',code)(exports,name=>{
 if(name.endsWith('.css'))return {};
 if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
 if(name==='next/navigation')return {};
 if(!name.startsWith('.'))return require(name);
 const base=path.resolve(path.dirname(file),name),target=[base,base+'.ts',base+'.tsx',base+'.json',path.join(base,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 if(!target)throw Error('MISSING_MODULE:'+name);
 if(target.endsWith('/lib/platform/runtime.ts'))return {getRuntime:()=>({DB:db})};
 if(target.endsWith('/app/chatgpt-auth.ts'))return {getChatGPTUser:async()=>scope.getStore()??null};
 if(target.endsWith('.json'))return JSON.parse(fs.readFileSync(target,'utf8'));
 return load(target);
 });return exports;
 }
 const owner={email:'owner@workspace.test',roles:['CLIENT']},broker={email:'broker@workspace.test',roles:['AGENT']},admin={email:'admin@workspace.test',displayName:'QA Admin',roles:['CLIENT','ADMIN']},stranger={email:'other@workspace.test',roles:['CLIENT']};
 async function request(url,init={},user=owner){const route=path.resolve('app'+new URL(url,'http://workspace.test').pathname+'/route.ts');if(!fs.existsSync(route))return Response.json({error:'Route missing'},{status:404});return scope.run(user,()=>load(route)[init.method??'GET'](new Request(new URL(url,'http://workspace.test'),init)));}
 async function assign(analysis){await db.prepare('INSERT INTO agent_accounts (user_email,agent_code,name) VALUES (?,?,?) ON CONFLICT(user_email) DO NOTHING').bind(broker.email,'qa-broker','Алексей · брокер').run();await db.prepare('INSERT INTO agent_leads (id,agent_code,company_name,company_inn,email,contact_name,phone,consent_at,status) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('lead-'+analysis.id,'qa-broker',analysis.companyName,analysis.companyInn,owner.email,'Анна','+7 900 000-00-00','2026-09-25','Анализ готов').run();}
 async function full(id){const access=await db.prepare('SELECT company_inn AS inn FROM analyses WHERE id = ?').bind(id).first();await load('lib/entitlements.ts').grantFullEntitlement(db,{analysisId:id,userEmail:owner.email,companyInn:access.inn,grantedBy:'TEST_ONLY'});}
 return {pg,db,load,request,assign,full,owner,broker,admin,stranger,close:()=>pg.close()};
}
