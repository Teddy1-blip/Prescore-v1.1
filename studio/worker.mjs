import {parentPort,workerData} from 'node:worker_threads';
import {runComparison} from './runtime.mjs';
try {parentPort.postMessage({run:runComparison(workerData.draft,workerData.owner)});}
catch(e){parentPort.postMessage({error:e.message});}
