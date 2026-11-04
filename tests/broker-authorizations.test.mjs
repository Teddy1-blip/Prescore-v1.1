import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {checkout,notification} from '../lib/billing/payments.ts';
import {FakePaymentProvider} from '../lib/billing/providers.ts';
import {confirmCommercial} from '../lib/billing/settlements.ts';
const json=body=>({method:'POST',headers:{'content-type':'application/json',origin:'https://prescore.test'},body:JSON.stringify(body)});
const seed=async(rt,user=rt.owner)=>(await(await rt.request('/api/analysis',json({statements:[{text:statementFixture(),fileName:'isolated.txt'}]}),user)).json()).analysis;
test('owner-scoped grants reject forged contact authority, survive reload, and revoke all server consumers in the old session',async t=>{
 const previous=process.env.PRESCORE_BASE_URL;process.env.PRESCORE_BASE_URL='https://prescore.test';
 const rt=await createWorkspaceRuntime();try{
  const a=await seed(rt),other=await seed(rt,rt.stranger);assert.equal(a.companyInn,other.companyInn);
  await rt.db.prepare("INSERT INTO agent_accounts(user_email,agent_code,name) VALUES(?,'QA-BROKER','Synthetic broker')").bind(rt.broker.email).run();
  const foreignDoc='foreign-'+randomUUID();await rt.pg.query(`INSERT INTO client_documents(id,company_inn,analysis_id,category,file_name,size_bytes,content_base64,owner_email) VALUES($1,$2,$3,'OTHER','private.txt',6,'c2VjcmV0',$4)`,[foreignDoc,a.companyInn,a.id,rt.owner.email]);
  const otherDoc='other-'+randomUUID();await rt.pg.query(`INSERT INTO client_documents(id,company_inn,analysis_id,category,file_name,size_bytes,content_base64,owner_email) VALUES($1,$2,$3,'OTHER','other.txt',6,'c2VjcmV0',$4)`,[otherDoc,a.companyInn,other.id,rt.stranger.email]);
  const snapshot=(await rt.pg.query('SELECT id,payload,owner_email FROM analyses ORDER BY id')).rows;
  const deny=async()=>{
   for(const url of ['/api/workspace-model?analysisId='+a.id,'/api/workspace?client='+a.id,'/api/documents?download='+foreignDoc,'/api/ai-analyst?analysisId='+a.id])assert.equal((await rt.request(url,{},rt.broker)).status,404,url);
   assert.equal((await rt.request('/api/ai-analyst',json({analysisId:a.id,question:'Что в досье?'}),rt.broker)).status,404);
   assert.deepEqual((await(await rt.request('/api/documents?inn='+a.companyInn,{},rt.broker)).json()).documents,[]);
   const listing=await(await rt.request('/api/agent',{},rt.broker)).json();assert.ok(listing.leads.every(l=>!l.analysisId&&Number(l.paidFullOrders)===0));assert.deepEqual(listing.applications,[]);
   const report=rt.load('app/report/[id]/page.tsx');await assert.rejects(rt.asUser(rt.broker,()=>report.default({params:Promise.resolve({id:a.id})})),/NOT_FOUND/);
  };
  await t.test('broker, public source/consent and email/INN cannot act as the owner',async()=>{
   assert.equal((await rt.authorize(a,{ownerEmail:rt.owner.email,brokerEmail:rt.broker.email},rt.broker)).status,404);
   for(const actor of [rt.broker,null]){const response=await rt.request('/api/agent',json({type:'lead',agentCode:'QA-BROKER',companyInn:a.companyInn,companyName:'Spoofed',contactName:'Synthetic contact',email:rt.owner.email,source:'Реферальная ссылка',consent:true,ownerUserId:'forged',confirmed:true}),actor);assert.equal(response.status,201,await response.text());}
   await deny();
   assert.equal((await rt.request('/api/workspace',json({type:'broker-authorization',operation:'grant',analysisId:a.id,brokerEmail:rt.broker.email,purpose:'DOSSIER',confirmed:true,days:30,requestId:randomUUID()}),rt.admin)).status,404,'ADMIN does not impersonate the dossier owner');
   const forged=await rt.request('/api/workspace',{...json({type:'broker-authorization',operation:'grant',analysisId:a.id,brokerEmail:rt.broker.email,purpose:'DOSSIER',confirmed:true,days:30,requestId:randomUUID()}),headers:{'content-type':'application/json',origin:'https://attacker.invalid'}},rt.owner);assert.equal(forged.status,403);
  });
  const grantResponse=await rt.authorize(a);assert.equal(grantResponse.status,201);const grant=(await grantResponse.json()).id;
  await t.test('actual owner grant exposes only the precise analysis, not another owner with the same INN',async()=>{
   for(let reload=0;reload<2;reload++)assert.equal((await rt.request('/api/workspace-model?analysisId='+a.id,{},rt.broker)).status,200);
   assert.equal((await rt.request('/api/workspace-model?analysisId='+other.id,{},rt.broker)).status,404);
   assert.equal((await rt.request('/api/documents?download='+foreignDoc,{},rt.broker)).status,200);assert.equal((await rt.request('/api/documents?download='+otherDoc,{},rt.broker)).status,404);
   assert.deepEqual((await(await rt.request('/api/documents?inn='+a.companyInn,{},rt.broker)).json()).documents.map(d=>d.id),[foreignDoc]);
   const grants=(await(await rt.request('/api/workspace?projection=broker-authorizations&analysisId='+a.id)).json()).grants;assert.equal(grants.length,1);assert.equal(grants[0].id,grant);
   assert.equal((await rt.authorize(a,{operation:'revoke',grantId:grant},rt.broker)).status,404);
  });
  const app=await rt.request('/api/workspace',json({type:'applications',analysisId:a.id,companyName:a.companyName,companyInn:a.companyInn,consentAt:new Date().toISOString(),applications:[{bank:'Isolated',product:'Оборотный кредит',amount:10}]}));assert.equal(app.status,201);const appId=(await app.json()).deals[0].id;
  assert.equal((await rt.request('/api/communications',json({applicationId:appId,message:'Synthetic private message'}))).status,201);
  assert.equal((await rt.request('/api/communications?applicationId='+appId,{},rt.broker)).status,200);
  await t.test('revocation denies reload, old URLs, chat, app writes and dossier sources without changing payloads',async()=>{
   assert.equal((await rt.authorize(a,{operation:'revoke',grantId:grant})).status,200);await deny();
   assert.equal((await rt.request('/api/communications?applicationId='+appId,{},rt.broker)).status,403);
   assert.equal((await rt.request('/api/communications',json({applicationId:appId,message:'stale'}),rt.broker)).status,403);
   assert.equal((await rt.request('/api/agent',{...json({entity:'application',id:appId,status:'Одобрена'}),method:'PATCH'},rt.broker)).status,404);
   assert.equal((await rt.request('/api/documents',json({applicationId:appId,companyInn:a.companyInn,fileName:'stale.txt',sizeBytes:1,contentBase64:'eA=='}),rt.broker)).status,403);
   assert.deepEqual((await rt.pg.query('SELECT id,payload,owner_email FROM analyses ORDER BY id')).rows,snapshot);
  });
  await t.test('client applications never choose an unconfirmed CRM broker',async()=>{
   const noGrant=await rt.request('/api/workspace',json({type:'applications',analysisId:a.id,companyName:a.companyName,companyInn:a.companyInn,consentAt:new Date().toISOString(),applications:[{bank:'Other isolated',product:'Кредит',amount:12}]}));assert.equal(noGrant.status,201);const id=(await noGrant.json()).deals[0].id;assert.equal((await rt.pg.query('SELECT id FROM agent_applications WHERE id=$1',[id])).rows.length,0);
  });
 }finally{await rt.close();if(previous===undefined)delete process.env.PRESCORE_BASE_URL;else process.env.PRESCORE_BASE_URL=previous;}
});
test('CRM and dossier access cannot capture attribution; explicit referral is separate, conflict-safe and historical orders stay immutable',async()=>{
 const rt=await createWorkspaceRuntime(),provider=new FakePaymentProvider();process.env.BILLING_OFFER_VERSION='o';process.env.BILLING_PRIVACY_VERSION='p';
 try{const a=await seed(rt);await rt.assign(a);
  const buy=key=>checkout(rt.db,rt.owner.email,{analysisId:a.id,idempotencyKey:key,offerAccepted:true,privacyAccepted:true,offerVersion:'o',privacyVersion:'p'},provider);
  const pay=o=>notification(rt.db,provider,provider.notification('fake-'+o.id),confirmCommercial);
  const direct=await buy('unconfirmed-contact');await pay(direct);let row=(await rt.pg.query('SELECT * FROM billing_orders WHERE id=$1',[direct.id])).rows[0];assert.equal(row.broker_code,null);assert.equal(row.curator_code,null);
  const grant=await rt.authorize(a,{purpose:'REFERRAL'});assert.equal(grant.status,201);const grantId=(await grant.json()).id;
  const order=await buy('confirmed-referral');await pay(order);row=(await rt.pg.query('SELECT * FROM billing_orders WHERE id=$1',[order.id])).rows[0];assert.equal(row.broker_code,'qa-broker');assert.equal(row.curator_code,null);assert.equal(row.amount_minor,650000);
  const history=async()=>({orders:(await rt.pg.query('SELECT * FROM billing_orders ORDER BY id')).rows,commissions:(await rt.pg.query('SELECT * FROM billing_commissions ORDER BY id')).rows,ledger:(await rt.pg.query('SELECT * FROM billing_ledger ORDER BY id')).rows});const before=await history();
  assert.equal((await rt.authorize(a,{operation:'revoke',grantId})).status,200);assert.deepEqual(await history(),before);assert.equal((await buy('confirmed-referral')).id,order.id);assert.deepEqual(await history(),before);
  // New ambiguity follows the existing explicit conflict policy; no arbitrary broker.
  await rt.authorize(a,{purpose:'REFERRAL'});await rt.pg.query('INSERT INTO "user"(id,email,name,"emailVerified") VALUES($1,$2,$2,true)',['second-broker','second@workspace.test']);await rt.pg.query("INSERT INTO agent_accounts(user_email,agent_code,name) VALUES('second@workspace.test','second-broker','Second')");assert.equal((await rt.authorize(a,{purpose:'REFERRAL',brokerEmail:'second@workspace.test'})).status,201);await assert.rejects(buy('ambiguous-referral'),/ATTRIBUTION_NEEDS_REVIEW/);assert.deepEqual(await history(),before);
 }finally{await rt.close();}
});
