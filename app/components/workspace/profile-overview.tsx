import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {checkoStatusText} from '../../../lib/external/checko-summary';
import {money,date} from './presentation';
type Props={model:WorkspaceModelV1};
export function CheckoOverview({model}:Props){
  const profile=model.full?.report.checko,state=profile??model.basic.checko;
  return <section className="pc-checko"><h3>Открытые сведения · Checko</h3>
    <p><b>{state?checkoStatusText(state.status, model.basic.analysis.company.inn):'Ещё не запрашивался'}</b>{state?.fetchedAt&&<> · получено {date(state.fetchedAt.slice(0,10))}</>}</p>
    {!profile&&model.basic.checko?.identity&&<p>{[model.basic.checko.identity.status,model.basic.checko.identity.registered&&'Регистрация '+model.basic.checko.identity.registered].filter(Boolean).join(' · ')}</p>}
    {!!profile?.rows.length&&<details><summary>Сведения по ИНН {model.basic.analysis.company.inn}</summary><dl className="pc-definition">{profile.rows.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></details>}
  </section>;
}
function known(f:{status:string;value:number|null}|undefined) {
  return f && (f.status==='KNOWN'||f.status==='PARTIAL')?f.value:null;
}
function AmountBars({title,rows}:{title:string;rows:Array<{label:string;value:number|null}>}){
  const available=rows.filter((r):r is {label:string;value:number}=>r.value!==null&&Number.isFinite(r.value));
  if(!available.length)return null;
  const max=Math.max(1,...available.map(r=>Math.abs(r.value)));
  return <section className="pc-dashboard-section pc-amount-bars"><h2>{title}</h2>{available.map((r,i)=><div key={r.label+i}><span>{r.label}</span><b>{money(r.value)}</b><i aria-hidden="true" style={{width:Math.abs(r.value)/max*100+'%'}}/></div>)}</section>;
}
export function FlowComposition({model}:Props){
 const b=model.basic.bankingFacts;
 return <div className="pc-dashboard-grid pc-banking-charts">
  <AmountBars title="Состав движения денег" rows={[{label:'Операционные поступления',value:known(b.operatingInflow)},{label:'Долговое обслуживание',value:known(b.debtService)},{label:'Налоги',value:known(b.taxPayments)},{label:'Социальные платежи',value:known(b.socialContributions)}]}/>
  <AmountBars title="Долговые выплаты" rows={[{label:'Основной долг',value:known(b.loanPrincipalPayments)},{label:'Проценты',value:known(b.interestPayments)},{label:'Лизинг',value:known(b.leasingPayments)},{label:'Без разбивки',value:known(b.unsplitDebtPayments)}]}/>
  <AmountBars title="Крупнейшие покупатели" rows={(b.topCounterparties??[]).slice(0,5).map(r=>({label:r.name+' · '+new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:1}).format(r.share),value:r.amount}))}/>
 </div>;
}
export function BankProfileDetails({model,choose}:Props&{choose:(view:string)=>void}){
 const f=model.full;if(!f)return null;
 const missing=[['FINANCIAL_STATEMENTS','Добавить БФО','Уточнит прибыль, капитал и бухгалтерскую ликвидность.'],['CREDIT_HISTORY','Добавить кредитную историю','Уточнит остаток задолженности, договорные графики и просрочку.']].filter(([key])=>!model.basic.sources.availability.some(s=>s.source===key&&s.status==='READY'));
 return <>{missing.length>0&&<section className="pc-dashboard-section"><h2>Дополнить профиль</h2><div className="pc-dashboard-products">{missing.map(([,name,benefit])=><article key={name}><b>{name}</b><p>{benefit}</p></article>)}</div><button className="pc-text-button" onClick={()=>choose('documents')}>Документы →</button></section>}
 {f.canonical.prescoreIndex.value===null&&<details className="pc-index-coverage"><summary>Почему пока нет числового индекса</summary><p>Числовой индекс требует подтверждения всех обязательных компонент. Банковские показатели, выводы и дальнейшие действия рассчитаны по доступному профилю.</p></details>}</>;
}
