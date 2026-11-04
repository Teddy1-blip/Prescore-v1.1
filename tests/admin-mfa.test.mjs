import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {betterAuth} from 'better-auth';
import {twoFactor} from 'better-auth/plugins';
import {createOTP} from '@better-auth/utils/otp';
import {base32} from '@better-auth/utils/base32';
import * as mfa from '../lib/auth/admin-mfa.ts';
import * as brokerAuthorization from '../lib/auth/broker-authorizations.ts';
import {smtpConfiguration} from '../lib/platform/environment.ts';
import {PortableDatabase} from '../lib/db/compatibility.ts';
import {migrationRegistry} from '../lib/release/migrations.ts';

function load(file,imports){const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(out,id=>{if(id in imports)return imports[id];if(id.endsWith('/lib/auth/broker-authorizations'))return brokerAuthorization;throw Error('UNEXPECTED_IMPORT:'+id);});return out;}
function jar(initial=''){
 const cookies=new Map(initial.split('; ').filter(Boolean).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
 return {header:()=>[...cookies].map(([k,v])=>k+'='+v).join('; '),accept(response){for(const c of response.headers.getSetCookie()){const first=c.split(';')[0],i=first.indexOf('=');if(/max-age=0/i.test(c))cookies.delete(first.slice(0,i));else cookies.set(first.slice(0,i),first.slice(i+1));}}};
}
test('MFA rollout configuration rejects invalid values; approved additive schema is registered for the gated activation candidate',async()=>{
 assert.equal(mfa.adminMfaMode({}),'disabled');for(const mode of ['disabled','enrollment','required'])assert.equal(mfa.adminMfaMode({PRESCORE_ADMIN_2FA_MODE:mode}),mode);
 assert.throws(()=>mfa.adminMfaMode({PRESCORE_ADMIN_2FA_MODE:'true'}),/AUTH_MFA_CONFIGURATION_INVALID/);
 assert.equal((await migrationRegistry()).at(-1).version,'0010_admin_mfa.sql');
});

test('actual native 2FA lifecycle and central administrative authority, without live services',async t=>{
 const pg=new PGlite(),mail=[];
 const query=async(sql,values)=>{const r=await pg.query(sql,values);return{rows:r.rows,rowCount:r.affectedRows,command:sql.trim().split(' ')[0].toUpperCase()};};
 const pool={query,connect:async()=>({query,release(){}}),end:async()=>{}};
 for(const m of await migrationRegistry())await pg.exec(m.sql);
 const previous={...process.env};Object.assign(process.env,{PRESCORE_ADMIN_2FA_MODE:'required',AUTH_SECRET:'synthetic-isolated-mfa-test-secret-over-32-characters',PRESCORE_BASE_URL:'https://prescore.test',NODE_ENV:'production',SMTP_HOST:'synthetic',SMTP_FROM:'synthetic@prescore.test'});
 const server=load('lib/auth/server.ts',{'better-auth':{betterAuth},'better-auth/plugins':{twoFactor},'./admin-mfa.ts':mfa,'../db/client.ts':{getPool:()=>pool},'node:crypto':{randomUUID},'nodemailer':{createTransport:()=>({sendMail:async message=>{mail.push(message);}})},'../platform/environment.ts':{smtpConfiguration}});
 const auth=server.getAuth(),admin=jar(),other=jar();let password='Synthetic-Mfa-Password-2026!',secret,codes,userId,oldSessionCookie,readForeignDocument;
 const post=async(path,body,cookies=admin,origin='https://prescore.test')=>{const r=await auth.handler(new Request('https://prescore.test/api/auth/'+path,{method:'POST',headers:{'content-type':'application/json',origin,cookie:cookies.header()},body:JSON.stringify(body)}));cookies.accept(r);return r;};
 const clearRate=()=>query('DELETE FROM "rateLimit"');
 const session=(cookies=admin)=>server.getAuthSession(new Headers({cookie:cookies.header()}));
 const login=(cookies=admin)=>post('sign-in/email',{email:'admin@prescore.test',password},cookies);
 try{
  await t.test('password login retains CLIENT but cannot use ADMIN capabilities before enrollment',async()=>{
   assert.equal((await post('sign-up/email',{name:'Synthetic Admin',email:'admin@prescore.test',password,twoFactorEnabled:true})).status,200);
   await query('UPDATE "user" SET "emailVerified"=true');userId=(await query('SELECT id FROM "user"')).rows[0].id;
   await query("INSERT INTO platform_roles(user_id,role) VALUES($1,'ADMIN')",[userId]);
   assert.equal((await login()).status,200);assert.equal((await login(other)).status,200);oldSessionCookie=other.header();
   const s=await session();assert.deepEqual(s.user.roles,['CLIENT']);assert.equal(s.user.adminMfa,'ENROLLMENT_REQUIRED');
   assert.equal((await query('SELECT "twoFactorEnabled" FROM "user"')).rows[0].twoFactorEnabled,false);
   const api=load('app/api/api-auth.ts',{'../chatgpt-auth':{getChatGPTUser:async()=>(await session()).user}});
   assert.equal((await api.requireApiUser()).isAdmin,false);
   const db=new PortableDatabase(pool,JSON.parse(fs.readFileSync('lib/db/catalog.json','utf8')));
   await query(`INSERT INTO analyses(id,company_name,company_inn,file_name,period_from,period_to,score,grade,readiness,payload,owner_email) VALUES('foreign','Synthetic foreign','9900000002','synthetic','2026-01-01','2026-06-30',0,'UNKNOWN','UNKNOWN','{}','foreign@prescore.test')`);
   assert.equal(await api.readableAnalysis(db,'foreign',await api.requireApiUser()),null);
   await query(`INSERT INTO client_documents(id,company_inn,analysis_id,category,file_name,mime_type,size_bytes,content_base64,uploaded_by,owner_email) VALUES('foreign-doc','9900000002','foreign','OTHER','synthetic.txt','text/plain',1,'eA==','foreign@prescore.test','foreign@prescore.test')`);
   const docs=load('app/api/documents/route.ts',{'../../../lib/platform/runtime':{getRuntime:()=>({DB:db})},'../../../lib/storage/documents':{documentStorage:()=>({})},'../api-auth':api});
   readForeignDocument=()=>docs.GET(new Request('https://prescore.test/api/documents?download=foreign-doc'));assert.equal((await readForeignDocument()).status,404);
   const unavailable=()=>{throw Error('PRIVILEGED_BACKEND_MUST_NOT_RUN');};
   const billing=load('app/api/billing/admin/route.ts',{'../../api-auth':api,'../../../../lib/platform/runtime':{getRuntime:unavailable},'../../../../lib/billing/admin':{},'../../../../lib/billing/refunds':{},'../../../../lib/billing/providers':{},'../../../../lib/billing/http':{billingResponse:(b,status)=>Response.json(b,{status})}});
   for(const method of ['GET','POST'])assert.equal((await billing[method](new Request('https://prescore.test/api/billing/admin',{method}))).status,403);
   const control=load('app/api/admin/route.ts',{'../api-auth':api,'../../../lib/platform/runtime':{getRuntime:unavailable},'../../../lib/admin/governance':{},'../../../lib/admin/operations':{},'../../../lib/admin/observations':{},'../../../lib/admin/companies':{},'../workspace-model/route':{},'../../../lib/admin/resources':{}});
   for(const method of ['GET','POST'])assert.equal((await control[method](new Request('https://prescore.test/api/admin',{method}))).status,403);
  });
  await t.test('CLIENT-only and assigned BROKER sessions retain their roles without administrative MFA privileges',async()=>{
   for(const [email,broker] of [['client@prescore.test',false],['broker@prescore.test',true]]){
    const own=jar();await clearRate();assert.equal((await post('sign-up/email',{name:'Synthetic User',email,password},own)).status,200);
    await query('UPDATE "user" SET "emailVerified"=true WHERE email=$1',[email]);
    if(broker)await query('INSERT INTO agent_accounts(user_email,agent_code,name) VALUES($1,$2,$3)',[email,'synthetic-broker','Synthetic Broker']);
    assert.equal((await post('sign-in/email',{email,password},own)).status,200);
    const identity=await session(own);assert.deepEqual(identity.user.roles,broker?['CLIENT','AGENT']:['CLIENT']);assert.equal(identity.user.adminMfa,undefined);
    assert.equal((await post('two-factor/enable',{password,method:'totp'},own)).status,403);
   }
   process.env.PRESCORE_ADMIN_2FA_MODE='enrollment';assert.ok((await session()).user.roles.includes('ADMIN'));
   process.env.PRESCORE_ADMIN_2FA_MODE='required';assert.equal((await session()).user.roles.includes('ADMIN'),false);
  });
  await t.test('enrollment needs password and origin; secrets stay encrypted, no authority before verification',async()=>{
   await clearRate();assert.notEqual((await post('two-factor/enable',{password:'wrong',method:'totp'})).status,200);
   assert.equal((await post('two-factor/enable',{password,method:'totp'},admin,'https://foreign.invalid')).status,403);
   const r=await post('two-factor/enable',{password,method:'totp'});assert.equal(r.status,200);
   const data=await r.json();codes=data.backupCodes;secret=new TextDecoder().decode(base32.decode(new URL(data.totpURI).searchParams.get('secret')));
   assert.equal(codes.length,10);assert.equal((await session()).user.adminMfa,'ENROLLMENT_REQUIRED');
   const stored=(await query('SELECT * FROM "twoFactor"')).rows[0];assert.ok(stored.secret!==secret);assert.ok(!stored.backupCodes.includes(codes[0]));assert.equal(stored.verified,false);
   await clearRate();const prematureBackup=await post('two-factor/verify-backup-code',{code:codes[0]});assert.equal(prematureBackup.status,400);assert.equal((await prematureBackup.json()).code,'MFA_ENROLLMENT_TOTP_REQUIRED');
   assert.equal((await query('SELECT "backupCodes" FROM "twoFactor"')).rows[0].backupCodes,stored.backupCodes);assert.equal((await query('SELECT * FROM platform_admin_mfa_sessions')).rows.length,0);
   await clearRate();const invalid=await post('two-factor/verify-totp',{code:'invalid'});assert.notEqual(invalid.status,200);assert.equal((await query('SELECT * FROM platform_admin_mfa_sessions')).rows.length,0);
   assert.equal((await post('two-factor/verify-totp',{code:await createOTP(secret).totp(),trustDevice:true})).status,400);
  });
  await t.test('valid native TOTP stamps only the rotated session and opens central ADMIN authority',async()=>{
   await clearRate();const verified=await post('two-factor/verify-totp',{code:await createOTP(secret).totp(),trustDevice:false});assert.equal(verified.status,200);
   const current=await session();assert.ok(current.user.roles.includes('ADMIN'));assert.equal(current.user.adminMfa,'VERIFIED');assert.equal((await readForeignDocument()).status,200);
   const proof=(await query('SELECT * FROM platform_admin_mfa_sessions')).rows;assert.equal(proof.length,1);assert.equal(proof[0].session_id,current.id);
   const stale=await server.getAuthSession(new Headers({cookie:oldSessionCookie,'x-mfa-verified':'true'}));assert.ok(stale);assert.equal(stale.user.roles.includes('ADMIN'),false);assert.equal(stale.user.adminMfa,'VERIFICATION_REQUIRED');
   await query("UPDATE platform_admin_mfa_sessions SET verified_at=now()-interval '13 hours'");assert.equal((await session()).user.roles.includes('ADMIN'),false);
   await clearRate();assert.equal((await post('two-factor/verify-totp',{code:await createOTP(secret).totp()})).status,200);assert.ok((await session()).user.roles.includes('ADMIN'));
   assert.equal((await query("SELECT role FROM platform_roles WHERE user_id=$1",[userId])).rows[0].role,'ADMIN');
  });
  await t.test('password-only factor disable/recovery-code reveal denied, rotation requires recent factor and password',async()=>{
   await clearRate();assert.equal((await post('two-factor/disable',{password})).status,403);
   assert.equal((await post('two-factor/view-backup-codes',{userId})).status,404); // Native helper has no public HTTP endpoint.
   await query("UPDATE platform_admin_mfa_sessions SET verified_at=now()-interval '6 minutes'");
   await clearRate();assert.equal((await post('two-factor/generate-backup-codes',{password})).status,403);
   assert.equal((await post('two-factor/verify-totp',{code:await createOTP(secret).totp()})).status,200);
   await clearRate();const rotated=await post('two-factor/generate-backup-codes',{password});assert.equal(rotated.status,200);const next=(await rotated.json()).backupCodes;assert.ok(!next.includes(codes[0]));codes=next;
  });
  await t.test('sign-in challenge grants no session; backup recovers once; logout revokes proof',async()=>{
   await clearRate();const before=await session();assert.equal((await post('sign-out',{})).status,200);
   assert.equal((await query('SELECT * FROM platform_admin_mfa_sessions WHERE session_id=$1',[before.id])).rows.length,0);
   const challenge=await login();assert.equal(challenge.status,200);assert.equal((await challenge.json()).twoFactorRedirect,true);assert.equal(await session(),null);
   const backup=codes[0];await clearRate();assert.equal((await post('two-factor/verify-backup-code',{code:backup,trustDevice:false})).status,200);assert.ok((await session()).user.roles.includes('ADMIN'));
   await post('sign-out',{});await login();await clearRate();assert.notEqual((await post('two-factor/verify-backup-code',{code:backup})).status,200);assert.equal(await session(),null);
   assert.equal((await post('two-factor/verify-totp',{code:await createOTP(secret).totp()})).status,200);assert.ok((await session()).user.roles.includes('ADMIN'));
  });
  await t.test('password reset revokes sessions but cannot remove or bypass the second factor',async()=>{
   await clearRate();const old=admin.header();
   assert.equal((await post('request-password-reset',{email:'admin@prescore.test',redirectTo:'/reset-password'})).status,200);
   const url=mail.at(-1).text.split('\n').find(x=>x.startsWith('https://'));
   const landing=await auth.handler(new Request(url));const token=new URL(landing.headers.get('location'),'https://prescore.test').searchParams.get('token');assert.ok(token);
   password='Synthetic-Recovered-Password-2026!';assert.equal((await post('reset-password',{token,newPassword:password})).status,200);
   assert.equal(await server.getAuthSession(new Headers({cookie:old})),null);assert.equal((await query('SELECT * FROM platform_admin_mfa_sessions')).rows.length,0);
   assert.equal((await query('SELECT "twoFactorEnabled" FROM "user" WHERE id=$1',[userId])).rows[0].twoFactorEnabled,true);
   await clearRate();const challenge=await login();assert.equal((await challenge.json()).twoFactorRedirect,true);assert.equal(await session(),null);
   assert.equal((await post('two-factor/verify-totp',{code:await createOTP(secret).totp()})).status,200);assert.ok((await session()).user.roles.includes('ADMIN'));
   await query('ALTER TABLE platform_admin_mfa_sessions RENAME TO isolated_missing_proofs');
   await assert.rejects(session());
   await query('ALTER TABLE isolated_missing_proofs RENAME TO platform_admin_mfa_sessions');
  });
  await t.test('failed native challenges lock the account; no proof is written and secrets never enter audit events',async()=>{
   await clearRate();await post('sign-out',{});await login();
   for(let i=0;i<5;i++){await clearRate();assert.notEqual((await post('two-factor/verify-totp',{code:'invalid'})).status,200);}
   await clearRate();await login();await clearRate();assert.equal((await post('two-factor/verify-totp',{code:await createOTP(secret).totp()})).status,429);assert.equal(await session(),null);
   const row=(await query('SELECT "failedVerificationCount","lockedUntil" FROM "twoFactor"')).rows[0];assert.ok(row.failedVerificationCount>=5);assert.ok(row.lockedUntil);
   const events=JSON.stringify((await query('SELECT * FROM platform_security_events')).rows);assert.ok(!events.includes(secret));for(const code of codes)assert.ok(!events.includes(code));
  });
 }finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);await pg.close();}
});
