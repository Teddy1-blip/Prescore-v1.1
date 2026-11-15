import {getAuthSession} from '../../../../lib/auth/server';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(req:Request,ctx:{params:Promise<{asset?:string[]}>}) {
  if(process.env.NODE_ENV!=='development'||process.env.PRESCORE_STUDIO_INTERNAL!=='1')return new Response(null,{status:404});
  const session=await getAuthSession(req.headers);
  if(!session?.user.roles.includes('ADMIN'))return new Response(null,{status:403});
  const route=((await ctx.params).asset??[]).join('/');
  // Dev-only native ESM keeps the worker, fixture files and atlas outside Next's public bundles.
  const load=createRequire(path.join(process.cwd(),'package.json'));
  const {studioResponse}=load(path.join(process.cwd(),'studio/service.mjs'));
  return studioResponse(req,route,session.user,process.env.STUDIO_DATA_DIR||path.join(os.homedir(),'.prescore-studio-v01'));
}
export {handle as GET,handle as POST};
