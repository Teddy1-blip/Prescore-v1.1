import type {ProductSelectionInputV1,ProductFamily} from '../contracts/product-selection.ts';
const next:Record<ProductFamily,string>={
  TERM_LOAN:'Уточнить цель, срок и действующие платежи.',
  CREDIT_LINE:'Сопоставить закупки и сроки поступлений, определить период выборки.',
  REVOLVING_CREDIT_LINE:'Подтвердить повторяющийся цикл закупки, продажи и оплаты.',
  OVERDRAFT:'Сопоставить даты регулярных поступлений с краткими разрывами.',
  BANK_GUARANTEE:'Предоставить контракт, тип гарантии и срок обеспечения.',
  FACTORING:'Подтвердить поставки с отсрочкой, дебиторов и сроки оплаты.',
  LEASING:'Уточнить предмет лизинга, стоимость и аванс.'
};
export function preliminaryMechanism(x:ProductSelectionInputV1,family:ProductFamily) {
  const observations=x.creditAssessment.bankObservations;
  if(!observations?.length||x.creditAssessment.globalStop.status==='PRESENT')return;
  const operating=observations.find(o=>o.code==='OPERATING'&&typeof o.value==='number'&&o.value>0);
  const customer=observations.find(o=>o.code==='TOP1');
  const usable=(family==='FACTORING'?customer:['TERM_LOAN','CREDIT_LINE','REVOLVING_CREDIT_LINE','OVERDRAFT'].includes(family)?operating:undefined);
  const findings=x.riskAssessment.findings.filter(f=>f.scope==='CREDIT_RISK');
  const relevant=findings.filter(f=>family==='FACTORING'?/CONCENTRATION/.test(f.code):/DEBT-SERVICE|DECLINE|LIQUIDITY|OVERDUE/.test(f.code));
  const reason=usable?(family==='FACTORING'?'В выписках определены прямые покупатели.':'В выписках подтверждены операционные поступления.'):'Для проверки механизма нужны сведения о сделке.';
  return {fit:usable?'Условно подходит':'Пока нельзя оценить',reason,nextStep:next[family],observationCodes:usable?[usable.code]:[],riskFindingIds:relevant.map(f=>f.findingId)};
}
