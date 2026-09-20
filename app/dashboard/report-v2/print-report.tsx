import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import {ClientReportShell} from './client-report.tsx';
// Same presentation model; no second analytical pipeline.
export function PrintReport({model}:{model:ClientReportModelV1}){return <ClientReportShell model={model} print/>;}
