import {getDatabase,getPool} from '../../lib/db/client.ts';
import {runPayoutWorker,settlementProvider} from '../../lib/billing/settlements.ts';
// One bounded durable-outbox pass; external scheduler repeats this command. No HTTP/admin approval path.
try{console.log(JSON.stringify(await runPayoutWorker(getDatabase(),settlementProvider(),20)));}catch{console.error('BILLING_WORKER_FAILED');process.exitCode=1;}finally{await getPool().end();}
