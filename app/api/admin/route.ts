import {accessList,orderList,paymentList,product,auditList,aiUsage,systemStatus,mutateAdmin} from '../../../lib/admin/governance';
import {brokerList,applicationList,documentList,applicationDetail} from '../../../lib/admin/operations';
import { observeCanonical,fingerprintSQL } from '../../../lib/admin/observations';
import type { WorkspaceModelV1 } from '../../../lib/workspace/model';
import { getRuntime } from '../../../lib/platform/runtime';
import { requireApiUser } from '../api-auth';
import { companyList,analysisList,companyDetail,logicalOverview,activeApplicationCount } from '../../../lib/admin/companies';
import { GET as workspaceModel } from '../workspace-model/route';
import { safeMetadata,rows } from '../../../lib/admin/resources';
import { overview,parseAdminQuery } from '../../../lib/admin/resources';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0',Pragma:'no-cache',Vary:'Cookie, Authorization'};
export function adminJson(body:unknown,status=200){return Response.json(body,{status,headers});}
export async function GET(request:Request){
 const user=await requireApiUser();
 if(!user)return adminJson({error:'Требуется вход'},401);
 if(!user.isAdmin)return adminJson({error:'Доступ только администратору'},403);
 let q;try{q=parseAdminQuery(request.url);}catch{return adminJson({error:'Некорректные параметры запроса'},400);}
 try{
  const db=getRuntime().DB;
  if(q.resource==='overview'){const result=await overview(db);result.applicationStatuses=await logicalOverview(db);return adminJson({resource:q.resource,...result,summary:{...result.summary,activeApplications:await activeApplicationCount(db)}});}
  if(q.resource==='access')return adminJson(await accessList(db,q));
  if(q.resource==='orders')return adminJson(await orderList(db,q));
  if(q.resource==='payments')return adminJson(await paymentList(db,q));
  if(q.resource==='product')return adminJson(await product(db));
  if(q.resource==='audit')return adminJson(await auditList(db,q));
  if(q.resource==='ai')return adminJson(await aiUsage(db));
  if(q.resource==='system')return adminJson(await systemStatus(db));
  if(q.resource==='brokers')return adminJson(await brokerList(db,q));
  if(q.resource==='applications')return adminJson(await applicationList(db,q));
  if(q.resource==='documents')return adminJson(await documentList(db,q));
  if(q.resource==='application'){const detail=await applicationDetail(db,q);return detail?adminJson(detail):adminJson({error:'Заявка не найдена'},404);}
  if(q.resource==='companies')return adminJson(await companyList(db,q));
  if(q.resource==='analyses')return adminJson(await analysisList(db,q));
  if(q.resource==='company'){const detail=await companyDetail(db,q);if(!detail)return adminJson({error:'Компания не найдена'},404);detail.audit.items=detail.audit.items.map(r=>({...r,metadata:safeMetadata(r.metadata)}));return adminJson(detail);}
  if(q.resource==='canonical'){if(!q.analysisId)return adminJson({error:'Укажите analysisId'},400);const u=new URL(request.url);u.search='?analysisId='+encodeURIComponent(q.analysisId);const input=(await rows(db,`SELECT ${fingerprintSQL} AS fingerprint FROM analyses a WHERE a.id=?`,[q.analysisId]))[0];const response=await workspaceModel(new Request(u,{headers:request.headers}));const model=await response.clone().json() as WorkspaceModelV1;if(model.basic)await observeCanonical(db,model,String(input?.fingerprint??''));if(model.access)model.access={role:'ADMIN',readOnly:true};return adminJson(model,response.status);}
  return adminJson({error:'Ресурс пока недоступен'},503);
 }catch(error){if(error instanceof Error&&error.message==='INVALID_QUERY')return adminJson({error:'Некорректные параметры запроса'},400);return adminJson({error:'Не удалось прочитать данные системы',code:'ADMIN_DATA_UNAVAILABLE'},503);}
}
export async function POST(request:Request){
 const user=await requireApiUser();if(!user)return adminJson({error:'Требуется вход'},401);if(!user.isAdmin)return adminJson({error:'Доступ только администратору'},403);
 let body;try{const text=await request.text();if(text.length>4096)return adminJson({error:'Слишком большой запрос'},413);body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return adminJson({error:'Некорректный JSON'},400);}
 try{const result=await mutateAdmin(getRuntime().DB,body,user.email);return adminJson(result,result.status);}catch{return adminJson({error:'Не удалось сохранить изменение',code:'ADMIN_WRITE_UNAVAILABLE'},503);}
}
