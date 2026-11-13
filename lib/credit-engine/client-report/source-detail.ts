import {bankBfoComparisons, type BankBfoComparison} from "./bank-bfo.ts";
import type {CanonicalCreditAnalysisV1} from '../production/orchestrator.ts';
import type {FinancialMetricResult} from '../contracts/financial-statements.ts';
import type {ReconciliationFact} from '../contracts/reconciliation.ts';

// Public presentation allowlist: existing results only, never raw snapshots,
// parser payloads, policy thresholds or calculation formulas.
export type PublicFinancialMetric = Pick<FinancialMetricResult,'value'|'unit'|'status'|'confidence'|'origin'|'periodFrom'|'periodTo'|'asOf'|'warnings'> & {key:string; label:string};
export type PublicFinancialAnalysis = {
 history: {id:string; source:string; period:{from:string|null;to:string|null;asOf:string|null;kind:string;flowPeriodType:string;monthsCovered:number|null}; groups:{key:string;title:string;metrics:PublicFinancialMetric[]}[]; quality:{coreBalanceFieldCoverage:number;coreIncomeFieldCoverage:number;confidence:string;balanceReconciled:boolean|null;incomeReconciled:boolean|null;warnings:string[]}}[];
 trends:{label:string;currentId:string;previousId:string|null;comparability:string;absolute:PublicFinancialMetric;relative:PublicFinancialMetric}[];
 warnings:string[];
};
export type PublicReconciliation = {
 bankBfo?: BankBfoComparison[];
 confidence:string;
 findings:{id:string;title:string;outcome:string;comparability:string;confidence:string;requiresReview:boolean;warnings:string[];reasons:string[];left:PublicReconciliationFact[];right:PublicReconciliationFact[];absoluteDifference:number|null;relativeDifference:number|null;ratio:number|null;temporalGapDays:number|null}[];
 warnings:string[];
};
export type PublicReconciliationFact = Pick<ReconciliationFact,'value'|'unit'|'status'|'confidence'|'period'|'sourceType'|'warnings'> & {label:string};
export const financialLabels:Record<string,string> = {
 COMPANY_INN:'Принадлежность компании',SUBJECT_INN:'Принадлежность субъекта кредитной истории',BANK_OPERATING_RECEIPTS:'Операционные поступления',BANK_MONTHLY_OPERATING_RECEIPTS:'Операционные поступления за месяц',BANK_ENDING_BALANCE:'Банковский остаток на конец периода',BANK_DEBT_SERVICE_OUTFLOW:'Платежи по обслуживанию долга',BANK_LOAN_PRINCIPAL_PAID:'Погашение основного долга',BANK_INTEREST_PAID:'Уплаченные проценты',BANK_UNSPLIT_DEBT_SERVICE:'Неразделённые долговые платежи',BANK_LEASING_PAID:'Лизинговые платежи',BKI_OUTSTANDING_PRINCIPAL:'Основной долг по кредитной истории',BKI_TOTAL_OUTSTANDING:'Задолженность по кредитной истории',BKI_MONTHLY_PAYMENT:'Платёж по кредитной истории',BKI_OVERDUE_AMOUNT:'Просрочка по кредитной истории',BKI_GUARANTEE_EXPOSURE:'Условные обязательства по кредитной истории',ASSETS_TOTAL:'Активы',ASSETS:'Активы',NON_CURRENT_ASSETS:'Внеоборотные активы',INTANGIBLE_ASSETS:'Нематериальные активы',FIXED_ASSETS:'Основные средства',CURRENT_ASSETS:'Оборотные активы',INVENTORIES:'Запасы',INPUT_VAT:'НДС по приобретённым ценностям',RECEIVABLES:'Дебиторская задолженность',SHORT_TERM_FIN_INVESTMENTS:'Краткосрочные финансовые вложения',CASH:'Денежные средства',OTHER_CURRENT_ASSETS:'Прочие оборотные активы',EQUITY:'Капитал',RETAINED_EARNINGS:'Нераспределённая прибыль',LONG_TERM_LIABILITIES:'Долгосрочные обязательства',LONG_TERM_BORROWINGS:'Долгосрочные заёмные средства',SHORT_TERM_LIABILITIES:'Краткосрочные обязательства',SHORT_TERM_BORROWINGS:'Краткосрочные заёмные средства',PAYABLES:'Кредиторская задолженность',OTHER_SHORT_TERM_LIABILITIES:'Прочие краткосрочные обязательства',BALANCE_TOTAL:'Баланс',REVENUE:'Выручка',COST_OF_SALES:'Себестоимость продаж',GROSS_PROFIT:'Валовая прибыль',SELLING_EXPENSES:'Коммерческие расходы',ADMIN_EXPENSES:'Управленческие расходы',OPERATING_PROFIT:'Прибыль от продаж',INTEREST_INCOME:'Проценты к получению',INTEREST_EXPENSE:'Проценты к уплате',OTHER_INCOME:'Прочие доходы',OTHER_EXPENSES:'Прочие расходы',PROFIT_BEFORE_TAX:'Прибыль до налога',INCOME_TAX_EXPENSE:'Налог на прибыль',NET_PROFIT:'Чистая прибыль',REPORTED_NET_ASSETS:'Чистые активы по отчётности',EQUITY_NET_ASSETS_PROXY:'Капитал как косвенная оценка чистых активов',TOTAL_LIABILITIES:'Всего обязательств',TOTAL_BORROWINGS:'Всего заёмных средств',QUICK_ASSETS:'Быстрореализуемые активы',CASH_AND_INVESTMENTS:'Деньги и краткосрочные вложения',
 currentRatio:'Текущая ликвидность',quickRatio:'Быстрая ликвидность',absoluteLiquidity:'Абсолютная ликвидность',netWorkingCapital:'Чистый оборотный капитал',equityRatio:'Доля собственного капитала',liabilitiesToAssets:'Обязательства / активы',borrowingsToAssets:'Заёмные средства / активы',debtToEquity:'Заёмные средства / капитал',liabilitiesToEquity:'Обязательства / капитал',netDebt:'Чистый долг',shortTermDebtShare:'Доля краткосрочного долга',grossMargin:'Валовая рентабельность',operatingMargin:'Рентабельность продаж',pretaxMargin:'Рентабельность до налога',netMargin:'Чистая рентабельность',roa:'Рентабельность активов',roe:'Рентабельность капитала',interestCoverageOperatingProfit:'Покрытие процентов прибылью от продаж',assetTurnover:'Оборачиваемость активов',receivablesTurnover:'Оборачиваемость дебиторской задолженности',dso:'Срок погашения дебиторской задолженности',inventoryTurnover:'Оборачиваемость запасов',dio:'Срок оборота запасов',
};
export function financialLabel(key:string):string {
 if(financialLabels[key])return financialLabels[key];
 if(key.startsWith('AVERAGE_'))return 'Среднее: '+financialLabel(key.slice(8));
 if(key.startsWith('OPENING_'))return 'На начало периода: '+financialLabel(key.slice(8));
 if(key.includes('_TO_'))return key.split('_TO_').map(financialLabel).join(' / ');
 return 'Показатель отчётности';
}
const groupLabels={amounts:'Суммы отчётности',liquidity:'Ликвидность',capitalStructure:'Капитал и долг',profitability:'Рентабельность',activity:'Оборачиваемость',composition:'Структура активов и обязательств'};
const metric=(key:string,m:FinancialMetricResult):PublicFinancialMetric=>({key,label:financialLabel(key),value:m.value,unit:m.unit,status:m.status,confidence:m.confidence,origin:m.origin,periodFrom:m.periodFrom,periodTo:m.periodTo,asOf:m.asOf,warnings:[...m.warnings]});
export function publicFinancialAnalysis(r:CanonicalCreditAnalysisV1):PublicFinancialAnalysis|null {
 const a=r.financialAnalysis;if(!a)return null;
 return {history:a.history.map(p=>({id:p.snapshot.snapshotId,source:p.snapshot.sourceType,period:{from:p.snapshot.period.from,to:p.snapshot.period.to,asOf:p.snapshot.period.asOf,kind:p.snapshot.period.kind,flowPeriodType:p.snapshot.period.flowPeriodType,monthsCovered:p.snapshot.period.monthsCovered},groups:Object.entries(groupLabels).map(([key,title])=>({key,title,metrics:Object.entries(p[key as keyof typeof groupLabels]).map(([k,m])=>metric(k,m))})),quality:{coreBalanceFieldCoverage:p.quality.coreBalanceFieldCoverage,coreIncomeFieldCoverage:p.quality.coreIncomeFieldCoverage,confidence:p.quality.confidence,balanceReconciled:p.quality.balanceReconciled,incomeReconciled:p.quality.incomeReconciled,warnings:[...p.quality.warnings]}})),trends:a.trends.map(t=>({label:financialLabel(t.metric),currentId:t.currentSnapshotId,previousId:t.previousSnapshotId,comparability:t.comparability,absolute:metric(t.metric,t.absoluteChange),relative:metric(t.metric,t.relativeChange)})),warnings:[...a.quality.warnings]};
}
const reconciliationTitles:Record<string,string>={'REC-REV':'Поступления и бухгалтерская выручка','REC-CASH':'Банковские остатки и отчётность','REC-BKI-1':'Кредитная история и заёмные средства','REC-BKI-2':'Платежи и кредитная история','REC-ID':'Принадлежность источников компании','REC-FIN':'Сопоставление отчётности'};
function publicFact(f:ReconciliationFact):PublicReconciliationFact{return {label:financialLabel(f.semanticCode),sourceType:f.sourceType,value:f.semanticCode==='SUBJECT_INN'?null:f.value,unit:f.unit,status:f.status,confidence:f.confidence,period:{...f.period},warnings:[...f.warnings]};}
export function publicReconciliation(r:CanonicalCreditAnalysisV1):PublicReconciliation {
 return {bankBfo:bankBfoComparisons(r.reconciliation),confidence:r.reconciliation.summary.confidence,warnings:[...r.reconciliation.summary.warnings],findings:r.reconciliation.findings.flatMap((f,index)=>{
   const paired = f.code === 'REC-REV' || f.code === 'REC-CASH';
   if (paired && [...f.leftFacts,...f.rightFacts].some(v=>v.companyInn !== r.reconciliation.companyInn)) return [];
   return [{id:"reconciliation-"+index,title:reconciliationTitles[f.code]??(f.code.startsWith('REC-FIN')?'Сопоставление отчётности':'Сопоставление источников'),outcome:f.outcome,comparability:f.comparability,confidence:f.evidenceConfidence,requiresReview:f.requiresDataReview,warnings:[...f.warnings],reasons:[...f.reasonCodes],left:f.leftFacts.map(publicFact),right:f.rightFacts.map(publicFact),absoluteDifference:f.absoluteDifference,relativeDifference:f.relativeDifference,ratio:f.ratio,temporalGapDays:f.temporalGapDays}];})};
}
