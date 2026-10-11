"use client";
import type {WorkspaceModelV1,WorkspaceFactV1} from '../../../lib/workspace/model';
import {date,money} from './presentation';
import {label} from './credit-depth';
import {concentrationPercent,factValue} from './data-panel';

export const bankingFieldLabels={
 grossInflow:'Внешние поступления',
 grossOutflow:'Внешние списания',
 operatingInflow:'Операционные поступления',
 netCashFlow:'Чистый внешний денежный поток',
 observedMonthlyOperatingAverage:'Средние операционные за наблюдаемый период / месяц',
 fullMonthOperatingAverage:'Средние операционные по полным месяцам',
 endingBalance:'Остаток на конец периода',
 averageDailyBalance:'Среднедневной остаток',
 minimumDailyBalance:'Минимальный остаток',
 lowLiquidityDays:'Дни низкой ликвидности',
 loanPrincipalPayments:'Платежи основного долга',
 interestPayments:'Проценты',
 unsplitDebtPayments:'Неразделённые долговые платежи',
 leasingPayments:'Лизинг',
 taxPayments:'Налоги',
 socialContributions:'Социальные взносы',
 transfersToIndividuals:'Переводы физическим лицам',
 directCustomerTop1:'Доля крупнейшего прямого покупателя',
 directCustomerTop3:'Доля трёх крупнейших прямых покупателей'
} as const;

type BankingField=keyof typeof bankingFieldLabels;

const groups:Array<{title:string;hint:string;fields:BankingField[]}>= [
 {title:'Денежный поток',hint:'Поступления и списания по внешнему контуру компании.',fields:['operatingInflow','observedMonthlyOperatingAverage','fullMonthOperatingAverage','grossInflow','grossOutflow','netCashFlow']},
 {title:'Ликвидность',hint:'Остатки и запас денежных средств внутри периода.',fields:['endingBalance','averageDailyBalance','minimumDailyBalance','lowLiquidityDays']},
 {title:'Долг и обязательные платежи',hint:'Наблюдаемые списания по выпискам, а не договорный график.',fields:['loanPrincipalPayments','interestPayments','unsplitDebtPayments','leasingPayments','taxPayments','socialContributions','transfersToIndividuals']},
 {title:'Концентрация покупателей',hint:'Доля прямых покупателей в операционных поступлениях.',fields:['directCustomerTop1','directCustomerTop3']}
];

function display(f:WorkspaceFactV1){
 if(f.status==='NOT_APPLICABLE')return 'Не применимо';
 const v=factValue(f);
 if(v===null)return 'Не определено';
 if(f.unit==='RUB')return money(v);
 if(f.unit==='RATIO'||f.unit==='PERCENT'){
  const percent=concentrationPercent(f);
  return percent===null?'Не определено':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(percent)+'%';
 }
 if(f.unit==='DAYS')return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v)+' дн.';
 return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
}

function Fact({name,fact}:{name:BankingField;fact:WorkspaceFactV1}){
 return <div className="pc-bank-fact" data-banking-fact={name}>
  <dt>{bankingFieldLabels[name]}<small>{date(fact.periodFrom)} — {date(fact.periodTo)}</small></dt>
  <dd>{display(fact)}<small>{label(fact.status)} · {label(fact.confidence)}</small></dd>
 </div>;
}

export function BankingLedger({model}:{model:WorkspaceModelV1}){
 const b=model.basic.bankingFacts;
 return <>
  <section className="pc-panel pc-bank-ledger">
   <header><div><h2>Банковские показатели</h2><p>Сгруппированы по экономическому смыслу. Неизвестное значение не считается нулём.</p></div></header>
   <div className="pc-bank-groups">{groups.map(group=><article key={group.title}>
    <header><h3>{group.title}</h3><p>{group.hint}</p></header>
    <dl>{group.fields.map(name=><Fact key={name} name={name} fact={b[name]}/>)}</dl>
   </article>)}</div>
  </section>

  <section className="pc-panel">
   <header><div><h2>Помесячная динамика</h2><p>Фактические значения по каждому месяцу исходного банковского периода.</p></div></header>
   {b.monthly?.length?<div className="pc-table-scroll" tabIndex={0} aria-label="Помесячные банковские показатели"><table><thead><tr><th>Месяц</th><th>Операционные поступления</th><th>Внешние поступления</th><th>Внешние списания</th><th>Налоги</th><th>Обслуживание долга</th></tr></thead><tbody>{b.monthly.map(m=><tr key={m.month}><th scope="row">{m.month}<small>{m.coverage==='FULL'?'Полный месяц':m.coverage==='PARTIAL'?'Неполный месяц':m.coverage==='MISSING'?'Нет покрытия':m.coverage==='OVERLAP'?'Пересечение периодов':'Покрытие не подтверждено'}</small></th>{[m.operatingReceipts,m.externalInflows,m.externalOutflows,m.taxPayments,m.debtService].map((v,i)=><td key={i}>{money(v)}</td>)}</tr>)}</tbody></table></div>:<p>Помесячные сведения не опубликованы.</p>}
  </section>

  <details className="pc-disclosure">
   <summary>Качество и период каждого банковского показателя</summary>
   <p>Этот реестр нужен для проверки исходных данных и периода расчёта. Для принятия решения используйте сгруппированную картину выше и кредитное заключение Prescore.</p>
   <div className="pc-table-scroll"><table><thead><tr><th>Показатель</th><th>Значение</th><th>Статус / достоверность</th><th>Период</th></tr></thead><tbody>{Object.entries(bankingFieldLabels).map(([key,title])=>{const f=b[key as BankingField];return <tr key={key}><th scope="row">{title}</th><td>{display(f)}</td><td>{label(f.status)} · {label(f.confidence)}</td><td>{date(f.periodFrom)} — {date(f.periodTo)}</td></tr>;})}</tbody></table></div>
  </details>
 </>;
}
