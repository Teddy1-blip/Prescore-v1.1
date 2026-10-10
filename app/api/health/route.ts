import {getPool}from'../../../lib/db/client';
export const dynamic='force-dynamic';export const runtime='nodejs';
// Temporary read-only verification of the completed staging purge. No reset capability.
export async function GET(){let database='unavailable';let verification:unknown;
 try{const pool=getPool();await pool.query('SELECT 1');database='connected';
 if(process.env.PRESCORE_BASE_URL==='https://prescore-staging-dorogovab.amvera.io'){
 const client=await pool.connect();try{await client.query('BEGIN READ ONLY');
 const markers=(await client.query("SELECT action FROM public.audit_log WHERE entity_type='MAINTENANCE' AND entity_id='staging' AND action IN ('STAGING_HISTORY_PURGE_20261010','STAGING_CLIENT_DATA_RESET_2026_10_10_V1')")).rows.map(r=>r.action);
 const counts:Record<string,number>={};for(const table of ['ai_usage','ai_messages','ai_conversations','application_messages','application_status_history','client_documents','agent_prospects','agent_applications','deals','analysis_entitlements','payments','payment_orders','subscriptions','agent_leads','checko_profiles','analyses'])counts[table]=Number((await client.query('SELECT count(*)::int AS count FROM public."'+table+'"')).rows[0].count);
 const user=(await client.query('SELECT id FROM public."user" WHERE email=$1',['dorogovab@yandex.ru'])).rows[0];
 const admin=user?Boolean((await client.query("SELECT 1 FROM public.platform_roles WHERE user_id=$1 AND role='ADMIN'",[user.id])).rows.length):false;
 const agent=Boolean((await client.query('SELECT 1 FROM public.agent_accounts WHERE user_email=$1 AND agent_code=$2',['dorogovab@yandex.ru','AGENT-2EZU15FLCNYYRY8L41GGKW6Q'])).rows.length);
 verification={status:markers.length?'already-done':'not-confirmed',counts,preserved:{user:!!user,admin,agent}};
 await client.query('COMMIT');}catch{await client.query('ROLLBACK');verification={status:'verification-unavailable'};}finally{client.release();}}
 }catch{/* No connection details. */}
 return Response.json({status:database==='connected'?'ok':'degraded',database,...(verification?{verification}:{}),version:process.env.PRESCORE_BUILD_VERSION||'standalone-migration'},{status:database==='connected'?200:503,headers:{'Cache-Control':'no-store'}});
}
