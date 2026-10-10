import {getPool}from'../../../lib/db/client';
import {PURGE_MARKER,purgeOldStagingHistory}from'../../../lib/staging-history-purge';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){let database='unavailable';let purge:{status:string;reason?:string;deleted?:Record<string,number>}={status:'not-run'};try{await getPool().query('SELECT 1');database='connected';purge=await purgeOldStagingHistory();}catch{/* Never expose connection details. */}return Response.json({status:database==='connected'?'ok':'degraded',database,purge,maintenanceMarker:PURGE_MARKER,version:process.env.PRESCORE_BUILD_VERSION||'standalone-migration'},{status:database==='connected'?200:503,headers:{'Cache-Control':'no-store'}});}
