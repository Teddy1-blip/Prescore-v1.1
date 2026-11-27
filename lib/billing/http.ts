import {randomUUID} from 'node:crypto';
import {BillingError} from './domain.ts';
export const billingHeaders={'Cache-Control':'private, no-store','Vary':'Cookie'};
export function billingResponse(value:unknown,status=200){return Response.json(value,{status,headers:billingHeaders});}
export function billingFailure(error:unknown){return billingResponse({error:error instanceof BillingError?error.message:'BILLING_UNAVAILABLE',diagnosticId:randomUUID()},error instanceof BillingError?error.status:503);}
export async function body(request:Request){const text=await request.text();if(text.length>16384)throw new BillingError('BODY_TOO_LARGE',413);let v:unknown;try{v=JSON.parse(text);}catch{throw new BillingError('INVALID_JSON');}if(!v||typeof v!=='object'||Array.isArray(v))throw new BillingError('INVALID_BODY');return v as Record<string,unknown>;}
