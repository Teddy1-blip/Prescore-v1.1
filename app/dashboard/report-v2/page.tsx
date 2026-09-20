import {notFound} from 'next/navigation';
import {ClientReportShell} from './client-report.tsx';
import {PrintReport} from './print-report.tsx';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import './report-v2.css';
export const dynamic='force-dynamic';
// Server-only, opt-in synthetic preview. Never reads client analyses or credentials.
export default async function ReportPreview({searchParams}:{searchParams:Promise<{sample?:string;print?:string}>}){
 if(process.env.PRESCORE_INTERNAL_REPORT_PREVIEW!=='1')notFound();
 const query=await searchParams;
 const fixtures=(await import('../../../tests/fixtures/client-report/preview-models.json')).default as unknown as Record<string,ClientReportModelV1>;
 const model=fixtures[query.sample??'healthy'];if(!model)notFound();
 return query.print==='1'?<PrintReport model={model}/>:<ClientReportShell model={model}/>;
}
