import type {BankStatementMetricsV2} from '../../contracts/metrics.ts';
import type {AnalysisResult} from '../../../prescore.ts';
import {fact,adequate} from '../common.ts';
// Ratios measured on complete months. Never combine a partial-month numerator and a full-month denominator.
export function boundaryFacts(a:AnalysisResult,bank:BankStatementMetricsV2,sourceIds:string[]) {
  const rows=bank.monthly??[];
  const partial=rows.filter(m=>m.coverage!=='FULL');
  if(!partial.length || partial.some(m=>m.coverage!=='PARTIAL'||m!==rows[0]&&m!==rows.at(-1)) ||
    a.integrity?.calendarCoverage?.some(c=>c.warnings.some(w=>['UNOBSERVED_ACCOUNT_PERIOD','ACCOUNT_PERIOD_UNCONFIRMED'].includes(w)))) return [];
  const full=rows.filter(m=>m.coverage==='FULL');
  if(!full.length||full.some(m=>m.debtService===null||m.operatingReceipts===null))return [];
  const period={from:full[0].month+'-01',to:new Date(Date.UTC(+full.at(-1)!.month.slice(0,4),+full.at(-1)!.month.slice(5),0)).toISOString().slice(0,10),asOf:bank.period.to};
  const debt=full.reduce((v,m)=>v+m.debtService!,0), operating=full.reduce((v,m)=>v+m.operatingReceipts!,0);
  const common={period,sourceIds,sourceTypes:['BANK_STATEMENT'],origin:'DERIVED' as const,warnings:['FULL_MONTH_WINDOW']};
  const service=bank.debtService.debtServiceToOperatingReceipts,trend=bank.operating.operatingReceiptsTrend;
  return [
    fact(a.companyInn,'BANK_DEBT_SERVICE_RATIO','CASH_FLOW',service.status==='KNOWN'&&adequate(service.confidence)&&operating>0?debt/operating:null,
      {...common,confidence:service.confidence,sourceMetricCode:service.code,calculationBasis:'Полные месяцы '+full.map(m=>m.month).join(', ')+'. Долговые выплаты '+debt+' ₽ / операционные поступления '+operating+' ₽.'}),
    fact(a.companyInn,'BANK_OPERATING_TREND','CASH_FLOW',trend.unit==='PERCENT'&&trend.status==='KNOWN'?trend.value:null,
      {...common,confidence:trend.confidence,sourceMetricCode:trend.code,calculationBasis:trend.calculationBasis+'; '+full.map(m=>m.month).join(', ')})
  ];
}
