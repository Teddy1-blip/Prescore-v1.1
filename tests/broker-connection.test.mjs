import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {betterAuth} from 'better-auth';
import {twoFactor} from 'better-auth/plugins';
import {randomUUID} from 'node:crypto';
import {smtpConfiguration} from '../lib/platform/environment.ts';
import {verificationReturnPath} from '../lib/auth/ux.ts';
import {statementFixture} from './fixtures/block1-statements.mjs';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';

function load(file,imports){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(exports,name=>{if(name in imports)return imports[name];if(name.endsWith('.css'))return {};throw Error('UNEXPECTED_IMPORT:'+name);});return exports;}
const base='https://prescore.test';
const body={type:'connect',offerAccepted:true,consent:true};
const connect=(rt,user,payload=body,headers={origin:base})=>rt.request('/api/agent',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload)},user);
const inEnvironment=()=>{const previous={...process.env};Object.assign(process.env,{PRESCORE_BASE_URL:base,PRESCORE_ADMIN_2FA_MODE:'disabled',AUTH_SECRET:'synthetic-test-secret-at-least-32-characters-long',NODE_ENV:'production',SMTP_HOST:'synthetic',SMTP_FROM:'test@prescore.test'});return()=>{process.env=previous;};};

test('native verified new user and existing CLIENT explicitly connect, refresh roles, logout and re-enter as ordinary AGENT',async()=>{
 const restore=inEnvironment(),rt=await createWorkspaceRuntime(),mail=[];
 try{
  const query=async(sql,values)=>{const r=await rt.pg.query(sql,values);return{rows:r.rows,rowCount:r.affectedRows,command:sql.trim().split(' ')[0].toUpperCase()};};
  const pool={query,connect:async()=>({query,release(){}}),end:async()=>{}};
  const mfa=fs.existsSync('lib/auth/admin-mfa.ts')?await import('../lib/auth/admin-mfa.ts'):{};
  const actual=load('lib/auth/server.ts',{'better-auth':{betterAuth},'better-auth/plugins':{twoFactor},'./admin-mfa.ts':mfa,'../db/client.ts':{getPool:()=>pool},'node:crypto':{randomUUID},'../platform/environment.ts':{smtpConfiguration},nodemailer:{createTransport:()=>({sendMail:async message=>mail.push(message)})}});
  const seeded=await rt.request('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({statements:[{text:statementFixture({openingBalance:null,endingBalance:null}),fileName:'broker-test.txt'}]})});
  assert.equal(seeded.status,200);const foreignAnalysis=(await seeded.json()).analysis;
  const beforeOwner=(await rt.pg.query('SELECT owner_email,payload FROM analyses WHERE id=$1',[foreignAnalysis.id])).rows;
  const auth=actual.getAuth(),headers={'content-type':'application/json',origin:base};
  const post=(path,data,cookie)=>auth.handler(new Request(base+'/api/auth/'+path,{method:'POST',headers:{...headers,...(cookie?{cookie}:{})},body:JSON.stringify(data)}));
  for(const scenario of ['new-broker','existing-client']){
   const email=scenario+'@prescore.test',destination='/agent?view=clients';
   const signup=await post('sign-up/email',{name:scenario,email,password:'Synthetic123!',callbackURL:verificationReturnPath(destination)});assert.equal(signup.status,200);
   assert.equal((await rt.pg.query('SELECT * FROM agent_accounts WHERE user_email=$1',[email])).rows.length,0);
   assert.equal((await post('sign-in/email',{email,password:'Synthetic123!'})).status,403);
   assert.equal((await connect(rt,null)).status,401);
   const url=mail.at(-1).text.split('\n').find(line=>line.startsWith('https://'));
   const verified=await auth.handler(new Request(url));assert.equal(verified.status,302);assert.equal(verified.headers.get('location'),verificationReturnPath(destination));
   const login=await post('sign-in/email',{email,password:'Synthetic123!'});assert.equal(login.status,200);
   let cookie=login.headers.get('set-cookie').split(';')[0];
   let session=await actual.getAuthSession(new Headers({cookie}));assert.deepEqual(session.user.roles,['CLIENT']);
   if(scenario==='existing-client'){
    assert.equal((await rt.request('/api/workspace?projection=summary',{},session.user)).status,200);
    await post('sign-out',{},cookie);
    const again=await post('sign-in/email',{email,password:'Synthetic123!'});cookie=again.headers.get('set-cookie').split(';')[0];session=await actual.getAuthSession(new Headers({cookie}));
   }
   assert.equal((await rt.request('/api/agent',{},session.user)).status,403);
   assert.equal((await rt.request('/api/agent/prospects',{},session.user)).status,403);
   const connected=await connect(rt,session.user,{...body,email:'foreign@prescore.test',role:'ADMIN',agentCode:'foreign-code'});assert.equal(connected.status,201);
   const account=(await connected.json()).agent;
   session=await actual.getAuthSession(new Headers({cookie}));assert.deepEqual(session.user.roles,['CLIENT','AGENT']);
   const cabinet=await rt.request('/api/agent',{},session.user);assert.equal(cabinet.status,200);const data=await cabinet.json();assert.equal(data.agent.code,account.agentCode);assert.deepEqual(data.leads,[]);
   assert.equal((await rt.request('/api/admin?resource=brokers',{},session.user)).status,403);
   assert.equal((await rt.request('/api/workspace-model?analysisId='+foreignAnalysis.id,{},session.user)).status,404);
   await rt.pg.query('INSERT INTO agent_leads(id,agent_code,company_name,company_inn,consent_at) VALUES($1,$2,$3,$4,$5)',[scenario,account.agentCode,foreignAnalysis.companyName,foreignAnalysis.companyInn,'synthetic-test-assignment']);
   for(let reload=0;reload<2;reload++){
    const assigned=await rt.request('/api/workspace-model?analysisId='+foreignAnalysis.id,{},session.user);assert.equal(assigned.status,200);assert.equal((await assigned.json()).access.role,'ASSIGNED_BROKER');
   }
   await rt.pg.query('DELETE FROM agent_leads WHERE id=$1',[scenario]);
   assert.equal((await rt.request('/api/workspace-model?analysisId='+foreignAnalysis.id,{},session.user)).status,404);
   assert.equal((await connect(rt,session.user)).status,200);
   assert.equal((await rt.pg.query('SELECT * FROM agent_accounts WHERE user_email=$1',[email])).rows.length,1);
   await post('sign-out',{},cookie);assert.equal(await actual.getAuthSession(new Headers({cookie})),null);
   const fresh=await post('sign-in/email',{email,password:'Synthetic123!'});assert.equal(fresh.status,200);
   const freshSession=await actual.getAuthSession(new Headers({cookie:fresh.headers.get('set-cookie').split(';')[0]}));
   assert.deepEqual(freshSession.user.roles,['CLIENT','AGENT']);assert.equal((await rt.request('/api/agent',{},freshSession.user)).status,200);
   await rt.pg.query('DELETE FROM "rateLimit"');
  }
  assert.deepEqual((await rt.pg.query('SELECT owner_email,payload FROM analyses WHERE id=$1',[foreignAnalysis.id])).rows,beforeOwner);
  assert.equal((await rt.pg.query('SELECT * FROM platform_roles')).rows.length,0);
  assert.equal((await rt.pg.query("SELECT * FROM agent_accounts WHERE user_email='foreign@prescore.test'")).rows.length,0);
  assert.equal((await rt.pg.query("SELECT * FROM audit_log WHERE action='SELF_CONNECT'")).rows.length,2);
 }finally{await rt.close();restore();}
});

test('self-connect rejects missing/cross-site origin, missing consents, anonymous users and GET side effects',async()=>{
 const restore=inEnvironment(),rt=await createWorkspaceRuntime();try{
  for(const headers of [{},{origin:'https://foreign.test'},{origin:base,'sec-fetch-site':'cross-site'}])assert.equal((await connect(rt,rt.owner,body,headers)).status,403);
  for(const payload of [{type:'connect'},{...body,consent:false},{...body,offerAccepted:false}])assert.equal((await connect(rt,rt.owner,payload)).status,400);
  assert.equal((await connect(rt,null)).status,401);
  for(const user of [rt.owner,rt.broker,rt.admin])for(const route of ['/api/agent','/api/agent/prospects'])assert.notEqual((await rt.request(route,{},user)).status,200);
  assert.equal((await rt.pg.query('SELECT * FROM agent_accounts')).rows.length,0);
  assert.equal((await rt.pg.query('SELECT * FROM audit_log')).rows.length,0);
 }finally{await rt.close();restore();}
});

test('concurrent self-connect creates one profile and one consent event without changing other users',async()=>{
 const restore=inEnvironment(),rt=await createWorkspaceRuntime();try{
  await rt.pg.query("INSERT INTO agent_accounts(user_email,agent_code,name) VALUES('other@prescore.test','existing-other','Other')");
  const responses=await Promise.all([connect(rt,rt.owner),connect(rt,rt.owner)]);assert.ok(responses.every(r=>[200,201].includes(r.status)));
  const accounts=(await rt.pg.query('SELECT * FROM agent_accounts ORDER BY user_email')).rows;assert.equal(accounts.length,2);
  const events=(await rt.pg.query("SELECT * FROM audit_log WHERE action='SELF_CONNECT'")).rows;assert.equal(events.length,1);assert.equal(events[0].actor_email,rt.owner.email);
  const metadata=JSON.parse(events[0].metadata);assert.equal(metadata.offerAccepted,true);assert.equal(metadata.consentAccepted,true);
  const before=JSON.stringify(accounts);await connect(rt,rt.owner);assert.equal(JSON.stringify((await rt.pg.query('SELECT * FROM agent_accounts ORDER BY user_email')).rows),before);
 }finally{await rt.close();restore();}
});

test('a public referral is not a broker account; only its verified email can explicitly connect its existing code',async()=>{
 const restore=inEnvironment(),rt=await createWorkspaceRuntime();try{
  await rt.pg.query("INSERT INTO agent_accounts(user_email,agent_code,name) VALUES('curator@prescore.test','CURATOR','Curator')");
  const invitationResponse=await rt.request('/api/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'subagent',agentCode:'CURATOR',name:'Partner',email:rt.owner.email,consent:true})},null);
  assert.equal(invitationResponse.status,201);const invitation=(await invitationResponse.json()).agentCode;
  assert.equal((await rt.pg.query('SELECT * FROM agent_accounts WHERE user_email=$1',[rt.owner.email])).rows.length,0);
  assert.equal((await connect(rt,rt.stranger,{...body,invitation})).status,409);
  assert.equal((await connect(rt,rt.owner,{...body,invitation})).status,201);
  assert.equal((await connect(rt,rt.owner,{...body,invitation})).status,200);
  assert.equal((await rt.pg.query('SELECT agent_code FROM agent_accounts WHERE user_email=$1',[rt.owner.email])).rows[0].agent_code,invitation);
  assert.equal((await rt.pg.query('SELECT status FROM agent_partners WHERE agent_code=$1',[invitation])).rows[0].status,'Активен');
  assert.equal((await rt.pg.query('SELECT * FROM agent_accounts WHERE user_email=$1',[rt.stranger.email])).rows.length,0);
 }finally{await rt.close();restore();}
});

test('CLIENT /agent renders explicit connection instead of redirecting to dashboard; connected AGENT keeps children',async()=>{
 let user={email:'client@prescore.test',roles:['CLIENT']},returnTo='/agent?view=clients';const connection=()=>null;
 const layout=load('app/agent/layout.tsx',{'next/headers':{headers:async()=>new Headers({'x-prescore-return-to':returnTo})},'../chatgpt-auth':{requireChatGPTUser:async target=>{assert.equal(target,'/agent');return user;}},'../../lib/auth/contracts':await import('../lib/auth/contracts.ts'),'./connect':{AgentConnection:connection},'react/jsx-runtime':await import('react/jsx-runtime')});
 const page=await layout.default({children:'private cabinet'});assert.equal(page.type,connection);assert.equal(page.props.returnTo,returnTo);assert.equal(page.props.email,user.email);
 for(const roles of [['CLIENT','AGENT'],['CLIENT','ADMIN']]){user={...user,roles};assert.equal(await layout.default({children:'private cabinet'}),'private cabinet');}
 const rt=await createWorkspaceRuntime();try{const {AgentConnection}=rt.load('app/agent/connect.tsx');const html=renderToStaticMarkup(React.createElement(AgentConnection,{email:'client@prescore.test'}));assert.match(html,/Подключить кабинет брокера/);assert.match(html,/name="consent"/);assert.match(html,/name="offerAccepted"/);assert.doesNotMatch(html,/type="password"/);}finally{await rt.close();}
 assert.match(fs.readFileSync('app/agent-ref/[code]/page.tsx','utf8'),/\/agent\?invitation=/);
});

 test('consent event and profile creation roll back together when persistence fails',async()=>{
 const restore=inEnvironment(),rt=await createWorkspaceRuntime();try{
  await rt.pg.exec(`CREATE FUNCTION reject_connection_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END; $$;
  CREATE TRIGGER reject_connection_audit BEFORE INSERT ON audit_log FOR EACH ROW WHEN (NEW.action = 'SELF_CONNECT') EXECUTE FUNCTION reject_connection_audit();`);
  assert.equal((await connect(rt,rt.owner)).status,500);
  assert.equal((await rt.pg.query('SELECT * FROM agent_accounts')).rows.length,0);
  await rt.pg.exec('DROP TRIGGER reject_connection_audit ON audit_log');
  assert.equal((await connect(rt,rt.owner)).status,201);
 }finally{await rt.close();restore();}
});
