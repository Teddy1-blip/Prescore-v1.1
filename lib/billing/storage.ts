import { randomUUID } from 'node:crypto';
import type { PortableDatabase, QueryExecutor } from '../db/compatibility.ts';
export type BillingDB=PortableDatabase;
export type Tx=QueryExecutor;
export async function rows<T=Record<string,unknown>>(tx:Tx,sql:string,values:unknown[]=[]){return (await tx.query(sql,values)).rows as T[];}
export async function first<T=Record<string,unknown>>(tx:Tx,sql:string,values:unknown[]=[]){return (await rows<T>(tx,sql,values))[0]??null;}
export async function transaction<T>(db:BillingDB,work:(tx:Tx)=>Promise<T>){const tx=await db.pool.connect();try{await tx.query('BEGIN');const result=await work(tx);await tx.query('COMMIT');return result;}catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}}
export async function lock(tx:Tx,key:string){await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);}
export async function audit(tx:Tx,type:string,id:string,action:string,actor:string,metadata:Record<string,unknown>={}){await tx.query('INSERT INTO audit_log(id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),type,id,action,actor==='PROVIDER'?'SYSTEM':'ADMIN',actor,JSON.stringify(metadata),new Date().toISOString()]);}
export async function ledger(tx:Tx,kind:string,paymentId:string|null,amount:number,key:string,reference:string,beneficiary:string|null=null){await tx.query('INSERT INTO billing_ledger(id,kind,payment_id,beneficiary_code,amount_minor,currency,reference_id,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,\'RUB\',$6,$7,$8) ON CONFLICT(idempotency_key) DO NOTHING',[randomUUID(),kind,paymentId,beneficiary,amount,reference,key,new Date().toISOString()]);}
export async function funnel(tx:Tx,owner:string,inn:string,order:string,event:string){await tx.query('INSERT INTO billing_funnel(id,owner_email,company_inn,order_id,event_type,created_at,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(idempotency_key) DO NOTHING',[randomUUID(),owner,inn,order,event,new Date().toISOString(),order+':'+event]);}
