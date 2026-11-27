import {createHash} from 'node:crypto';
import type {QueryExecutor,TransactionPool} from '../db/compatibility.ts';

export type OwnerArchiveScope = {kind:'OWNER_EXPLICIT_IDS';ownerEmail:string;analysisIds:string[];protectedAnalysisIds:string[];targetBaseUrl:string};
export type ArchivePlan = {cutover:string;records:{id:string;createdAt:string}[];count:number;fingerprint:string}&({version:'PRESCORE_ARCHIVE_V1';scope?:never}|{version:'PRESCORE_ARCHIVE_V2';scope:OwnerArchiveScope});
function ownerScope(scope:OwnerArchiveScope):OwnerArchiveScope{
 const ids=(value:string[])=>Array.isArray(value)&&value.length<=1000&&new Set(value).size===value.length&&value.every(id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id));
 if(!scope||scope.kind!=='OWNER_EXPLICIT_IDS'||typeof scope.ownerEmail!=='string'||!/^[^\s@]+@[^\s@]+$/.test(scope.ownerEmail)||scope.ownerEmail!==scope.ownerEmail.toLowerCase()||!ids(scope.analysisIds)||!scope.analysisIds.length||!ids(scope.protectedAnalysisIds)||scope.analysisIds.some(id=>scope.protectedAnalysisIds.includes(id)))throw Error('ARCHIVE_SCOPE_INVALID');
 // This maintenance path is explicitly limited to the existing staging application.
 if(scope.targetBaseUrl!=='https://prescore-staging-dorogovab.msk1.amvera.tech')throw Error('ARCHIVE_SCOPE_INVALID');
 return {...scope,analysisIds:[...scope.analysisIds].sort(),protectedAnalysisIds:[...scope.protectedAnalysisIds].sort()};
}
export function assertOwnerArchiveEnvironment(scope:OwnerArchiveScope,env:Record<string,string|undefined>){
 ownerScope(scope);
 if(env.PRESCORE_RUNTIME_MODE!=='release-candidate'||env.PRESCORE_BASE_URL!==scope.targetBaseUrl)throw Error('ARCHIVE_ENVIRONMENT_MISMATCH');
}
async function assertNoBrokerLinks(db:QueryExecutor,scope:OwnerArchiveScope){
 const linked=await db.query(`SELECT a.id FROM analyses a WHERE a.id=ANY($1::text[]) AND (
 EXISTS(SELECT 1 FROM agent_leads l WHERE a.company_inn<>'' AND l.company_inn=a.company_inn)
 OR EXISTS(SELECT 1 FROM agent_applications p WHERE p.analysis_id=a.id)) LIMIT 1`,[scope.analysisIds]);
 if(linked.rows.length)throw Error('ARCHIVE_BROKER_LINKED');
}
function cutoverUTC(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw Error('ARCHIVE_CUTOVER_INVALID');
 return value;
}
function fingerprint(cutover:string,records:ArchivePlan['records'],scope?:OwnerArchiveScope){return createHash('sha256').update(JSON.stringify({cutover,records,...(scope?{scope:ownerScope(scope)}:{})})).digest('hex');}
export async function previewArchive(db:QueryExecutor,cutover:string,requestedScope?:OwnerArchiveScope):Promise<ArchivePlan>{
 cutoverUTC(cutover);
 if(requestedScope){
  const scope=ownerScope(requestedScope);
  const rows=(await db.query("SELECT id,created_at FROM analyses WHERE archive_state='ACTIVE' AND owner_email=$1 AND id=ANY($2::text[]) AND created_at::timestamptz < $3::timestamptz ORDER BY id",[scope.ownerEmail,scope.analysisIds,cutover])).rows;
  const records=rows.map(r=>({id:String(r.id),createdAt:String(r.created_at)}));
  if(records.length!==scope.analysisIds.length)throw Error('ARCHIVE_SCOPE_MISMATCH');
  await assertNoBrokerLinks(db,scope);
  return {version:'PRESCORE_ARCHIVE_V2',scope,cutover,records,count:records.length,fingerprint:fingerprint(cutover,records,scope)};
 }
 // A malformed persisted timestamp blocks the preview; it is never silently included.
 const hasArchive=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='analyses' AND column_name='archive_state'")).rows.length>0;
 const rows=(await db.query("SELECT id,created_at FROM analyses WHERE "+(hasArchive?"archive_state='ACTIVE' AND ":'')+"created_at::timestamptz < $1::timestamptz ORDER BY id",[cutover])).rows;
 const records=rows.map(r=>({id:String(r.id),createdAt:String(r.created_at)}));
 return {version:'PRESCORE_ARCHIVE_V1',cutover,records,count:records.length,fingerprint:fingerprint(cutover,records)};
}
function validatePlan(plan:ArchivePlan){
 cutoverUTC(plan.cutover);
 if((plan.version!=='PRESCORE_ARCHIVE_V1'&&plan.version!=='PRESCORE_ARCHIVE_V2')||(plan.version==='PRESCORE_ARCHIVE_V1'&&plan.scope)||(plan.version==='PRESCORE_ARCHIVE_V2'&&!plan.scope)||plan.count!==plan.records.length||new Set(plan.records.map(r=>r.id)).size!==plan.count||plan.records.some(r=>!Number.isFinite(Date.parse(r.createdAt))||Date.parse(r.createdAt)>=Date.parse(plan.cutover))||fingerprint(plan.cutover,plan.records,plan.scope)!==plan.fingerprint)throw Error('ARCHIVE_PREVIEW_INVALID');
 if(plan.scope&&(plan.count!==plan.scope.analysisIds.length||plan.records.some(r=>!plan.scope.analysisIds.includes(r.id))))throw Error('ARCHIVE_PREVIEW_INVALID');
}
export async function executeArchive(pool:TransactionPool,plan:ArchivePlan){
 validatePlan(plan);const c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(6419818)');
  await c.query('LOCK TABLE analyses IN SHARE ROW EXCLUSIVE MODE');
  if(plan.scope)await c.query('LOCK TABLE agent_leads,agent_applications IN SHARE MODE');
  const previous=(await c.query('SELECT restored_at FROM analysis_archive_batches WHERE id=$1',[plan.fingerprint])).rows[0];
  if(previous){if(previous.restored_at)throw Error('ARCHIVE_BATCH_ALREADY_RESTORED');await verifyArchive(c,plan);await c.query('COMMIT');return {status:'ALREADY_ARCHIVED',count:plan.count,batch:plan.fingerprint};}
  const current=await previewArchive(c,plan.cutover,plan.scope);
  if(current.fingerprint!==plan.fingerprint)throw Error('ARCHIVE_PREVIEW_CHANGED');
  await c.query('INSERT INTO analysis_archive_batches(id,cutover_at,preview_hash,record_count) VALUES($1,$2,$3,$4)',[plan.fingerprint,plan.cutover,plan.fingerprint,plan.count]);
  const result=await c.query("UPDATE analyses SET archive_state='LEGACY_PREPRODUCTION',archived_at=$1,archive_batch_id=$2 WHERE id=ANY($3::text[]) AND archive_state='ACTIVE' AND created_at::timestamptz < $4::timestamptz"+(plan.scope?' AND owner_email=$5':''),[new Date().toISOString(),plan.fingerprint,plan.records.map(r=>r.id),plan.cutover,...(plan.scope?[plan.scope.ownerEmail]:[])]);
  if(result.rowCount!==plan.count)throw Error('ARCHIVE_COUNT_MISMATCH');
  await verifyArchive(c,plan);await c.query('COMMIT');return {status:'ARCHIVED',count:plan.count,batch:plan.fingerprint};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function verifyArchive(db:QueryExecutor,plan:ArchivePlan){
 validatePlan(plan);
 const rows=(await db.query("SELECT id,created_at,owner_email FROM analyses WHERE archive_batch_id=$1 AND archive_state='LEGACY_PREPRODUCTION' ORDER BY id",[plan.fingerprint])).rows;
 const records=rows.map(r=>({id:String(r.id),createdAt:String(r.created_at)}));
 if(fingerprint(plan.cutover,records,plan.scope)!==plan.fingerprint||plan.scope&&rows.some(r=>r.owner_email!==plan.scope!.ownerEmail))throw Error('ARCHIVE_VERIFICATION_FAILED');
 if(plan.scope)await assertNoBrokerLinks(db,plan.scope);
 else if((await db.query("SELECT id FROM analyses WHERE archive_state='ACTIVE' AND created_at::timestamptz < $1::timestamptz LIMIT 1",[plan.cutover])).rows.length)throw Error('ARCHIVE_PRE_CUTOVER_REMAINS');
 return {status:'VERIFIED',count:records.length,batch:plan.fingerprint,postCutoverIncluded:0};
}
export async function restoreArchive(pool:TransactionPool,batch:string){
 if(!/^[a-f0-9]{64}$/.test(batch))throw Error('ARCHIVE_BATCH_INVALID');const c=await pool.connect();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(6419818)');await c.query('LOCK TABLE analyses IN SHARE ROW EXCLUSIVE MODE');
  const row=(await c.query('SELECT record_count,restored_at FROM analysis_archive_batches WHERE id=$1 FOR UPDATE',[batch])).rows[0];
  if(!row)throw Error('ARCHIVE_BATCH_NOT_FOUND');
  if(row.restored_at){await c.query('COMMIT');return {status:'ALREADY_RESTORED'};}
  const result=await c.query("UPDATE analyses SET archive_state='ACTIVE',archived_at=NULL,archive_batch_id=NULL WHERE archive_batch_id=$1 AND archive_state='LEGACY_PREPRODUCTION'",[batch]);
  if(result.rowCount!==Number(row.record_count))throw Error('ARCHIVE_COUNT_MISMATCH');
  await c.query('UPDATE analysis_archive_batches SET restored_at=now() WHERE id=$1',[batch]);await c.query('COMMIT');return {status:'RESTORED',count:result.rowCount};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
