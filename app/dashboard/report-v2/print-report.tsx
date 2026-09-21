import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import {ClientReportShell} from './client-report.tsx';
// Same presentation model; no second analytical pipeline.
export function PrintReport({model,realAnalysisId}:{model:ClientReportModelV1;realAnalysisId?:string}){return <ClientReportShell model={model} realAnalysisId={realAnalysisId} print/>;}
