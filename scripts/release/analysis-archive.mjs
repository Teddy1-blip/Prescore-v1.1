import fs from 'node:fs/promises';
import {getPool} from '../../lib/db/client.ts';
import {verifySchema,migrationStatus,migrationRegistry} from '../../lib/release/migrations.ts';
import {previewArchive,executeArchive,verifyArchive,restoreArchive} from '../../lib/release/analysis-archive.ts';
const [action,arg,file]=process.argv.slice(2);let pool;
try{
 if(!['preview','execute','verify','restore'].includes(action)||!arg)throw Error('ARCHIVE_ARGUMENTS_REQUIRED');
 pool=getPool();
 if(action==='preview')await migrationStatus(pool,await migrationRegistry());else await verifySchema(pool);
 if(action==='preview'){
  if(!file)throw Error('ARCHIVE_PREVIEW_FILE_REQUIRED');
  const plan=await previewArchive(pool,arg);await fs.writeFile(file,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PREVIEW',count:plan.count,cutover:plan.cutover,fingerprint:plan.fingerprint,postCutoverIncluded:0,file}));
 }else if(action==='restore'){
  if(process.env.PRESCORE_ARCHIVE_CONFIRM!=='RESTORE_REVIEWED_BATCH')throw Error('ARCHIVE_CONFIRMATION_REQUIRED');
  console.log(JSON.stringify(await restoreArchive(pool,arg)));
 }else{
  const plan=JSON.parse(await fs.readFile(arg,'utf8'));
  if(action==='execute'&&process.env.PRESCORE_ARCHIVE_CONFIRM!=='SNAPSHOT_CONFIRMED_PREVIEW_REVIEWED')throw Error('ARCHIVE_CONFIRMATION_REQUIRED');
  console.log(JSON.stringify(await (action==='execute'?executeArchive(pool,plan):verifyArchive(pool,plan))));
 }
}catch(e){console.error(JSON.stringify({status:'FAILED',code:/^ARCHIVE_[A-Z_]+$/.test(e.message)?e.message:'ARCHIVE_OPERATION_FAILED'}));process.exitCode=1;}finally{await pool?.end();}
