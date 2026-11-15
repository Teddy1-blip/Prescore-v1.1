import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {verifiedCreditDocument} from '../lib/workspace/contract-portfolio.ts';
import {manualDebt} from '../lib/workspace/manual-debt.ts';

test('Scheduled principal and interest remain separate and an unknown total remains unknown',()=>{
 const v=value=>({value,page:2,fragment:value});
 const verified=Object.fromEntries(Object.entries({creditor:'Учебный банк',agreement_number:'Т1',agreement_date:'2026-01-01',borrower:'Учебная компания',borrower_inn:'9909000011',currency:'RUB',schedule_date_0:'2026-12-01',schedule_principal_0:'100',schedule_interest_0:'5'}).map(([k,x])=>[k,v(x)]));
 const source={id:'s',kind:'CREDIT_DOCUMENT',documentId:'d',payload:{verified,review:{status:'READY_FOR_REVIEW'},envelope:{companyInn:'9909000011',receivedAt:'2026-01-02T00:00:00Z'}}};
 const facts=verifiedCreditDocument(source,'9909000011').observations;
 assert.equal(facts.find(x=>x.fieldCode.endsWith('.principalDue')).value,100);
 assert.equal(facts.find(x=>x.fieldCode.endsWith('.interestDue')).value,5);
 assert.ok(!facts.some(x=>x.fieldCode.endsWith('.amount')));verified.schedule_total_0=v('105');
 assert.equal(verifiedCreditDocument(source,'9909000011').observations.find(x=>x.fieldCode.endsWith('.amount')).value,105);
});
test('Manual and spreadsheet facts are isolated by owner, tier and source on retry',async()=>{
 const envs=['PRESCORE_STORAGE_ROOT','PRESCORE_RUNTIME_MODE','PRESCORE_OWNER_FULL_PREVIEW','PRESCORE_BASE_URL','PRESCORE_OWNER_PREVIEW_EMAIL_SHA256','CODESPACES','CODESPACE_NAME'];
 const old=Object.fromEntries(envs.map(k=>[k,process.env[k]]));
 const root=await mkdtemp(path.join(tmpdir(),'client-v2-qa-'));
 const rt=await createWorkspaceRuntime();
 Object.assign(process.env,{PRESCORE_STORAGE_ROOT:root,PRESCORE_RUNTIME_MODE:'release-candidate',CODESPACES:'true',CODESPACE_NAME:'qa-space',PRESCORE_BASE_URL:'https://qa-space-4188.app.github.dev',PRESCORE_OWNER_FULL_PREVIEW:'1',PRESCORE_OWNER_PREVIEW_EMAIL_SHA256:createHash('sha256').update(rt.owner.email).digest('hex')});
 const post=(actor,body)=>rt.request('/api/dossier',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},actor);
 try{
  const save=async actor=>(await(await post(actor,{action:'save',inn:'9909000011'})).json()).company.id;
  const own=await save(rt.owner),free=await save(rt.stranger),entry={creditor:'Учебный кредитор',creditorInn:'',contract:'У-1',contractDate:'2025-01-01',asOf:'2025-02-01',principal:1000,product:'TERM_LOAN',basis:'Учебная справка'};
  assert.equal(manualDebt({...entry,principal:-1},'2026-01-01'),null);
  const payload={action:'manual-debt',id:own,entry,confirmed:true};
  assert.equal((await post(rt.stranger,payload)).status,404);assert.equal((await post(rt.stranger,{...payload,id:free})).status,403);
  assert.equal((await post(rt.owner,payload)).status,201);assert.equal((await post(rt.owner,payload)).status,200);
  const read=async()=> (await rt.request('/api/dossier?id='+own,{},rt.owner)).json();
  const portfolio=await read();assert.equal(portfolio.obligations.length,1);assert.equal(portfolio.obligations[0].principal,1000);
  const f=new FormData();f.set('kind','CALENDAR_SHEET');f.set('id',own);f.set('file',new File(['Дата;Сумма;Назначение\n2026-11-20;100;Тест'], 'График.csv'));
  const attached=await rt.request('/api/dossier',{method:'POST',body:f},rt.owner);assert.equal(attached.status,201,await attached.clone().text());
  const id=(await attached.json()).id,confirm={action:'confirm-sheet',id:own,sourceId:id,mapping:{header:0,date:0,amount:1,purpose:2,direction:'OUT'},rows:[1]};
  assert.equal((await post(rt.owner,confirm)).status,200);assert.equal((await post(rt.owner,confirm)).status,200);assert.equal((await read()).calendar.length,1);
  assert.equal((await post(rt.owner,{...confirm,mapping:{...confirm.mapping,direction:'IN'}})).status,409);
 }finally{await rt.close();await rm(root,{force:true,recursive:true});for(const k of envs){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
