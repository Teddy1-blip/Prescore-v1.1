import {confirmedReferralRows} from '../auth/broker-authorizations.ts';
import {createHash,randomUUID} from 'node:crypto';
import {applyRefund} from './refunds.ts';
import {BillingError,PLAN} from './domain.ts';
import {audit,first,funnel,ledger,lock,transaction,type BillingDB,type Tx} from './storage.ts';
import {mapProviderStatus,type PaymentProvider,type PaymentState} from './providers.ts';
export type Order={id:string;owner_email:string;company_inn:string;company_name:string;analysis_id:string;amount_minor:number;currency:string;status:string;broker_code:string|null;curator_code:string|null;source_channel:string;attribution_status:string;[key:string]:unknown};
export type Payment={id:string;order_id:string;provider:string;provider_payment_id:string|null;status:string;amount_minor:number;refunded_minor:number;confirmed_at:string|null;[key:string]:unknown};
export function consentVersions(){return {offer:process.env.BILLING_OFFER_VERSION??'',privacy:process.env.BILLING_PRIVACY_VERSION??''};}
export async function checkout(db:BillingDB,owner:string,input:Record<string,unknown>,provider:PaymentProvider){
 const versions=consentVersions();if(!versions.offer||!versions.privacy)throw new BillingError('LEGAL_VERSIONS_NOT_CONFIGURED',503);
 if(input.offerAccepted!==true||input.privacyAccepted!==true||input.offerVersion!==versions.offer||input.privacyVersion!==versions.privacy)throw new BillingError('CURRENT_ACCEPTANCE_REQUIRED');
 const analysisId=String(input.analysisId??''),key=String(input.idempotencyKey??'');if(!/^[A-Za-z0-9_-]{8,100}$/.test(key)||!analysisId||analysisId.length>100)throw new BillingError('INVALID_CHECKOUT');
 if(!provider.configured)throw new BillingError('PAYMENT_PROVIDER_UNAVAILABLE',503);
 const order=await transaction(db,async tx=>{
  const a=await first<{company_inn:string;company_name:string}>(tx,'SELECT company_inn,company_name FROM analyses WHERE id=$1 AND owner_email=$2',[analysisId,owner]);if(!a)throw new BillingError('ANALYSIS_NOT_OWNED',403);if(!/^(?:\d{10}|\d{12})$/.test(a.company_inn))throw new BillingError('COMPANY_INN_REQUIRED');
  await lock(tx,'checkout:'+owner+':'+a.company_inn);
  const existing=await first<Order>(tx,'SELECT * FROM billing_orders WHERE owner_email=$1 AND idempotency_key=$2',[owner,key]);if(existing){if(existing.company_inn!==a.company_inn||existing.analysis_id!==analysisId)throw new BillingError('IDEMPOTENCY_CONFLICT',409);return existing;}
  const open=await first<Order>(tx,"SELECT * FROM billing_orders WHERE owner_email=$1 AND company_inn=$2 AND status IN ('CREATED','PAYMENT_PENDING','UNKNOWN_REVIEW')",[owner,a.company_inn]);if(open)return open;
  const brokers=await confirmedReferralRows(tx,owner,a.company_inn);
  if(brokers.rows.length>1)throw new BillingError('ATTRIBUTION_NEEDS_REVIEW',409);
  const broker=brokers.rows[0]?.agent_code as string|null??null;let curator=brokers.rows[0]?.curator_code as string|null??null;
  if(curator===broker)curator=null;
  if(curator&&!await first(tx,"SELECT aa.agent_code FROM agent_accounts aa LEFT JOIN agent_partners ap ON ap.agent_code=aa.agent_code WHERE aa.agent_code=$1 AND (ap.status IS NULL OR ap.status NOT IN ('BLOCKED','Заблокирован'))",[curator]))curator=null;
  const id=randomUUID(),now=new Date().toISOString();const channel=curator?'curator network':broker?'broker':'direct';
  await tx.query(`INSERT INTO billing_orders(id,order_number,owner_email,company_inn,company_name,analysis_id,plan_code,plan_version,amount_minor,currency,status,source_channel,attribution_status,broker_code,curator_code,offer_version,privacy_version,accepted_at,created_at,expires_at,updated_at,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'RUB','CREATED',$10,'VALID',$11,$12,$13,$14,$15,$15,$16,$15,$17)`,[id,'PS-'+id.slice(0,8).toUpperCase(),owner,a.company_inn,a.company_name,analysisId,PLAN.code,PLAN.version,PLAN.amountMinor,channel,broker,curator,versions.offer,versions.privacy,now,new Date(Date.now()+86400000).toISOString(),key]);
  await tx.query(`INSERT INTO billing_payments(id,order_id,provider,raw_status,status,amount_minor,currency,created_at,updated_at,idempotency_key) VALUES($1,$2,$3,'NOT_INITIALIZED','CREATED',$4,'RUB',$5,$5,$6)`,[randomUUID(),id,provider.name,PLAN.amountMinor,now,id+':init']);
  await funnel(tx,owner,a.company_inn,id,'CHECKOUT_OPENED');await funnel(tx,owner,a.company_inn,id,'ORDER_CREATED');
  return (await first<Order>(tx,'SELECT * FROM billing_orders WHERE id=$1',[id]))!;
 });
 await initialize(db,order.id,provider);return orderState(db,order.id,owner);
}
export async function initialize(db:BillingDB,id:string,provider:PaymentProvider){await transaction(db,async tx=>{
 await lock(tx,'payment-init:'+id);const p=(await first<Payment>(tx,'SELECT * FROM billing_payments WHERE order_id=$1 FOR UPDATE',[id]))!;
 if(p.provider!==provider.name)throw new BillingError('PROVIDER_MISMATCH');if(p.provider_payment_id||p.status!=='CREATED')return;
 // Durable reservation commits before external request. Unknown results are NEVER blindly retried.
 await tx.query("UPDATE billing_payments SET status='PROCESSING',raw_status='INITIALIZING',updated_at=now() WHERE id=$1",[p.id]);
 });
 const reserved=await transaction(db,async tx=>{await lock(tx,'dispatch-init:'+id);const p=(await first<Payment>(tx,'SELECT * FROM billing_payments WHERE order_id=$1 FOR UPDATE',[id]))!;if(p.provider_payment_id||p.raw_status!=='INITIALIZING')return false;await tx.query("UPDATE billing_payments SET raw_status='DISPATCH_RESERVED' WHERE id=$1",[p.id]);return true;});if(!reserved)return;
 try{const state=await provider.createPayment({orderId:id,amountMinor:PLAN.amountMinor,currency:'RUB',idempotencyKey:id+':init'});await transaction(db,async tx=>{const p=(await first<Payment>(tx,'SELECT * FROM billing_payments WHERE order_id=$1 FOR UPDATE',[id]))!;if(p.confirmed_at)return;if(state.orderId!==id||state.amountMinor!==p.amount_minor||state.currency!=='RUB')throw new BillingError('PROVIDER_MAPPING_MISMATCH');await tx.query('UPDATE billing_payments SET provider_payment_id=$1,payment_url=$2,raw_status=$3,status=$4,updated_at=now() WHERE id=$5',[state.providerPaymentId,state.paymentUrl??null,state.rawStatus,mapProviderStatus(state.rawStatus),p.id]);await tx.query("UPDATE billing_orders SET status='PAYMENT_PENDING',updated_at=now() WHERE id=$1",[id]);const o=(await first<Order>(tx,'SELECT * FROM billing_orders WHERE id=$1',[id]))!;await funnel(tx,o.owner_email,o.company_inn,id,'PAYMENT_INITIALIZED');});}
 catch{await transaction(db,async tx=>{await tx.query("UPDATE billing_payments SET status='UNKNOWN_REVIEW',raw_status='INIT_RESULT_UNKNOWN',updated_at=now() WHERE order_id=$1 AND provider_payment_id IS NULL",[id]);await tx.query("UPDATE billing_orders SET status='UNKNOWN_REVIEW',updated_at=now() WHERE id=$1 AND status='CREATED'",[id]);});}
}
export async function orderState(db:BillingDB,id:string,owner:string){const row=await first(db.pool,`SELECT o.id,o.order_number,o.company_inn,o.company_name,o.analysis_id,o.amount_minor,o.currency,o.status,o.created_at,p.status AS payment_status,p.payment_url,p.confirmed_at,p.refunded_minor FROM billing_orders o JOIN billing_payments p ON p.order_id=o.id WHERE o.id=$1 AND o.owner_email=$2`,[id,owner]);if(!row)throw new BillingError('ORDER_NOT_FOUND',404);return row;}
export type Confirmation=(tx:Tx,p:Payment,o:Order,now:string)=>Promise<void>;
export async function processState(db:BillingDB,provider:PaymentProvider,state:PaymentState,onSuccess?:Confirmation){return transaction(db,async tx=>{
 const o=await first<Order>(tx,'SELECT * FROM billing_orders WHERE id=$1',[state.orderId]);if(!o)throw new BillingError('PAYMENT_MAPPING_INVALID');await lock(tx,'company:'+o.owner_email+':'+o.company_inn);
 const p=await first<Payment>(tx,'SELECT * FROM billing_payments WHERE order_id=$1 FOR UPDATE',[o.id]);if(!p||p.provider!==provider.name||p.amount_minor!==state.amountMinor||state.currency!=='RUB'||(p.provider_payment_id&&p.provider_payment_id!==state.providerPaymentId))throw new BillingError('PAYMENT_MAPPING_INVALID');
 const status=mapProviderStatus(state.rawStatus);if(status==='SUCCEEDED'&&!state.success)throw new BillingError('PAYMENT_SUCCESS_MISMATCH');
 const fingerprint=createHash('sha256').update(JSON.stringify([provider.name,state.providerPaymentId,state.rawStatus,state.amountMinor,state.refundedMinor??null])).digest('hex');
 if(await first(tx,'SELECT id FROM billing_events WHERE fingerprint=$1',[fingerprint]))return {duplicate:true};
 const now=new Date().toISOString();await tx.query('INSERT INTO billing_events(id,provider,provider_payment_id,fingerprint,raw_status,safe_payload,received_at,processed_at,result) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8)',[randomUUID(),provider.name,state.providerPaymentId,fingerprint,state.rawStatus,JSON.stringify({orderId:o.id,amountMinor:state.amountMinor,currency:state.currency,status}),now,'PROCESSED']);
 if(['SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED'].includes(p.status)&&!['PARTIALLY_REFUNDED','REFUNDED'].includes(status))return {ignored:true};
 if(['PARTIALLY_REFUNDED','REFUNDED'].includes(status)){
 if(!p.confirmed_at)throw new BillingError('REFUND_BEFORE_CONFIRMATION');
 const cumulative=status==='REFUNDED'?p.amount_minor:state.refundedMinor;
 if(cumulative===undefined){await tx.query("UPDATE billing_events SET result='REFUND_REQUIRES_RECONCILIATION' WHERE fingerprint=$1",[fingerprint]);await tx.query("UPDATE billing_payments SET raw_status=$1,updated_at=now() WHERE id=$2",[state.rawStatus,p.id]);return {refundReview:true};}
 if(cumulative<p.refunded_minor)return {ignored:true};await applyRefund(tx,p,o,cumulative,fingerprint);
 const matched=await tx.query("UPDATE billing_refunds SET status='SUCCEEDED',cumulative_minor=$1,confirmed_at=now() WHERE payment_id=$2 AND status IN ('PROCESSING','UNKNOWN_REVIEW') AND amount_minor=$3 RETURNING id",[cumulative,p.id,cumulative-p.refunded_minor]);
 if(matched.rows.length)return {status};
 await tx.query("INSERT INTO billing_refunds(id,payment_id,amount_minor,cumulative_minor,status,reason,created_at,confirmed_at,idempotency_key) SELECT $1,$2,$3,$4,'SUCCEEDED','Provider notification',now(),now(),$5 WHERE $3::bigint>0 ON CONFLICT(idempotency_key) DO NOTHING",[randomUUID(),p.id,cumulative-p.refunded_minor,cumulative,fingerprint]);return {status};
 }
 await tx.query('UPDATE billing_payments SET provider_payment_id=$1,raw_status=$2,status=$3,confirmed_at=CASE WHEN $3=\'SUCCEEDED\' THEN $4::timestamptz ELSE confirmed_at END,failed_at=CASE WHEN $3=\'FAILED\' THEN $4::timestamptz ELSE failed_at END,updated_at=$4 WHERE id=$5',[state.providerPaymentId,state.rawStatus,status,now,p.id]);
 await tx.query('UPDATE billing_orders SET status=$1,updated_at=$2 WHERE id=$3',[status==='SUCCEEDED'?'PAID':status==='FAILED'||status==='CANCELLED'?'CANCELLED':status==='UNKNOWN_REVIEW'?'UNKNOWN_REVIEW':'PAYMENT_PENDING',now,o.id]);
 if(status==='SUCCEEDED'){await ledger(tx,'GROSS_PAYMENT',p.id,p.amount_minor,p.id+':gross',o.id);await funnel(tx,o.owner_email,o.company_inn,o.id,'PAYMENT_CONFIRMED');if(onSuccess)await onSuccess(tx,p,o,now);}
 await audit(tx,'BILLING_PAYMENT',p.id,status,'PROVIDER',{amountMinor:p.amount_minor,status});return {status};
 });}
export async function notification(db:BillingDB,provider:PaymentProvider,input:Record<string,unknown>,onSuccess?:Confirmation){try{return await processState(db,provider,provider.verifyNotification(input),onSuccess);}catch(e){if(e instanceof BillingError){await transaction(db,tx=>audit(tx,'BILLING_SECURITY','notification','REJECTED_NOTIFICATION','PROVIDER',{code:e.message}));}throw e;}}
