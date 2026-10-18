import {publicText} from '../../../lib/credit-engine/client-report/copy.ts';
import {SourceAppendix} from './source-appendix.tsx';
import {ExpertiseMemo} from './expertise.tsx';
import type {ClientReportModelV1,PresentationFactorV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import {ClientReportShell} from './client-report.tsx';
// Print each semantically identical limitation once; retain the original model unchanged.
export function printPresentation(model:ClientReportModelV1):ClientReportModelV1{
 const copy=(v:unknown):unknown=>typeof v==='string'?publicText(v):Array.isArray(v)?v.map(copy):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,copy(x)])):v;
 model=copy(model) as ClientReportModelV1;
 const seen=new Set<string>();
 const once=(items:PresentationFactorV1[])=>items.filter(f=>{const key=(f.title+'|'+f.text+'|'+f.status.tone).trim().toLocaleLowerCase('ru');if(seen.has(key))return false;seen.add(key);return true;});
 const primaryFactors=once(model.primaryFactors),contextHighlights=once(model.contextHighlights),capacity={...model.capacity,details:once(model.capacity.details)},dataQuality=once(model.dataQuality),limitations=once(model.limitations),readiness={...model.readiness,constraints:once(model.readiness.constraints)},detailedSections=model.detailedSections.map(s=>({...s,factors:once(s.factors)}));
 return {...model,primaryFactors,contextHighlights,capacity,dataQuality,limitations,readiness,detailedSections};
}
// Same presentation model; no second analytical pipeline.
export function PrintReport({model,realAnalysisId}:{model:ClientReportModelV1;realAnalysisId?:string}){return <><ClientReportShell model={printPresentation(model)} realAnalysisId={realAnalysisId} print/><SourceAppendix model={model}/><div className="ex-print"><ExpertiseMemo model={model} print/></div></>;}
