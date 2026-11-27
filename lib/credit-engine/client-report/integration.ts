import type {ClientReportInputV1,ClientReportModelV1} from '../contracts/client-report.ts';
import {buildClientReportModel} from './adapter.ts';
// Optional preview-only integration seam. Production routes do not call this.
export function buildClientReportShadow(input:ClientReportInputV1,entitlement:'FREE'|'FULL'):{clientReportV1?:ClientReportModelV1;clientReportWarnings:string[]}{try{return {clientReportV1:buildClientReportModel(input,{entitlement}),clientReportWarnings:[]};}catch{return {clientReportWarnings:['CLIENT_REPORT_SHADOW_UNAVAILABLE']};}}
