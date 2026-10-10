import {getPool} from './db/client';

export const PURGE_MARKER='STAGING_HISTORY_PURGE_20261010';
const STAGING_ORIGIN='https://prescore-staging-dorogovab.amvera.io';
const STAGING_DB_HOST='amvera-dorogovab-cnpg-prescore-stage-db-rw';
const ADMIN_EMAIL='dorogovab@yandex.ru';
const AGENT_CODE='AGENT-2EZU15FLCNYYRY8L41GGKW6Q';
const DELETE_TABLES=['ai_usage','ai_messages','ai_conversations','application_messages','application_status_history','client_documents','agent_prospects','agent_applications','deals','analysis_entitlements','payments','payment_orders','subscriptions','agent_leads','checko_profiles','analyses'] as const;

export type StagingHistoryPurgeResult={status:string;reason?:string;deleted?:Record<string,number>};

export async function purgeOldStagingHistory():Promise<StagingHistoryPurgeResult>{
  if(process.env.PRESCORE_BASE_URL!==STAGING_ORIGIN)return {status:'not-staging'};
  let host='';try{host=new URL(process.env.DATABASE_URL||'').hostname}catch{}
  if(host!==STAGING_DB_HOST)return {status:'wrong-database'};

  const client=await getPool().connect();
  try{
    const tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows.map(r=>String(r.table_name));
    for(const required of ['audit_log','user','platform_roles','agent_accounts','analyses']){
      if(!tables.includes(required))return {status:'blocked',reason:'required-table-missing'};
    }

    const done=await client.query("SELECT 1 FROM public.audit_log WHERE entity_type='MAINTENANCE' AND action=$1 LIMIT 1",[PURGE_MARKER]);
    if(done.rowCount)return {status:'already-done'};

    const user=(await client.query('SELECT id,email FROM public."user" WHERE lower(email)=lower($1) LIMIT 1',[ADMIN_EMAIL])).rows[0];
    if(!user)return {status:'blocked',reason:'preserved-user-missing'};
    const roles=(await client.query('SELECT role FROM public.platform_roles WHERE user_id=$1',[user.id])).rows.map(r=>String(r.role));
    if(!roles.includes('ADMIN'))return {status:'blocked',reason:'preserved-admin-missing'};
    const agent=(await client.query('SELECT 1 FROM public.agent_accounts WHERE lower(user_email)=lower($1) AND agent_code=$2 LIMIT 1',[ADMIN_EMAIL,AGENT_CODE])).rows[0];
    if(!agent)return {status:'blocked',reason:'preserved-agent-missing'};

    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    const deleted:Record<string,number>={};
    for(const table of DELETE_TABLES){
      if(!tables.includes(table)){deleted[table]=0;continue}
      const result=await client.query('DELETE FROM public."'+table+'"');
      deleted[table]=result.rowCount??0;
    }
    const audit=await client.query("DELETE FROM public.audit_log WHERE entity_type IN ('APPLICATION','ANALYSIS')");
    deleted.audit_log=audit.rowCount??0;

    const remaining=(await client.query('SELECT COUNT(*)::int AS count FROM public.analyses')).rows[0]?.count;
    if(Number(remaining)!==0)throw new Error('PURGE_VERIFY_ANALYSES_NOT_EMPTY');

    const userAfter=(await client.query('SELECT id FROM public."user" WHERE id=$1',[user.id])).rows[0];
    const adminAfter=(await client.query("SELECT 1 FROM public.platform_roles WHERE user_id=$1 AND role='ADMIN' LIMIT 1",[user.id])).rows[0];
    const agentAfter=(await client.query('SELECT 1 FROM public.agent_accounts WHERE lower(user_email)=lower($1) AND agent_code=$2 LIMIT 1',[ADMIN_EMAIL,AGENT_CODE])).rows[0];
    if(!userAfter||!adminAfter||!agentAfter)throw new Error('PURGE_PRESERVED_ACCESS_CHANGED');

    await client.query(`INSERT INTO public.audit_log
      (id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at)
      VALUES ($1,'MAINTENANCE','staging',$2,'ADMIN',$3,$4,$5)`,[
      crypto.randomUUID(),PURGE_MARKER,ADMIN_EMAIL,JSON.stringify({deleted}),new Date().toISOString()
    ]);
    await client.query('COMMIT');
    return {status:'done',deleted};
  }catch(error){
    try{await client.query('ROLLBACK')}catch{}
    return {status:'failed',reason:error instanceof Error?error.message:'unknown'};
  }finally{client.release()}
}
