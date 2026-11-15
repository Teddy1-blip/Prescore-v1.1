import type {PrintBankingV1} from '../../../lib/workspace/print-banking.ts';
import {checkoStatusText} from '../../../lib/external/checko-summary.ts';
import type {DossierReport} from '../../../lib/workspace/dossier-report';
import {DossierSettlementBalances} from '../../components/workspace/dossier-settlement-balances.tsx';
import {ReportDownload} from './report-download.tsx';
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
export function PrintReport({model,realAnalysisId,banking,appendix}:{appendix?:DossierReport;model:ClientReportModelV1;realAnalysisId?:string;banking?:PrintBankingV1|null}){
 const full=model.meta.entitlement==='FULL';
 const presentation=printPresentation(model);
 if(full&&banking)presentation.sources=presentation.sources.map(s=>({...s,period:banking.sourcePeriods[s.id]?.join('; ')??s.period}));
 return <>{full&&realAnalysisId&&<ReportDownload report={{inn:model.company.inn,decision:presentation,banking,dossier:appendix}}/>}<ClientReportShell model={presentation} realAnalysisId={realAnalysisId} print/>{full&&model.checko&&<section><h2>Открытые сведения · Checko</h2><p>{checkoStatusText(model.checko.status, model.company.inn)}{model.checko.fetchedAt && ' · '+model.checko.fetchedAt.slice(0,10)}</p><dl>{model.checko.rows.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></section>}{full&&banking&&<BankingAppendix banking={banking}/>}<SourceAppendix model={model}/>
 {appendix&&<section className="cr-report cr-source-appendix"><h2>Документы досье на момент выпуска</h2>
 {appendix.settlements?.length?<DossierSettlementBalances rows={appendix.settlements}/>:null}
 {appendix.sources.map(s=><p key={s.id}>{s.name} · {s.received.slice(0,10)}</p>)}</section>}<div className="ex-print"><ExpertiseMemo model={model} print/></div>{full && model.meta.snapshot && <footer>Версия расчёта <code style={{overflowWrap:"anywhere"}}>{model.meta.snapshot.snapshotId}</code></footer>}</>;
}
