import { getChatGPTUser } from '../../../chatgpt-auth';
import { getRuntime } from '../../../../lib/platform/runtime';
import { CleanupError, guard, maintenance } from '../../../../lib/staging-cleanup';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  const user=await getChatGPTUser();
  guard(user,process.env,request.headers.get('origin'));
  const body=await request.json();
  const result=await maintenance(getRuntime().DB.pool,process.env.AUTH_SECRET!,body);
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof CleanupError?error.message:'MAINTENANCE_FAILED_NO_COMMIT'},{status:error instanceof CleanupError?error.status:500,headers:{'Cache-Control':'no-store'}});}
}
