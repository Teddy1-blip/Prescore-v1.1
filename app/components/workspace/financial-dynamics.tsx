import type {PublicFinancialAnalysis,PublicFinancialMetric} from '../../../lib/credit-engine/client-report/source-detail';
import {financialLabels} from '../../../lib/credit-engine/client-report/source-detail';
import styles from './financial-dynamics.module.css';

type Period = PublicFinancialAnalysis['history'][number];
const flows = ['REVENUE', 'COST_OF_SALES', 'OPERATING_PROFIT', 'NET_PROFIT'];
const stocks = ['ASSETS_TOTAL', 'CURRENT_ASSETS', 'NON_CURRENT_ASSETS', 'EQUITY', 'LONG_TERM_LIABILITIES', 'SHORT_TERM_LIABILITIES'];
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
function PeriodBars({periods, series, flow}: {periods: Period[]; series: string[]; flow: boolean}) {
  const rows = periods.map(p => {
    const metrics = new Map(p.groups.flatMap(g => g.metrics).map(m => [m.key, m]));
    return {p, values: series.flatMap(key => {
      const amount = usable(metrics.get(key));
      return amount === null ? [] : [{key, amount}];
    })};
  }).filter(row => row.values.length);
  const amounts = rows.flatMap(row => row.values.map(v => v.amount));
  const high = Math.max(0, ...amounts), low = Math.min(0, ...amounts);
  // Keep a common scale and zero line across comparable periods.
  const range = high - low || 1;
  const baseline = high === low ? 50 : 100 * high / range;
  return <div className={styles.periods}>{rows.map(({p, values}) =>
    <section className={styles.period} key={p.id} data-period={p.id}>
      <h4>{flow ? formatDate(p.period.from) + ' — ' + formatDate(p.period.to) : 'На ' + formatDate(p.period.asOf)}</h4>
      <small>{p.source === 'BFO' ? 'Бухгалтерская отчётность' : 'Промежуточная отчётность'} · ₽</small>
      <div className={styles.plot} aria-hidden="true">
        <span className={styles.axis} style={{top: baseline + '%'}}/>
        {values.map(({key, amount}) =>
          <div className={styles.column} key={key}>
            <i data-sign={Math.sign(amount)} style={{
              top: (amount > 0 ? baseline - 100 * amount / range : baseline) + '%',
              height: (100 * Math.abs(amount) / range) + '%'
            }}/>
          </div>)}
      </div>
      <dl>{values.map(({key, amount}) => <div key={key} data-financial-series={key}>
        <dt>{financialLabels[key]}</dt><dd>{rubles.format(amount)} ₽</dd>
      </div>)}</dl>
    </section>)}</div>;
}
export function FinancialDynamics({history}:{history:Period[]}) {
  if(!history.length)return null;
  const groups=new Map<string,Period[]>();
  for(const p of history){const key=flowGroup(p);if(key)groups.set(key,[...(groups.get(key)??[]),p]);}
  const dated=history.filter(p=>p.period.asOf);
  return <section className={['pc-panel',styles.section].filter(Boolean).join(' ')} aria-label="Динамика и структура отчётности">
    <h2>Финансовые результаты</h2>
    {[...groups].map(([label,periods])=><section key={label} data-flow-group={label}><h3>{label}</h3><PeriodBars periods={periods} series={flows} flow/></section>)}
    {history.some(p=>!flowGroup(p))&&<p>Для части отчётности период доходов и расходов не подтверждён.</p>}
    <h2>Активы, капитал и обязательства</h2>
    {dated.length?<PeriodBars periods={dated} series={stocks} flow={false}/>:<p>Отчётная дата баланса не определена.</p>}
  </section>;
}
