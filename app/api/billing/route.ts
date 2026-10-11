import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser,unauthorized} from '../api-auth';
import {checkout,orderState} from '../../../lib/billing/payments';
import {clientBilling} from '../../../lib/billing/subscriptions';
import {consentVersions} from '../../../lib/billing/payments';
import {PLAN} from '../../../lib/billing/domain';
import {paymentProvider} from '../../../lib/billing/providers';
import {billingFailure,billingResponse,body} from '../../../lib/billing/http';
export async function POST(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{return billingResponse(await checkout(getRuntime().DB,user.email,await body(request),paymentProvider()),201);}catch(e){return billingFailure(e);}}
export async function GET(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{const q=new URL(request.url).searchParams;if(q.has('analysisId')){const data=await clientBilling(getRuntime().DB.pool,user.email,q.get('analysisId')??'');if(!data)return billingResponse({error:'ANALYSIS_NOT_OWNED'},403);return billingResponse({...data,plan:PLAN,consent:consentVersions(),provider:paymentProvider().name});}return billingResponse(await orderState(getRuntime().DB,q.get('orderId')??'',user.email));}catch(e){return billingFailure(e);}}
