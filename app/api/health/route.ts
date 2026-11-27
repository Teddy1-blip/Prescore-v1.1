import {runtimeVersion} from '../../../lib/release/version';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){return Response.json({alive:true,version:runtimeVersion()},{headers:{'Cache-Control':'no-store'}});}
