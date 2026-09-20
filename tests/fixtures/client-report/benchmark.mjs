import {performance} from 'node:perf_hooks';
import {healthy,baseline,consumer,complete,presentationInput} from './builders.mjs';
import {buildClientReportModel} from '../../../lib/credit-engine/client-report/adapter.ts';
import {allFactors} from '../../../lib/credit-engine/client-report/validation.ts';
import {renderReport} from './render.mjs';
const input=presentationInput(baseline()),model=buildClientReportModel(input,{entitlement:'FULL'}),results={};
function measure(name,count,fn){const start=performance.now();for(let n=0;n<count;n++)fn();results[name]={iterations:count,totalMs:Math.round((performance.now()-start)*100)/100};}
measure('adapter',1000,()=>buildClientReportModel(input,{entitlement:'FULL'}));
measure('sectionTraversal',1000,()=>allFactors(model));
measure('webStaticRender',500,()=>renderReport(model));
measure('printStaticRender',100,()=>renderReport(model,true));
measure('completeCanonicalPipelineToPresentation',200,()=>buildClientReportModel(presentationInput(healthy()),{entitlement:'FULL'}));
const largeInput=presentationInput(complete(consumer(Array.from({length:120},(_,i)=>({subjectKey:'benchmark-'+i,effort:'LOW',priority:'P1_HIGH'}))))),large=buildClientReportModel(largeInput,{entitlement:'FULL'});
measure('largeBacklogModel',100,()=>buildClientReportModel(largeInput,{entitlement:'FULL'}));
results.largeBacklog={recommendations:large.recommendations.primary.length+large.recommendations.backlog.length,actions:large.actionPlan.horizons.reduce((n,h)=>n+h.items.length,0),initialWebBytes:Buffer.byteLength(renderReport(large)),completePrintBytes:Buffer.byteLength(renderReport(large,true))};
console.log(JSON.stringify(results,null,2));
