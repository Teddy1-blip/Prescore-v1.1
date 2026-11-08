import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import {loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
import {scenario} from './fixtures/stage5-decision.mjs';
import {statementFixture} from './fixtures/block1-statements.mjs';

test('agent route projections preserve authorization and expose only actual facts',async t=>{
  const old=process.env.PRESCORE_STORAGE_ROOT,root=fs.mkdtempSync(path.join(os.tmpdir(),'agent-scope-'));process.env.PRESCORE_STORAGE_ROOT=root;
  t.after(()=>{if(old===undefined)delete process.env.PRESCORE_STORAGE_ROOT;else process.env.PRESCORE_STORAGE_ROOT=old;fs.rmSync(root,{recursive:true,force:true});});
  const rt=await createWorkspaceRuntime();
  const read=async(surface,params={},user=rt.broker)=>{
    const response=await rt.request('/api/agent?'+new URLSearchParams({surface,...params}),{},user);
    assert.equal(response.status,200,await response.clone().text());return response.json();
  };
  const post=(body)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    const bank=await rt.request('/api/analysis',post({statements:[{fileName:'bank.txt',text:statementFixture()}]}));
    const analysis=(await bank.json()).analysis;await rt.full(analysis.id);await rt.assign(analysis);
    const clients=await read('clients',{q:analysis.companyInn}),lead=clients.leads[0];assert.equal(lead.analysisId,analysis.id);
    const appResponse=await rt.request('/api/agent',post({type:'application',leadId:lead.id,analysisId:analysis.id,companyName:lead.companyName,
      bank:clients.offerOptions[0].bank,product:clients.offerOptions[0].product,requestedAmount:500000,calculatedLimit:0,nextAction:'Запросить документы'}),rt.broker);
    assert.equal(appResponse.status,201);const {id}=await appResponse.json();
    const desk=await read('home');assert.equal(Number(desk.metrics.clients),1);assert.equal(Number(desk.metrics.active),1);
    assert.ok(desk.events.some(e=>e.applicationId===id));assert.ok((await read('client',{id:lead.id})).analyses.some(a=>a.id===analysis.id));
    assert.equal((await read('application',{id})).history.length,1);
    assert.ok((await read('notifications')).events.some(e=>e.applicationId===id));
    assert.equal((await read('pipeline')).applications[0].id,id);
    assert.equal((await read('clients',{q:'no such company'})).leads.length,0);
    const {PartnerBilling}=rt.load('app/components/workspace/billing.tsx');
    const billingCopy=renderToStaticMarkup(React.createElement(PartnerBilling));
    assert.match(billingCopy,/Комиссии/);assert.doesNotMatch(billingCopy,/брокер/i);
    assert.ok(Array.isArray((await read('network')).agents));
    assert.ok(Array.isArray((await read('partners')).guaranteePolicies));
    const user2={...rt.stranger,roles:['AGENT']};
    await rt.db.prepare('INSERT INTO agent_accounts(user_email,agent_code,name) VALUES(?,?,?)').bind(user2.email,'other-agent','Other').run();
    for(const [surface,key] of [['client',lead.id],['application',id]]){
      assert.equal((await rt.request('/api/agent?'+new URLSearchParams({surface,id:key}),{},user2)).status,404);
    }
    const file={companyInn:analysis.companyInn,applicationId:id,category:'Досье',fileName:'agent-test.txt',mimeType:'text/plain',sizeBytes:1,contentBase64:'YQ=='};
    assert.equal((await rt.request('/api/documents',post(file),rt.broker)).status,201);
    assert.equal((await read('documents')).documents[0].fileName,file.fileName);
    assert.equal((await read('documents',{},user2)).documents.length,0);
    const owner=await(await rt.request('/api/workspace-model?analysisId='+analysis.id)).json();
    const assigned=await(await rt.request('/api/workspace-model?analysisId='+analysis.id,{},rt.broker)).json();
    assert.equal(assigned.access.readOnly,true);assert.deepEqual(assigned.full,owner.full);
    // A statement-only dossier has no BFO/BKI. Its published findings and collection actions still render.
    const {RiskSections,RecommendationsSection}=rt.load('app/components/workspace/profile-sections.tsx');
    const render=Component=>renderToStaticMarkup(React.createElement(Component,{model:assigned}));
    const findings=assigned.full.canonical.explainability.claims.filter(c=>c.riskFindingIds.length&&['FINDING','DATA_LIMITATION'].includes(c.claimKind));
    assert.ok(findings.length);assert.ok(render(RiskSections).includes('Почему?'));
    assert.ok(assigned.full.report.recommendations.primary.length);assert.match(render(RecommendationsSection),/Приоритетные рекомендации/);

    // Bank statements plus verified legal evidence, without any financial statements or bureau report.
    const business=loadBusiness('CL-RU-BUS-001'),profile=scenario(1,'terminated').companyProfile;
    const stopped=(await(await rt.request('/api/analysis',post({statements:business.statements}))).json()).analysis;
    await rt.full(stopped.id);await rt.assign(stopped);
    // The statement upload is received now, so the legal source must also be current at that date.
    profile.fetchedAt=stopped.createdAt;
    for(const receipt of profile.sourceManifest.external)receipt.receivedAt=stopped.createdAt;
    await rt.db.prepare('INSERT INTO checko_profiles(inn,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(inn) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at')
      .bind(stopped.companyInn,JSON.stringify(profile),profile.fetchedAt).run();
    const withStop=await(await rt.request('/api/workspace-model?analysisId='+stopped.id,{},rt.broker)).json();
    assert.equal(withStop.full.report.hero.globalStop,true,'current legal stop remains visible without BFO/BKI');
    assert.match(renderToStaticMarkup(React.createElement(RiskSections,{model:withStop})),/Стоп-факторы/);
    assert.ok(withStop.full.report.recommendations.primary.length);
    const {previousAgentUrl}=rt.load('lib/agent/legacy-links.ts');
    assert.equal(previousAgentUrl({view:'billing'}),'/agent/commissions');
    assert.equal(previousAgentUrl({view:'documents',analysisId:'a/b'}),'/agent/clients/a%2Fb/documents?analysisId=a%2Fb');
    assert.equal((await read('client',{id:analysis.id,analysisId:analysis.id})).lead.id,lead.id);
    assert.equal((await rt.request('/api/agent?surface=client&id='+lead.id+'&analysisId=missing',{},rt.broker)).status,404);
  }finally{await rt.close();}
});
