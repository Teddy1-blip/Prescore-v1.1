import {analyzeCalendarCoverage} from '../source-foundation.ts';
import type {AnalysisSourceManifest} from '../contracts/sources.ts';
import type {BankStatementMetricsV2} from '../contracts/metrics.ts';
import type {MonthCoverageStatus,SourceEnvelope} from '../contracts/sources.ts';
export function bankCoverageGaps(a:{metricsV2?:BankStatementMetricsV2;sourceManifest?:AnalysisSourceManifest}) {
  const issues=(a.metricsV2?.monthly??[]).filter(m=>m.coverage!=='FULL');
  const accounts=new Map<string,SourceEnvelope[]>();
  for(const s of a.sourceManifest?.bankStatements??[]) {
    const entries=s.accountCoverage?.length?s.accountCoverage:[{account:'',periodFrom:s.periodFrom,periodTo:s.periodTo}];
    for(const account of entries) {
      const key=account.account||s.sourceId;
      const list=accounts.get(key)??[];
      list.push({...s,accountCoverage:undefined,periodFrom:account.periodFrom,periodTo:account.periodTo});
      accounts.set(key,list);
    }
  }
  const gaps:Array<{month:string;bank:string;account:string|null;status:MonthCoverageStatus;sourceIds:string[]}>=[];
  for(const [account,sources] of accounts) {
    const calendar=analyzeCalendarCoverage(sources);
    for(const issue of issues) {
      const row=calendar.find(m=>m.month===issue.month);
      const status=row?.status??'MISSING';
      if(status!=='FULL') gaps.push({month:issue.month,bank:[...new Set(sources.map(s=>s.sourceName||'Банк выписки'))].join(', '),
        account:/^\d{20}$/.test(account)?account.slice(-4):null,status,sourceIds:row?.sourceIds.length?row.sourceIds:sources.map(s=>s.sourceId)});
    }
  }
  return gaps;
}
