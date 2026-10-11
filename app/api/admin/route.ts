import { getRuntime } from '../../../lib/platform/runtime';
import { requireApiUser } from '../api-auth';
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
  if(q.resource==='overview')return adminJson({resource:q.resource,...await overview(db)});
  return adminJson({error:'Ресурс пока недоступен'},503);
 }catch{return adminJson({error:'Не удалось прочитать данные системы',code:'ADMIN_DATA_UNAVAILABLE'},503);}
}
export async function POST(){return adminJson({error:'Операция недоступна'},405);}
