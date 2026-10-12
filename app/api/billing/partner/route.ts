import {boundedPage} from '../../../../lib/release/pagination';
import {getRuntime} from '../../../../lib/platform/runtime';
import {requireApiUser,unauthorized} from '../../api-auth';
import {partnerBilling} from '../../../../lib/billing/partner-view';
import {billingFailure,billingResponse} from '../../../../lib/billing/http';
export async function GET(request:Request){const user=await requireApiUser();if(!user)return unauthorized();try{const data=await partnerBilling(getRuntime().DB.pool,user.email,boundedPage(request.url,50,20));return data?billingResponse(data):billingResponse({error:'PARTNER_ACCOUNT_REQUIRED'},403);}catch(e){return billingFailure(e);}}
