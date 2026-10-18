import {createHash} from 'node:crypto';
import type {QueryExecutor,TransactionPool} from '../db/compatibility.ts';

export type ArchivePlan = {version:'PRESCORE_ARCHIVE_V1';cutover:string;records:{id:string;createdAt:string}[];count:number;fingerprint:string};
function cutoverUTC(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw Error('ARCHIVE_CUTOVER_INVALID');
 return value;
}
function fingerprint(cutover:string,records:ArchivePlan['records']){return createHash('sha256').update(JSON.stringify({cutover,records})).digest('hex');}
export async function previewArchive(db:QueryExecutor,cutover:string):Promise<ArchivePlan>{
 cutoverUTC(cutover);
 // A malformed persisted timestamp blocks the preview; it is never silently included.
 const hasArchive=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='analyses' AND column_name='archive_state'")).rows.length>0;
 const rows=(await db.query("SELECT id,created_at FROM analyses WHERE "+(hasArchive?"archive_state='ACTIVE' AND ":'')+"created_at::timestamptz < $1::timestamptz ORDER BY id",[cutover])).rows;
 const records=rows.map(r=>({id:String(r.id),createdAt:String(r.created_at)}));
 return {version:'PRESCORE_ARCHIVE_V1',cutover,records,count:records.length,fingerprint:fingerprint(cutover,records)};
}
function validatePlan(plan:ArchivePlan){
 cutoverUTC(plan.cutover);
 if(plan.version!=='PRESCORE_ARCHIVE_V1'||plan.count!==plan.records.length||new Set(plan.records.map(r=>r.id)).size!==plan.count||plan.records.some(r=>!Number.isFinite(Date.parse(r.createdAt))||Date.parse(r.createdAt)>=Date.parse(plan.cutover))||fingerprint(plan.cutover,plan.records)!==plan.fingerprint)throw Error('ARCHIVE_PREVIEW_INVALID');
}
export async function executeArchive(pool:TransactionPool,plan:ArchivePlan){
 validatePlan(plan);const c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(6419818)');
  await c.query('LOCK TABLE analyses IN SHARE ROW EXCLUSIVE MODE');
  const previous=(await c.query('SELECT restored_at FROM analysis_archive_batches WHERE id=$1',[plan.fingerprint])).rows[0];
  if(previous){if(previous.restored_at)throw Error('ARCHIVE_BATCH_ALREADY_RESTORED');await verifyArchive(c,plan);await c.query('COMMIT');return {status:'ALREADY_ARCHIVED',count:plan.count,batch:plan.fingerprint};}
  const current=await previewArchive(c,plan.cutover);
  if(current.fingerprint!==plan.fingerprint)throw Error('ARCHIVE_PREVIEW_CHANGED');
  await c.query('INSERT INTO analysis_archive_batches(id,cutover_at,preview_hash,record_count) VALUES($1,$2,$3,$4)',[plan.fingerprint,plan.cutover,plan.fingerprint,plan.count]);
  const result=await c.query("UPDATE analyses SET archive_state='LEGACY_PREPRODUCTION',archived_at=$1,archive_batch_id=$2 WHERE id=ANY($3::text[]) AND archive_state='ACTIVE' AND created_at::timestamptz < $4::timestamptz",[new Date().toISOString(),plan.fingerprint,plan.records.map(r=>r.id),plan.cutover]);
  if(result.rowCount!==plan.count)throw Error('ARCHIVE_COUNT_MISMATCH');
  await verifyArchive(c,plan);await c.query('COMMIT');return {status:'ARCHIVED',count:plan.count,batch:plan.fingerprint};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function verifyArchive(db:QueryExecutor,plan:ArchivePlan){
 validatePlan(plan);
 const rows=(await db.query("SELECT id,created_at FROM analyses WHERE archive_batch_id=$1 AND archive_state='LEGACY_PREPRODUCTION' ORDER BY id",[plan.fingerprint])).rows;
 const records=rows.map(r=>({id:String(r.id),createdAt:String(r.created_at)}));
 if(fingerprint(plan.cutover,records)!==plan.fingerprint)throw Error('ARCHIVE_VERIFICATION_FAILED');
 if((await db.query("SELECT id FROM analyses WHERE archive_state='ACTIVE' AND created_at::timestamptz < $1::timestamptz LIMIT 1",[plan.cutover])).rows.length)throw Error('ARCHIVE_PRE_CUTOVER_REMAINS');
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
