import type {PrintBankingV1} from '../../../lib/workspace/print-banking.ts';
import {checkoLabels} from '../../../lib/external/checko-summary.ts';
import {BankingAppendix} from './banking-appendix.tsx';
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
export function PrintReport({model,realAnalysisId,banking}:{model:ClientReportModelV1;realAnalysisId?:string;banking?:PrintBankingV1|null}){
 const full=model.meta.entitlement==='FULL';
 const presentation=printPresentation(model);
 if(full&&banking)presentation.sources=presentation.sources.map(s=>({...s,period:banking.sourcePeriods[s.id]?.join('; ')??s.period}));
 return <>{full&&model.checko&&<section><h2>Открытые сведения · Checko</h2><p>{checkoLabels[model.checko.status]} · {model.checko.fetchedAt?.slice(0,10)}</p><dl>{model.checko.rows.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></section>}<ClientReportShell model={presentation} realAnalysisId={realAnalysisId} print/>{full&&banking&&<BankingAppendix banking={banking}/>}<SourceAppendix model={model}/><div className="ex-print"><ExpertiseMemo model={model} print/></div>{full && model.meta.snapshot && <footer>Версия расчёта <code style={{overflowWrap:"anywhere"}}>{model.meta.snapshot.snapshotId}</code></footer>}</>;
}
