import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser,unauthorized} from '../api-auth';
import {checkout,orderState} from '../../../lib/billing/payments';
import {paymentProvider} from '../../../lib/billing/providers';
import {billingFailure,billingResponse,body} from '../../../lib/billing/http';
export async function POST(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{return billingResponse(await checkout(getRuntime().DB,user.email,await body(request),paymentProvider()),201);}catch(e){return billingFailure(e);}}
export async function GET(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{return billingResponse(await orderState(getRuntime().DB,new URL(request.url).searchParams.get('orderId')??'',user.email));}catch(e){return billingFailure(e);}}
