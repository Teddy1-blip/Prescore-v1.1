import {rateLimit,operationalLog,correlationId,recordOperation} from '../../../../lib/release/security';
import {getRuntime} from '../../../../lib/platform/runtime';
import {confirmCommercial} from '../../../../lib/billing/settlements';
import {notification} from '../../../../lib/billing/payments';
import {paymentProvider} from '../../../../lib/billing/providers';
import {billingFailure,body} from '../../../../lib/billing/http';
export async function POST(request:Request){try{await notification(getRuntime().DB,paymentProvider(),await body(request),confirmCommercial);await recordOperation(getRuntime().DB.pool,'CALLBACK_ACCEPTED','OK').catch(()=>{});return new Response('OK',{status:200,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});}catch(e){const id=correlationId(request.headers.get('x-request-id'));operationalLog({event:'CALLBACK_REJECTED',result:'ERROR',correlationId:id});try{await recordOperation(getRuntime().DB.pool,'CALLBACK_REJECTED','REJECTED');const r=await rateLimit(getRuntime().DB.pool,'invalid-notification','global',60);if(!r.allowed)return Response.json({error:'RATE_LIMITED',diagnosticId:id},{status:429,headers:{'Retry-After':String(r.retryAfter)}});}catch{}return billingFailure(e);}}
