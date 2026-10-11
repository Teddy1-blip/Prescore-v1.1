export const PLAN = Object.freeze({code:'PRESCORE_COMPANY_30D',name:'FULL · одна компания / один ИНН / 30 дней',amountMinor:650000,currency:'RUB',durationDays:30,version:'1',active:true});
export const COMMISSION_POLICY = '1';
export class BillingError extends Error { status:number; constructor(code:string,status=400){super(code);this.status=status;} }
export function minor(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<0)throw new BillingError('INVALID_MONEY');return Number(value);}
export function portion(amount:number,bps:number){return Number(BigInt(minor(amount))*BigInt(bps)/BigInt(10000));}
export function dayEnd(start:string,days=30){const date=new Date(start);date.setUTCDate(date.getUTCDate()+days);return date.toISOString();}
export function periodStart(confirmedAt:string,currentEnd?:string|null){return currentEnd&&Date.parse(currentEnd)>Date.parse(confirmedAt)?new Date(currentEnd).toISOString():new Date(confirmedAt).toISOString();}
export function subscriptionState(until:string|null,now=new Date()){return !until?'PENDING':Date.parse(until)<=now.getTime()?'EXPIRED':Date.parse(until)-now.getTime()<=7*86400000?'EXPIRING':'ACTIVE';}
export const LEGACY_POLICY = Object.freeze({source:'LEGACY',liveTBank:false,readOnly:true,paidAccess:'Existing explicit analysis_entitlements preserved; dated legacy subscription evaluated read-only, never converted into perpetual grants.'});
