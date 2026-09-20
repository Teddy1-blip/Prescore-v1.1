import {getPool}from'../../../lib/db/client';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){let database='unavailable';try{await getPool().query('SELECT 1');database='connected';}catch{/* Never expose connection details. */}return Response.json({status:database==='connected'?'ok':'degraded',database,version:process.env.PRESCORE_BUILD_VERSION||'standalone-migration'},{status:database==='connected'?200:503,headers:{'Cache-Control':'no-store'}});}
