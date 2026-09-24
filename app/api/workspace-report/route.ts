import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser, readableAnalysis, unauthorized} from '../api-auth';
import {resolveAnalysisTier, type EntitlementDatabase} from '../../../lib/entitlements';
import {loadCanonicalReport} from '../../../lib/credit-engine/production/report-service.ts';
import type {CompanyProfileData} from '../../../lib/company-profile';
export const dynamic='force-dynamic';
// Read-only presentation transport. Same ownership/assignment and FULL boundary as report-v2.
// No schema setup, entitlement writes, source uploads or persisted report recalculation.
export async function GET(request:Request){
 const user=await requireApiUser();if(!user)return unauthorized();
 const id=new URL(request.url).searchParams.get('analysisId');if(!id)return Response.json({status:'NOT_FOUND'},{status:404});
 const db=getRuntime().DB as unknown as EntitlementDatabase;
 const result=await loadCanonicalReport(id,{
  readAccess:key=>readableAnalysis(db,key,user),
  readTier:(key,access)=>resolveAnalysisTier(db,{analysisId:key,userEmail:access.row.ownerEmail??'',companyInn:access.row.companyInn,privileged:user.isAdmin||access.access==='agent',readOnly:true}),
  readProfile:async inn=>{const row=await db.prepare('SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1').bind(inn).first<{payload:string}>();return row?JSON.parse(row.payload) as CompanyProfileData:undefined;},
 });
 return Response.json(result,{status:result.status==='NOT_FOUND'?404:200,headers:{'Cache-Control':'private, no-store'}});
}
