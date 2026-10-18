import {validateEnvironment} from '../../lib/platform/environment.ts';
import {getDatabase,getPool} from '../../lib/db/client.ts';
import {runPayoutWorker,settlementProvider} from '../../lib/billing/settlements.ts';
import {readiness} from '../../lib/release/readiness.ts';
import {migrate,migrationRegistry,safeOperationalCode} from '../../lib/release/migrations.ts';
import {randomUUID} from 'node:crypto';

const issues=validateEnvironment(process.env);
if(issues.length){
 console.error(JSON.stringify({event:'WORKER_STARTUP_REJECTED',code:'CONFIGURATION_INVALID',issues}));
 process.exit(1);
}

const once=process.argv.includes('--once');
const id=process.env.PRESCORE_WORKER_ID??randomUUID();
const pool=getPool();
let stopping=false,wake;
process.on('SIGTERM',()=>{stopping=true;wake?.();});
process.on('SIGINT',()=>{stopping=true;wake?.();});
const tick=Math.max(100,Math.min(60000,Number(process.env.WORKER_INTERVAL_MS)||5000));
const batch=Math.max(1,Math.min(50,Number(process.env.WORKER_BATCH_SIZE)||20));

try{
 await migrate(pool,await migrationRegistry());
 const status=await readiness(pool);
 if(!status.ready)throw Error(status.code);
 do{
  await pool.query("INSERT INTO runtime_workers(id,heartbeat_at,status,source_sha) VALUES($1,now(),'RUNNING',$2) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),status='RUNNING'",[id,process.env.PRESCORE_SOURCE_SHA??'UNKNOWN']);
  const heartbeat=setInterval(()=>pool.query('UPDATE runtime_workers SET heartbeat_at=now() WHERE id=$1',[id]).catch(()=>{stopping=true;wake?.();}),10000);
  try{
   const result=await runPayoutWorker(getDatabase(),settlementProvider(),batch);
   await pool.query('UPDATE runtime_workers SET processed=processed+$1,heartbeat_at=now() WHERE id=$2',[result.processed,id]);
   console.log(JSON.stringify({timestamp:new Date().toISOString(),level:'info',event:'OUTBOX_BATCH',workerId:id,...result}));
  }finally{
   clearInterval(heartbeat);
  }
  if(!once&&!stopping)await new Promise(resolve=>{
   const timer=setTimeout(()=>{wake=undefined;resolve();},tick);
   wake=()=>{clearTimeout(timer);resolve();};
  });
 }while(!once&&!stopping);
}catch(error){
 console.error(JSON.stringify({event:'WORKER_OPERATION_FAILED',workerId:id,code:safeOperationalCode(error)}));
 process.exitCode=1;
}finally{
 try{await pool.query("UPDATE runtime_workers SET status='STOPPED',heartbeat_at=now() WHERE id=$1",[id]);}catch{}
 await pool.end();
}
