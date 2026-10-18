import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser,unauthorized} from '../api-auth';
import {first} from '../../../lib/billing/storage';
import {confirmCommercial} from '../../../lib/billing/settlements';
import {processState} from '../../../lib/billing/payments';
import {checkout,orderState} from '../../../lib/billing/payments';
import {clientBilling} from '../../../lib/billing/subscriptions';
import {consentVersions} from '../../../lib/billing/payments';
import {PLAN} from '../../../lib/billing/domain';
import {paymentProvider} from '../../../lib/billing/providers';
import {billingFailure,billingResponse,body} from '../../../lib/billing/http';
export async function POST(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{return billingResponse(await checkout(getRuntime().DB,user.email,await body(request),paymentProvider()),201);}catch(e){return billingFailure(e);}}
export async function GET(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{const q=new URL(request.url).searchParams;if(q.has('analysisId')){const data=await clientBilling(getRuntime().DB.pool,user.email,q.get('analysisId')??'');if(!data)return billingResponse({error:'ANALYSIS_NOT_OWNED'},403);return billingResponse({...data,plan:PLAN,consent:consentVersions(),provider:paymentProvider().name});}const db=getRuntime().DB,id=q.get('orderId')??'';await orderState(db,id,user.email);const p=await first<{provider_payment_id:string;provider:string;status:string}>(db.pool,'SELECT provider_payment_id,provider,status FROM billing_payments WHERE order_id=$1',[id]);const provider=paymentProvider();if(p?.provider_payment_id&&p.provider===provider.name&&provider.configured&&!['REFUNDED','SUCCEEDED','PARTIALLY_REFUNDED'].includes(p.status)){try{const state=await provider.getPaymentState(p.provider_payment_id);if(!state.orderId)state.orderId=id;await processState(db,provider,state,confirmCommercial);}catch{/* Pending page retains server state; provider unavailable does not grant access. */}}return billingResponse(await orderState(db,id,user.email));}catch(e){return billingFailure(e);}}
