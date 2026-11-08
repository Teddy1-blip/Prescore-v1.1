import type {AnalysisSourceManifest} from '../contracts/sources.ts';
import type {BankStatementMetricsV2, MetricResult} from '../contracts/metrics.ts';
import type {RiskAssessmentV1} from '../contracts/risk.ts';
import type {CreditPortfolioV1} from '../contracts/credit-portfolio.ts';

export type BankObservation = {
  code:string; title:string; value:number|string; unit:string; positive:boolean;
  confidence:MetricResult['confidence']; sourceIds:string[]; sourceTypes:string[]; sourceMetricCodes:string[];
  period:{from:string|null;to:string|null;asOf:string|null}; calculationBasis:string;
};
export function observedBankProfile(a:{sourceManifest?:AnalysisSourceManifest}, bank:BankStatementMetricsV2, risk:RiskAssessmentV1, portfolio:CreditPortfolioV1) {
  const sourceIds=(a.sourceManifest?.bankStatements??[]).map(s=>s.sourceId);
  const period={from:bank.period.from,to:bank.period.to,asOf:bank.period.to};
  const observations:BankObservation[]=[];
  function record(code:string,title:string,m:MetricResult,positive=false) {
    if (!m || m.value===null || !Number.isFinite(m.value) || !['KNOWN','PARTIAL'].includes(m.status)) return;
    observations.push({code,title,value:m.value,unit:m.unit,positive:positive && m.status==='KNOWN' && m.confidence==='HIGH',
      confidence:m.confidence,period,sourceIds,sourceTypes:['BANK_STATEMENT'],sourceMetricCodes:[m.code],calculationBasis:m.calculationBasis});
  }
  const net=bank.cashFlow.netExternalCashFlow;
  record('NET',net.value!==null && net.value>0?'Поступления превысили списания':net.value!==null && net.value<0?'Списания превысили поступления':'Поступления равны списаниям',net,(net.value??0)>0);
  record('OPERATING','Операционные поступления',bank.operating.operatingCashReceipts);
  record('DEBT','Выплаты по долгу',bank.debtService.debtServiceCashOutflow);
  const rule=(code:string)=>risk.evaluations.find(e=>e.ruleCode===code)?.status;
  record('TREND','Изменение операционных поступлений по полным месяцам',bank.operating.operatingReceiptsTrend,
    rule('RISK-CF-OPERATING-RECEIPTS-DECLINE')==='NOT_TRIGGERED' && (bank.operating.operatingReceiptsTrend.value??-1)>=0);
  record('TOP1','Доля крупнейшего прямого покупателя',bank.customers.directCustomerTop1,
    rule('RISK-CF-CUSTOMER-CONCENTRATION')==='NOT_TRIGGERED');
  const lifecycle=risk.facts.find(f=>f.semanticCode==='LEGAL_LIFECYCLE'&&f.status==='KNOWN'&&f.sourceIds.length);
  if(lifecycle) observations.push({code:'LEGAL',title:'Юридический статус',value:({ACTIVE:'Действует',TERMINATED:'Деятельность прекращена',LIQUIDATION:'Ликвидация',BANKRUPTCY_ACTIVE:'Процедура банкротства'} as Record<string,string>)[String(lifecycle.value)]??'Требует уточнения',
    confidence:lifecycle.confidence,positive:lifecycle.value==='ACTIVE'&&lifecycle.confidence==='HIGH',unit:'TEXT',sourceIds:lifecycle.sourceIds,
    sourceTypes:lifecycle.sourceTypes,sourceMetricCodes:[],period:lifecycle.period,calculationBasis:lifecycle.calculationBasis});
  const coverage=(bank.monthly??[]).filter(m=>m.coverage!=='FULL');
  if(coverage.length) observations.push({code:'COVERAGE',title:'Неполное покрытие банковского периода',value:coverage.map(m=>m.month).join(', '),unit:'TEXT',positive:false,confidence:'HIGH',
    sourceIds,sourceTypes:['BANK_STATEMENT'],sourceMetricCodes:[],period,calculationBasis:'Календарные месяцы с неполным покрытием, пропуском или пересечением по доступным счетам.'});
  const burden=risk.facts.find(f=>f.semanticCode==='BANK_DEBT_SERVICE_RATIO'&&f.status==='KNOWN');
  if(burden&&typeof burden.value==='number') observations.push({code:'BURDEN',title:'Доля долговых выплат в операционных поступлениях',value:burden.value,unit:'RATIO',
    positive:burden.confidence==='HIGH'&&rule('RISK-CF-DEBT-SERVICE-BURDEN')==='NOT_TRIGGERED',confidence:burden.confidence,sourceIds:burden.sourceIds,sourceTypes:burden.sourceTypes,sourceMetricCodes:burden.sourceMetricCode?[burden.sourceMetricCode]:[],period:burden.period,calculationBasis:burden.calculationBasis});
  const unmatched=new Set(portfolio.unmatchedPaymentObservationIds);
  const payments=portfolio.paymentObservations.filter(o=>unmatched.has(o.observationId));
  if(payments.length && payments.every(o=>Number.isFinite(o.amount))) {
    const dates=payments.map(o=>o.date).sort();
    observations.push({code:'UNMATCHED',title:'Платежи без подтверждённой связи с договором ('+payments.length+')',value:Math.round(payments.reduce((sum,o)=>sum+o.amount,0)*100)/100,unit:'RUB',positive:false,
      confidence:'MEDIUM',period:{from:dates[0],to:dates.at(-1)!,asOf:dates.at(-1)!},sourceIds:[...new Set(payments.flatMap(o=>o.sourceIds))],sourceTypes:['BANK_STATEMENT'],sourceMetricCodes:[],
      calculationBasis:(portfolio.obligations.length?'Не удалось однозначно связать платежи с обязательствами.':'Договоры для сопоставления отсутствуют в портфеле.')+' Сверьте назначения платежей с договорами или графиками.'});
  }
  return observations;
}
