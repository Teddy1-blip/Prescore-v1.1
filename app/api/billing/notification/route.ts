import {getRuntime} from '../../../../lib/platform/runtime';
import {activateSubscription} from '../../../../lib/billing/subscriptions';
import {notification} from '../../../../lib/billing/payments';
import {paymentProvider} from '../../../../lib/billing/providers';
import {billingFailure,body} from '../../../../lib/billing/http';
export async function POST(request:Request){try{await notification(getRuntime().DB,paymentProvider(),await body(request),activateSubscription);return new Response('OK',{status:200,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});}catch(e){return billingFailure(e);}}
