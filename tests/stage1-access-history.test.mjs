import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {historyPurpose,withHistoryPurpose} from '../lib/workspace/history.ts';
const qa=['36527dc1-d7db-4fef-bd47-719a451b4d58','992ab9e3-672e-4adf-955e-9a2c40e3ece3','7ec7daeb-dfef-4f1f-9c9d-15ea86fe864c'];
function staging(){const previous={...process.env};process.env.PRESCORE_RUNTIME_MODE='release-candidate';process.env.PRESCORE_BASE_URL='https://prescore-staging-dorogovab.msk1.amvera.tech';return()=>{process.env=previous;};}
function load(file,imports){const exp={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('exports','require',code)(exp,id=>{if(id in imports)return imports[id];if(id.endsWith('.css'))return {};throw Error('UNEXPECTED_IMPORT:'+id);});return exp;}
test('explicit QA metadata is reversible, staging-only and never inferred from company names',()=>{
 const restore=staging();try{
  for(const id of qa)assert.equal(historyPurpose(id),'QA');
  assert.equal(historyPurpose('new-work'),'WORK');
  const a={id:'new-work',companyName:'QA реальная компания',payload:{unknown:null}};
  const original=JSON.stringify(a);assert.equal(withHistoryPurpose(a).historyPurpose,'WORK');assert.equal(JSON.stringify(a),original);
  process.env.PRESCORE_RUNTIME_MODE='production';for(const id of qa)assert.equal(historyPurpose(id),'WORK');
  process.env.PRESCORE_RUNTIME_MODE='release-candidate';process.env.PRESCORE_BASE_URL='https://other.invalid';assert.equal(historyPurpose(qa[0]),'WORK');
 }finally{restore();}
});
test('actual owner summary labels only permitted QA; leaves all payloads, owners, archive states untouched',async()=>{
 const restore=staging(),rt=await createWorkspaceRuntime();try{
  for(const [id,owner,name]of [[qa[0],rt.owner.email,'Control'],[qa[1],rt.stranger.email,'Foreign control'],[qa[2],rt.owner.email,'Second control'],['new-work',rt.owner.email,'QA в названии рабочей компании'],['archived-work',rt.owner.email,'Archived']]){
   await rt.pg.query('INSERT INTO analyses(id,company_name,company_inn,file_name,period_from,period_to,score,grade,readiness,payload,owner_email) VALUES($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10)',[id,name,'9900000001','synthetic.txt','2026-01-01','2026-06-30','UNKNOWN','PARTIAL','{"unknown":null}',owner]);
  }
  await rt.pg.query("UPDATE analyses SET archive_state='LEGACY_PREPRODUCTION' WHERE id='archived-work'");
  const before=(await rt.pg.query('SELECT * FROM analyses ORDER BY id')).rows;
  for(let reload=0;reload<2;reload++){
   const response=await rt.request('/api/workspace?projection=summary');assert.equal(response.status,200);
   const data=await response.json();assert.deepEqual(new Set(data.analyses.map(a=>a.id)),new Set([qa[0],qa[2],'new-work']));
   assert.deepEqual(data.analyses.filter(a=>a.historyPurpose==='QA').map(a=>a.id).sort(),[qa[0],qa[2]].sort());
   assert.equal(data.analyses.find(a=>a.id==='new-work').historyPurpose,'WORK');
  }
  assert.equal((await rt.request('/api/workspace?projection=summary',{},null)).status,401);
  assert.deepEqual((await(await rt.request('/api/workspace?projection=summary',{},rt.admin)).json()).analyses,[]);
  assert.equal((await rt.request('/api/workspace?client='+qa[1])).status,404);
  assert.equal((await rt.request('/api/workspace-model?analysisId=archived-work')).status,404);
  assert.deepEqual((await rt.pg.query('SELECT * FROM analyses ORDER BY id')).rows,before);
 }finally{await rt.close();restore();}
});
test('control page checks ADMIN on server and the old route is unavailable for every role',async()=>{
 let user={roles:['CLIENT']};const navigation={redirect:url=>{throw Error('REDIRECT:'+url);},notFound:()=>{throw Error('NOT_FOUND');}};
 const control=load('app/prescore-control/page.tsx',{'next/navigation':navigation,'../chatgpt-auth':{requireChatGPTUser:async path=>{assert.equal(path,'/prescore-control');if(!user)throw Error('LOGIN_REQUIRED');return user;}},'../admin/admin-dashboard':{default:()=>null},'react/jsx-runtime':{jsx:(type,props)=>({type,props})}});
 for(const roles of [['CLIENT'],['AGENT']]){user={roles};await assert.rejects(control.default(),/REDIRECT:\/dashboard/);}
 user=null;await assert.rejects(control.default(),/LOGIN_REQUIRED/);
 user={roles:['CLIENT','ADMIN']};assert.ok((await control.default()).type);
 const old=load('app/admin/page.tsx',{'next/navigation':navigation});await assert.rejects(old.default(),/NOT_FOUND/);
 for(const file of ['app/login/page.tsx','app/components/landing-v3/landing.tsx'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/href=["']\/(?:admin|prescore-control)/);
});
test('shared shell exposes only released navigation and no admin link in client or broker navigation',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const {ClientShell,CLIENT_NAV,BROKER_NAV}=rt.load('app/components/workspace/client-shell.tsx');
  for(const broker of [false,true]){
   const html=renderToStaticMarkup(React.createElement(ClientShell,{view:'home',choose(){},broker,availableViews:(broker?BROKER_NAV:CLIENT_NAV).map(x=>x.id),context:'Synthetic'},'Test'));
   assert.doesNotMatch(html,/href="\/(?:admin|prescore-control)"/);
   assert.match(html,/href="\/logout">Сменить аккаунт/);
   if(!broker){
    assert.match(html,/Кредитный профиль/);assert.match(html,/Финансы/);
    for(const future of ['Мониторинг','Контрагенты','Контракты']){
     assert.match(html,new RegExp(`disabled=""[^>]*data-later="true"[\\s\\S]*?<span>${future}<\\/span>`));
    }
   }
  }
 }finally{await rt.close();}
});
test('login return preserves selected dossier and section, rejects other cabinet or external paths',async()=>{
 let returnPath='/dashboard?analysisId=allowed&view=documents';
 const auth=load('app/chatgpt-auth.ts',{'next/headers':{headers:async()=>new Headers({'x-prescore-return-to':returnPath})},'next/navigation':{redirect:path=>{throw Error(path);}},'../lib/auth/server':{getAuthSession:async()=>null},'../lib/auth/contracts':await import('../lib/auth/contracts.ts')});
 await assert.rejects(auth.requireChatGPTUser('/dashboard'),error=>error.message==='/login?returnTo=%2Fdashboard%3FanalysisId%3Dallowed%26view%3Ddocuments');
 for(const bad of ['https://evil.invalid','//evil.invalid','/agent?analysisId=private']){returnPath=bad;await assert.rejects(auth.requireChatGPTUser('/dashboard'),error=>error.message==='/login?returnTo=%2Fdashboard');}
 assert.match(fs.readFileSync('proxy.ts','utf8'),/headers.set\('x-prescore-return-to',path\+request.nextUrl.search\)/);
});
