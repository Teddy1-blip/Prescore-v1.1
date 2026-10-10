import {getPool}from'../../../lib/db/client';
export const dynamic='force-dynamic';export const runtime='nodejs';

const STAGING_ORIGIN='https://prescore-staging-dorogovab.amvera.io';
const STAGING_DB_HOST='amvera-dorogovab-cnpg-prescore-stage-db-rw';
const ADMIN_EMAIL='dorogovab@yandex.ru';
const AGENT_CODE='AGENT-2EZU15FLCNYYRY8L41GGKW6Q';
const MARKER='STAGING_HISTORY_PURGE_20261010';
const DELETE_TABLES=['ai_usage','ai_messages','ai_conversations','application_messages','application_status_history','client_documents','agent_prospects','agent_applications','deals','analysis_entitlements','payments','payment_orders','subscriptions','agent_leads','checko_profiles','analyses'] as const;

async function purgeOldStagingHistory(){
  if(process.env.PRESCORE_BASE_URL!==STAGING_ORIGIN)return {status:'not-staging'} as const;
  let host='';try{host=new URL(process.env.DATABASE_URL||'').hostname}catch{}
  if(host!==STAGING_DB_HOST)return {status:'wrong-database'} as const;
  const pool=getPool();
  const client=await pool.connect();
  try{
    const done=await client.query("SELECT 1 FROM public.audit_log WHERE entity_type='MAINTENANCE' AND action=$1 LIMIT 1",[MARKER]);
    if(done.rowCount)return {status:'already-done'} as const;

    const tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows.map(r=>String(r.table_name));
    const required=[...DELETE_TABLES,'audit_log','user','platform_roles','agent_accounts'];
    const missing=required.filter(t=>!tables.includes(t));
    if(missing.length)return {status:'blocked',reason:'required-table-missing'} as const;

    const user=(await client.query('SELECT id,email FROM public."user" WHERE lower(email)=lower($1) LIMIT 1',[ADMIN_EMAIL])).rows[0];
    if(!user)return {status:'blocked',reason:'preserved-user-missing'} as const;
    const roles=(await client.query('SELECT role FROM public.platform_roles WHERE user_id=$1',[user.id])).rows.map(r=>String(r.role));
    if(!roles.includes('ADMIN'))return {status:'blocked',reason:'preserved-admin-missing'} as const;
    const agent=(await client.query('SELECT 1 FROM public.agent_accounts WHERE lower(user_email)=lower($1) AND agent_code=$2 LIMIT 1',[ADMIN_EMAIL,AGENT_CODE])).rows[0];
    if(!agent)return {status:'blocked',reason:'preserved-agent-missing'} as const;

    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    const deleted:Record<string,number>={};
    for(const table of DELETE_TABLES){
      const result=await client.query('DELETE FROM public."'+table+'"');
      deleted[table]=result.rowCount??0;
    }
    const audit=await client.query("DELETE FROM public.audit_log WHERE entity_type IN ('APPLICATION','ANALYSIS')");
    deleted.audit_log=audit.rowCount??0;

    const remaining=(await client.query(`SELECT
      (SELECT COUNT(*) FROM public.analyses)::int AS analyses,
      (SELECT COUNT(*) FROM public.deals)::int AS deals,
      (SELECT COUNT(*) FROM public.client_documents)::int AS documents,
      (SELECT COUNT(*) FROM public.agent_leads)::int AS leads,
      (SELECT COUNT(*) FROM public.ai_conversations)::int AS ai_conversations,
      (SELECT COUNT(*) FROM public.analysis_entitlements)::int AS entitlements`)).rows[0];
    if(Object.values(remaining).some(v=>Number(v)!==0))throw new Error('PURGE_VERIFY_FAILED');

    await client.query(`INSERT INTO public.audit_log
      (id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at)
      VALUES ($1,'MAINTENANCE','staging',$2,'ADMIN',$3,$4,$5)`,[
        crypto.randomUUID(),MARKER,ADMIN_EMAIL,JSON.stringify({deleted}),new Date().toISOString()
      ]);
    await client.query('COMMIT');
    return {status:'done',deleted} as const;
  }catch(error){
    try{await client.query('ROLLBACK')}catch{}
    return {status:'failed',reason:error instanceof Error?error.message:'unknown'} as const;
  }finally{client.release()}
}

export async function GET(){
  let database='unavailable';
  let purge:{status:string;reason?:string;deleted?:Record<string,number>}={status:'not-run'};
  try{
    await getPool().query('SELECT 1');
    database='connected';
    purge=await purgeOldStagingHistory();
  }catch{/* Never expose connection details. */}
  return Response.json({
    status:database==='connected'?'ok':'degraded',
    database,
    purge,
    version:process.env.PRESCORE_BUILD_VERSION||'standalone-migration'
  },{status:database==='connected'?200:503,headers:{'Cache-Control':'no-store'}});
}
