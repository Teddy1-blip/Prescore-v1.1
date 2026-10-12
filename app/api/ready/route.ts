import {getPool} from '../../../lib/db/client';import {readiness} from '../../../lib/release/readiness';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){let result;try{result=await readiness(getPool());}catch{result={ready:false,code:'DATABASE_UNAVAILABLE'};}return Response.json(result,{status:result.ready?200:503,headers:{'Cache-Control':'no-store'}});}
