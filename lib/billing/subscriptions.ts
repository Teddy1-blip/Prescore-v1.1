import {randomUUID} from 'node:crypto';
import {dayEnd,periodStart,subscriptionState} from './domain.ts';
import {first,rows,funnel,type Tx} from './storage.ts';
import type {Order,Payment} from './payments.ts';
export async function activateSubscription(tx:Tx,p:Payment,o:Order,confirmedAt:string){
 let subscription=await first<{id:string;access_until:string|null}>(tx,'SELECT id,access_until FROM billing_subscriptions WHERE owner_email=$1 AND company_inn=$2 FOR UPDATE',[o.owner_email,o.company_inn]);
 if(!subscription){const id=randomUUID();await tx.query("INSERT INTO billing_subscriptions(id,owner_email,company_inn,company_name,plan_code,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'PENDING',$6,$6)",[id,o.owner_email,o.company_inn,o.company_name,o.plan_code,confirmedAt]);subscription={id,access_until:null};}
 if(await first(tx,'SELECT id FROM billing_periods WHERE payment_id=$1',[p.id]))return;
 const startsAt=periodStart(confirmedAt,subscription.access_until),endsAt=dayEnd(startsAt);
 await tx.query("INSERT INTO billing_periods(id,subscription_id,payment_id,order_id,starts_at,ends_at,original_ends_at,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$6,'ACTIVE',$7)",[randomUUID(),subscription.id,p.id,o.id,startsAt,endsAt,confirmedAt]);
 await tx.query("UPDATE billing_subscriptions SET status='ACTIVE',access_from=COALESCE(access_from,$1),access_until=$2,updated_at=$3 WHERE id=$4",[startsAt,endsAt,confirmedAt,subscription.id]);
 await funnel(tx,o.owner_email,o.company_inn,o.id,'FULL_ACTIVATED');
 const count=await first<{n:number}>(tx,'SELECT COUNT(*) AS n FROM billing_periods WHERE subscription_id=$1',[subscription.id]);if(Number(count?.n)>1)await funnel(tx,o.owner_email,o.company_inn,o.id,'RENEWAL_PURCHASED');
}
export async function clientBilling(tx:Tx,owner:string,analysisId:string){
 const a=await first<{company_inn:string;company_name:string}>(tx,'SELECT company_inn,company_name FROM analyses WHERE id=$1 AND owner_email=$2',[analysisId,owner]);if(!a)return null;
 const sub=await first<{access_until:string|null;status:string;[key:string]:unknown}>(tx,'SELECT id,company_inn,company_name,plan_code,status,access_from,access_until FROM billing_subscriptions WHERE owner_email=$1 AND company_inn=$2',[owner,a.company_inn]);
 const manual=await first<{tier:string;granted_by:string}>(tx,"SELECT tier,granted_by FROM analysis_entitlements WHERE analysis_id=$1 AND user_email=$2 AND revoked_at=''",[analysisId,owner]);
 const subscription=sub?{...sub,status:sub.status==='CANCELLED'?'CANCELLED':subscriptionState(sub.access_until),daysRemaining:sub.access_until?Math.max(0,Math.ceil((new Date(sub.access_until).getTime()-Date.now())/86400000)):0}:null;
 const active=subscription&&['ACTIVE','EXPIRING'].includes(subscription.status);
 const previewStart=periodStart(new Date().toISOString(),active?sub?.access_until??null:null);
 return {company:a,subscription,nextPeriod:{starts_at:previewStart,ends_at:dayEnd(previewStart)},source:active?'COMPANY_SUBSCRIPTION':manual?.tier==='FULL'?'ANALYSIS_GRANT':'BASIC',tier:active||manual?.tier==='FULL'?'FULL':'BASIC',history:await rows(tx,`SELECT o.id,o.order_number,o.created_at,o.amount_minor,o.currency,o.status,p.status AS payment_status,p.refunded_minor,sp.starts_at,sp.ends_at FROM billing_orders o JOIN billing_payments p ON p.order_id=o.id LEFT JOIN billing_periods sp ON sp.payment_id=p.id WHERE o.owner_email=$1 AND o.company_inn=$2 ORDER BY o.created_at DESC LIMIT 50`,[owner,a.company_inn])};
}
