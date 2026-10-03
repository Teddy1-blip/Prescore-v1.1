/** One-time staging maintenance. Remove after verified cleanup. No request-time DDL. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { TransactionPool, QueryExecutor } from './db/compatibility.ts';
export const ADMIN = 'dorogovab@yandex.ru';
export const AGENT = 'AGENT-2EZU15FLCNYYRY8L41GGKW6Q';
export const ORIGIN = 'https://prescore-staging-dorogovab.amvera.io';
export const PHRASE = 'DELETE ALL STAGING CLIENT DATA';
export const BASE = '3315c1a9ecc791864aaa1f5e09f8a94fcfc0350b';
export const DELETE_TABLES = ['ai_usage','ai_messages','ai_conversations','application_messages','application_status_history','client_documents','agent_prospects','agent_applications','deals','analysis_entitlements','payments','payment_orders','subscriptions','agent_leads','checko_profiles','analyses'] as const;
export const PRESERVE_TABLES = ['user','session','account','verification','rateLimit','platform_roles','platform_security_events','platform_bootstrap','prescore_schema_migrations','agent_accounts','agent_partners','module_settings','control_settings'] as const;
export const IDS = ['ad80031b-b5c4-48bf-9eab-7cc07c66a2a3','7ec7daeb-dfef-4f1f-9c9d-15ea86fe864c','ad26967b-568b-4153-8c5c-e80eb8133651'];
const AUDIT_WHERE = `entity_type IN ('APPLICATION','ANALYSIS')`;
const quote = (s:string) => '"'+s.replaceAll('"','""')+'"';
export class CleanupError extends Error { constructor(public status:number, code:string){super(code);} }
const fail = (code:string,status=409):never => {throw new CleanupError(status,code);};
export function guard(user:{email:string;roles:string[]}|null, env:Record<string,string|undefined>, origin:string|null) {
 if(!user || user.email!==ADMIN || !user.roles.includes('ADMIN'))fail('FORBIDDEN',403);
 if(env.PRESCORE_BASE_URL!==ORIGIN || origin!==ORIGIN)fail('STAGING_ORIGIN_REQUIRED',403);
 let host=''; try {host=new URL(env.DATABASE_URL||'').hostname;}catch{}
 if(host!=='amvera-dorogovab-cnpg-prescore-stage-db-rw')fail('STAGING_DATABASE_REQUIRED',403);
 if(!env.AUTH_SECRET || env.AUTH_SECRET.length<32)fail('MAINTENANCE_SIGNING_UNAVAILABLE',503);
 if(Date.now()>Date.parse('2026-10-05T23:59:59Z'))fail('MAINTENANCE_EXPIRED',410);
}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function snapshot(c:QueryExecutor){
 const tables=(await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).rows.map(r=>String(r.table_name));
 const expected=[...DELETE_TABLES,...PRESERVE_TABLES,'audit_log'].sort();
 if(JSON.stringify(tables)!==JSON.stringify(expected))fail('UNEXPECTED_TABLE_CATALOG');
 const foreignKeys=(await c.query(`SELECT con.conname, ns.nspname AS child_schema, child.relname AS child, pn.nspname AS parent_schema, parent.relname AS parent, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace JOIN pg_class parent ON parent.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace WHERE con.contype='f' AND (ns.nspname='public' OR pn.nspname='public') ORDER BY con.conname`)).rows;
 const auditTypes=(await c.query('SELECT DISTINCT entity_type FROM public.audit_log')).rows.map(r=>String(r.entity_type));
 if(auditTypes.some(t=>!['APPLICATION','ANALYSIS','MODULE_SETTING','CONTROL_SETTING','CONTROL_GROUP','MAINTENANCE'].includes(t)))fail('UNEXPECTED_AUDIT_ENTITY');
 const order=[...DELETE_TABLES,'audit_log'];
 for(const fk of foreignKeys){const parent=order.indexOf(String(fk.parent) as typeof order[number]),child=order.indexOf(String(fk.child) as typeof order[number]);if(parent>=0&&(child<0||child>=parent||fk.child_schema!=='public'||fk.parent_schema!=='public'))fail('UNEXPECTED_DEPENDENCY');}
 // Non-internal triggers could mutate preserved tables even without foreign keys.
 const triggers=(await c.query(`SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`)).rows;
 if(triggers.length)fail('UNEXPECTED_TRIGGER');
 const candidates:Record<string,number>={},preserve:Record<string,number>={},fingerprints:Record<string,unknown>={};
 for(const table of tables){const where=table==='audit_log'?' WHERE '+AUDIT_WHERE:'';const row=(await c.query(`SELECT count(*) AS count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS fingerprint FROM public.${quote(table)} t${where}`)).rows[0];const count=Number(row.count);if(!Number.isSafeInteger(count))fail('INVALID_COUNT');if(order.includes(table as typeof order[number]))candidates[table]=count;else preserve[table]=count;if(!['session','verification','rateLimit','platform_security_events'].includes(table))fingerprints[table]=row.fingerprint;}
 const user=(await c.query('SELECT id,email FROM public."user" WHERE email=$1',[ADMIN])).rows[0];
 if(!user)fail('PRESERVED_USER_MISSING');
 const roles=(await c.query('SELECT role FROM public.platform_roles WHERE user_id=$1 ORDER BY role',[user.id])).rows.map(r=>String(r.role));
 if(!['CLIENT','AGENT','ADMIN'].every(r=>roles.includes(r)))fail('PRESERVED_ROLES_MISSING');
 const agent=(await c.query('SELECT user_email,agent_code FROM public.agent_accounts WHERE user_email=$1 AND agent_code=$2',[ADMIN,AGENT])).rows[0];
 if(!agent)fail('PRESERVED_AGENT_MISSING');
 const known=(await c.query('SELECT id FROM public.analyses WHERE id=ANY($1::text[]) ORDER BY id',[IDS])).rows.map(r=>String(r.id));
 const companies=Number((await c.query(`SELECT count(DISTINCT inn) AS count FROM (SELECT company_inn AS inn FROM public.analyses UNION SELECT company_inn FROM public.agent_leads UNION SELECT company_inn FROM public.client_documents UNION SELECT company_inn FROM public.subscriptions UNION SELECT company_inn FROM public.payment_orders UNION SELECT company_inn FROM public.agent_prospects UNION SELECT inn FROM public.checko_profiles) companies WHERE inn<>''`)).rows[0].count);
 const db=(await c.query('SELECT current_database() AS name')).rows[0];
 return {target:{environment:'staging',database:db.name,adminEmail:ADMIN,baseSha:BASE},preserve,candidates,foreignKeys,knownAnalyses:Object.fromEntries(IDS.map(id=>[id,known.includes(id)?'FOUND':'NOT FOUND'])),companies,preserved:{user:ADMIN,roles,agent},fingerprint:hash({fingerprints,foreignKeys,db})};
}
function sign(value:string,secret:string){return createHmac('sha256',secret).update(value).digest('hex');}
export async function maintenance(pool:TransactionPool,secret:string,body:Record<string,unknown>){
 const execute=body.action==='staging-cleanup-execute';
 if(!execute&&body.action!=='staging-cleanup-preview')fail('UNKNOWN_ACTION',400);
 if(execute&&body.confirmation!==PHRASE)fail('CONFIRMATION_REQUIRED',403);
 let expected='';
 if(execute){const token=String(body.previewToken||''),parts=token.split('.');if(parts.length!==3)fail('PREVIEW_REQUIRED',403);const [digest,expires,signature]=parts;const good=sign(digest+'.'+expires,secret);if(!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(good),Buffer.from(signature))||Number(expires)<Date.now())fail('PREVIEW_INVALID_OR_EXPIRED',403);expected=digest;}
 const c=await pool.connect();
 try{
  await c.query(execute?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  if(execute){await c.query("SET LOCAL lock_timeout='5s'");await c.query('LOCK TABLE '+[...DELETE_TABLES,'audit_log','user','platform_roles','agent_accounts','agent_partners','module_settings','control_settings'].map(t=>'public.'+quote(t)).join(',')+' IN EXCLUSIVE MODE');}
  const before=await snapshot(c);
  if(!execute){await c.query('COMMIT');const expires=Date.now()+30*60*1000;const value=before.fingerprint+'.'+expires;return {...before,previewToken:value+'.'+sign(value,secret),storage:'PHYSICAL_OBJECTS_DEFER'};}
  if(before.fingerprint!==expected)fail('PREVIEW_STALE');
  const deleted:Record<string,number>={};
  for(const table of [...DELETE_TABLES,'audit_log']){const r=await c.query('DELETE FROM public.'+quote(table)+(table==='audit_log'?' WHERE '+AUDIT_WHERE:''));deleted[table]=r.rowCount??0;if(deleted[table]!==before.candidates[table])fail('DELETE_COUNT_MISMATCH');}
  const after=await snapshot(c);
  if(Object.values(after.candidates).some(n=>n!==0)||after.companies!==0)fail('AFTER_NOT_EMPTY');
  for(const t of ['user','platform_roles','agent_accounts','agent_partners','module_settings','control_settings'])if(after.preserve[t]!==before.preserve[t])fail('PRESERVED_COUNT_CHANGED');
  await c.query(`INSERT INTO public.audit_log (id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at) VALUES ($1,'MAINTENANCE','staging','STAGING_CLIENT_DATA_CLEANUP','ADMIN',$2,$3,$4)`,[randomUUID(),ADMIN,JSON.stringify({deleted}),new Date().toISOString()]);
  await c.query('COMMIT');
  return {before,deleted,after,committed:true,storage:'PHYSICAL_OBJECTS_DEFER'};
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
