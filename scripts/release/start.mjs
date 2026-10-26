import {spawn} from 'node:child_process';
import {classifyStartupFailure,startupFailureDetails,safeStartupReport,startStartupDiagnosticServer} from './startup-diagnostic.mjs';

const isStaging=process.env.PRESCORE_RUNTIME_MODE==='release-candidate';
const address={host:process.env.HOSTNAME??'0.0.0.0',port:Number(process.env.PORT??'3000')};

async function preflight(){
 let pool,stage='BOOTSTRAP',step;
 try{
  stage='CONFIGURATION';
  step='ENVIRONMENT_IMPORT';
  const {validateEnvironment}=await import('../../lib/platform/environment.ts');
  step='ENVIRONMENT_VALIDATE';
  const issues=validateEnvironment(process.env);
  if(issues.length)return {ready:false,stage,step,code:'CONFIGURATION_INVALID',issues};
  stage='DATABASE_MIGRATION';
  step='DB_CLIENT_IMPORT';
  const {getPool}=await import('../../lib/db/client.ts');
  step='MIGRATIONS_IMPORT';
  const {migrate,migrationRegistry:readMigrationRegistry}=await import('../../lib/release/migrations.ts');
  step='READINESS_IMPORT';
  const {readiness}=await import('../../lib/release/readiness.ts');
  step='POOL_CREATE';
  pool=getPool();
  // Keep the canonical migration call intact; label registry errors separately.
  const migrationRegistry=async()=>{
   step='MIGRATION_REGISTRY';
   const registry=await readMigrationRegistry();
   step='MIGRATION_APPLY';
   return registry;
  };
  await migrate(pool,await migrationRegistry());
  stage='READINESS';
  step='READINESS_CHECK';
  const check=await readiness(pool);
  if(!check.ready)return {ready:false,stage,step,code:check.code};
  return {ready:true};
 }catch(error){
  let fallback='OPERATION_FAILED';
  try{const {safeOperationalCode}=await import('../../lib/release/migrations.ts');fallback=safeOperationalCode(error);}catch{}
  return {ready:false,stage,step,code:classifyStartupFailure(error,fallback),...startupFailureDetails(error)};
 }finally{
  if(pool){try{await pool.end();}catch{console.error('STARTUP_POOL_CLOSE_FAILED');}}
 }
}

async function rejectStartup(details){
 const report=safeStartupReport(details);
 console.error(JSON.stringify({event:'STARTUP_REJECTED',...report}));
 if(!isStaging){process.exitCode=1;return;}
 try{
  await startStartupDiagnosticServer(report,address);
  console.log(JSON.stringify({event:'STAGING_DIAGNOSTICS_LISTENING',releaseId:'PRESCORE-V1-RC3-20261019',port:address.port}));
 }catch{
  console.error(JSON.stringify({event:'STAGING_DIAGNOSTICS_FAILED',code:'LISTENER_UNAVAILABLE'}));
  process.exitCode=1;
 }
}

const result=await preflight();
if(!result.ready){
 await rejectStartup(result);
}else{
 const child=spawn(process.execPath,['server.js'],{
  cwd:process.env.PRESCORE_STANDALONE_DIR??process.cwd(),
  stdio:'inherit',
  env:{...process.env,PRESCORE_PROCESS_ROLE:'app'},
 });
 let stopping=false,diagnosing=false;
 function stop(){
  if(stopping)return;
  stopping=true;
  child.kill('SIGTERM');
  const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
  timer.unref();
 }
 process.on('SIGTERM',stop);
 process.on('SIGINT',stop);
 async function childFailed(){
  if(stopping||diagnosing)return;
  diagnosing=true;
  await rejectStartup({stage:'NEXT_SERVER',code:'APP_PROCESS_EXITED'});
 }
 child.on('exit',(code,signal)=>{
  if(stopping){process.exitCode=signal!=='SIGKILL'?0:1;return;}
  if(isStaging)void childFailed();
  else process.exitCode=code??(signal?1:0);
 });
 child.on('error',()=>{
  console.error('APP_PROCESS_FAILED');
  if(isStaging)void childFailed();
  else process.exitCode=1;
 });
}
