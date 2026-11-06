import type {PublicFinancialAnalysis,PublicFinancialMetric} from '../../../lib/credit-engine/client-report/source-detail';
import styles from './financial-dynamics.module.css';

type Period = PublicFinancialAnalysis['history'][number];
type Series = {key:string; label:string};
const flows: Series[] = [{key:'REVENUE',label:'Выручка'},{key:'NET_PROFIT',label:'Чистая прибыль или убыток'}];
const stocks: Series[] = [{key:'ASSETS_TOTAL',label:'Активы'},{key:'EQUITY',label:'Капитал'},
  {key:'TOTAL_LIABILITIES',label:'Обязательства'},{key:'TOTAL_BORROWINGS',label:'В том числе заёмные средства'}];
const rubles = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const formatDate = (s:string|null) => s ? s.split('-').reverse().join('.') : 'дата не указана';

function flowGroup(row:Period) {
  const p=row.period;
  if (!p.from || !p.to) return null;
  if (p.flowPeriodType==='FULL_YEAR') return 'Полные годы';
  if (p.flowPeriodType==='CUMULATIVE_YTD') return 'С начала года · '+p.monthsCovered+' мес.';
  if (p.flowPeriodType==='STANDALONE_PERIOD') return 'Отдельный период · '+p.from.slice(5)+' — '+p.to.slice(5);
  return null;
}
function usable(m:PublicFinancialMetric|undefined) {
  return m && typeof m.value==='number' && m.status!=='UNKNOWN' && m.status!=='NOT_APPLICABLE' ? m.value : null;
}
function PeriodBars({periods,series,flow}:{periods:Period[];series:Series[];flow:boolean}) {
  const rows=periods.map(p=>({p,values:series.map(s=>({s,n:usable(p.groups.flatMap(g=>g.metrics).find(m=>m.key===s.key))}))}));
  const scale=Math.max(0,...rows.flatMap(row=>row.values.map(v=>Math.abs(v.n??0))));
  return <div className={styles.periods}>{rows.map(({p,values})=><section className={styles.period} key={p.id} data-period={p.id}>
    <h4>{flow ? formatDate(p.period.from)+' — '+formatDate(p.period.to) : 'На '+formatDate(p.period.asOf)}</h4>
    <small>{p.source==='BFO'?'Бухгалтерская отчётность':'Промежуточная отчётность'} · ₽</small>
    <dl>{values.map(({s,n},i)=><div key={s.key} data-financial-series={s.key}>
      <dt>{s.label}</dt><dd>{n===null?'Не определено':rubles.format(n)+' ₽'}</dd>
      {n!==null && <span aria-hidden="true" className={styles.track}><i className={n<0?styles.loss:i%2?styles.secondary:styles.primary} style={{width:(scale?100*Math.abs(n)/scale:0)+'%'}}/></span>}
    </div>)}</dl>
  </section>)}</div>;
}
export function FinancialDynamics({history}:{history:Period[]}) {
  if(!history.length)return null;
  const groups=new Map<string,Period[]>();
  for(const p of history){const key=flowGroup(p);if(key)groups.set(key,[...(groups.get(key)??[]),p]);}
  const dated=history.filter(p=>p.period.asOf);
  return <section className={['pc-panel',styles.section].filter(Boolean).join(' ')} aria-label="Динамика и структура отчётности">
    <h2>Выручка и чистая прибыль</h2>
    {[...groups].map(([label,periods])=><section key={label} data-flow-group={label}><h3>{label}</h3><PeriodBars periods={periods} series={flows} flow/></section>)}
    {history.some(p=>!flowGroup(p))&&<p>Для части отчётности период доходов и расходов не подтверждён.</p>}
    <h2>Активы, капитал и обязательства</h2>
    {dated.length?<PeriodBars periods={dated} series={stocks} flow={false}/>:<p>Отчётная дата баланса не определена.</p>}
  </section>;
}
