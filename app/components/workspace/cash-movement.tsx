'use client';

import {useEffect, useState, useSyncExternalStore, type CSSProperties} from 'react';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {CASH_PAGE_SIZE, cashLabels, cashValue, isCashSeries, type CashSeries, type CashEvidencePage} from '../../../lib/workspace/cash-series';
import styles from './cash-movement.module.css';

const modes = {
  flow: {title:'Общий поток', series:['externalInflows','externalOutflows']},
  composition: {title:'Состав поступлений', series:['operatingReceipts','nonOperatingReceipts','unknownInflows']},
  debt: {title:'Долг и лизинг', series:['principal','interest','unsplit','leasing']},
  budget: {title:'В бюджет', series:['taxOnly','social']},
} satisfies Record<string,{title:string;series:CashSeries[]}>;
const questions = {
  flow:'Сколько денег пришло извне и сколько ушло?',
  composition:'Какая часть поступлений связана с операционной деятельностью?',
  debt:'Сколько фактически уплачено по долгу и лизингу?',
  budget:'Сколько перечислено в бюджет по банковским выпискам?',
};
type Mode = keyof typeof modes;
const modeKeys = Object.keys(modes) as Mode[];
const coverage = {FULL:'Полный месяц', PARTIAL:'Неполный месяц', MISSING:'Нет покрытия', OVERLAP:'Перекрытие периодов'};
const formatAmount = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2});
export const cashMoney = (value:number|null) => value===null ? 'Нет данных' : formatAmount.format(value)+' ₽';
const monthLabel = (month:string) => month==='all' ? 'весь период выписки' : month.split('-').reverse().join('.');
const shortMonth = new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:'UTC'});
function monthTick(month: string) {
  const date = new Date(month+'-01T00:00:00Z');
  return Number.isFinite(date.getTime()) ? shortMonth.format(date) : month;
}
const eventName = 'prescore-cash-filter';
const currentQuery = () => window.location.search;
const serverQuery = () => '';
function subscribe(change:()=>void) {
  window.addEventListener('popstate',change);
  window.addEventListener(eventName,change);
  return () => {window.removeEventListener('popstate',change);window.removeEventListener(eventName,change);};
}
function select(id:string, mode:Mode, month?:string, series?:CashSeries) {
  const url = new URL(window.location.href);
  url.searchParams.set('cashFor',id);
  url.searchParams.set('cashMode',mode);
  if (month && series) {
    url.searchParams.set('cashMonth',month);
    url.searchParams.set('cashSeries',series);
  } else {
    url.searchParams.delete('cashMonth');
    url.searchParams.delete('cashSeries');
  }
  window.history.replaceState(null,'',url);
  window.dispatchEvent(new Event(eventName));
}

export function CashOperations({analysisId,month,series}: {analysisId:string;month:string;series:CashSeries}) {
  const [offset,setOffset] = useState(0);
  const [response,setResponse] = useState<{query:string;data?:CashEvidencePage;error?:string}>();
  const query = new URLSearchParams({analysisId,projection:'cash-operations',month,series,offset:String(offset)}).toString();
  useEffect(()=>{
    const controller = new AbortController();
    async function read() {
      try {
        const r=await fetch('/api/workspace-model?'+query,{cache:'no-store',signal:controller.signal});
        const body=await r.json();
        if (controller.signal.aborted) return;
        if (!r.ok) {setResponse({query,error:body.error || 'Операции сейчас недоступны.'});return;}
        if (body.analysisId!==analysisId || body.month!==month || body.series!==series || body.offset!==offset) {
          setResponse({query,error:'Получена расшифровка другого периода или анализа.'});return;
        }
        setResponse({query,data:body});
      } catch {
        if (!controller.signal.aborted) setResponse({query,error:'Не удалось загрузить операции.'});
      }
    }
    void read();
    return ()=>controller.abort();
  },[query,analysisId,month,series,offset]);
  const result=response?.query===query ? response : undefined;
  const page=result?.data;
  return <section className={styles.detail} aria-label="Расшифровка операций" aria-live="polite">
    <h3>{cashLabels[series]} · {monthLabel(month)}</h3>
    {!result && <p role="status">Загружаем операции…</p>}
    {result?.error && <p role="alert">{result.error}</p>}
    {page && <>
      <p>Операций: <b>{page.count}</b> · Итого за период: <b>{cashMoney(page.total)}</b></p>
      {page.count===0 ? <p>В наблюдаемом периоде операций этой категории нет.</p> :
        <ul className={styles.operations}>{page.rows.map(row=><li key={row.id}>
          <div><strong>{row.counterparty || 'Контрагент не указан'}</strong><b>{cashMoney(row.amount)}</b></div>
          <span>{row.date.split('-').reverse().join('.')} · {row.category} · Достоверность: {row.confidence.toLowerCase()}</span>
          {row.postedAmount!==undefined && <small>Вся проводка: {cashMoney(row.postedAmount)}. В показатель входит выделенная часть.</small>}
          <p>{row.purpose || 'Назначение не указано'}</p>
          {row.source && <small>{row.source}{row.row!=null && ' · строка '+row.row}{row.documentNumber && ' · документ № '+row.documentNumber}</small>}
          {row.hash && <details><summary>Проверить источник</summary><small>SHA-256 {row.hashOf==="file" ? "файла" : "текста"}: {row.hash}{row.parser && ' · Обработчик: '+row.parser}</small></details>}
        </li>)}</ul>}
      {(offset>0 || page.nextOffset!==null) && <nav className={styles.pages} aria-label="Страницы операций">
        <button type="button" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-CASH_PAGE_SIZE))}>Назад</button>
        <span>{offset+1}–{offset+page.rows.length} из {page.count}</span>
        <button type="button" disabled={page.nextOffset===null} onClick={()=>setOffset(page.nextOffset??offset)}>Далее</button>
      </nav>}
    </>}
  </section>;
}

function BalanceSummary({model}:{model:WorkspaceModelV1}) {
  const b=model.basic.bankingFacts;
  const check=b.balanceCheck;
  const liquidity=<dl aria-label="Ликвидность по представленным счетам">{([
    ['Остаток на конец',b.endingBalance],['Средний за день',b.averageDailyBalance],['Минимальный за день',b.minimumDailyBalance]
  ] as const).map(([label,fact])=><div key={label} data-source={fact.code}><dt>{label}</dt><dd>{cashMoney(fact.value)}</dd></div>)}</dl>;
  if (check?.state!=='VERIFIED') return <section className={styles.balance} aria-label="Сверка остатков"><h3>Какой остаток подтверждён по счетам?</h3>{liquidity}<p className={styles.note}>{check?.state==='MISMATCH'
    ? 'Остатки или обороты в выписке расходятся с операциями. Изменение остатка не подтверждено.'
    : 'Для сверки изменения остатка нужны начальный и конечный остатки и обороты по всем счетам за один период.'}</p></section>;
  return <section className={styles.balance} aria-label="Сверка остатков">
    <h3>Изменение остатка</h3>
    <p>{check.from.split('-').reverse().join('.')} — {check.to.split('-').reverse().join('.')} · Проверено счетов: {check.accountCount}</p>
    <dl>{([['На начало',check.opening],['Зачислено на счета',check.inflow],['Списано со счетов',check.outflow],['На конец',check.closing]] as const).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{cashMoney(value)}</dd></div>)}</dl>
    {liquidity}
    <small>Обороты включают движения между своими счетами. В графике внешнего потока они исключены.</small>
  </section>;
}

type MonthlyRow = NonNullable<WorkspaceModelV1['basic']['bankingFacts']['monthly']>[number];

function CashColumns({rows, series, allowDetails, onSelect, selectedMonth, selectedSeries}: {
  rows: MonthlyRow[];
  series: readonly CashSeries[];
  allowDetails: boolean;
  onSelect: (month: string, series: CashSeries) => void;
  selectedMonth: string | null;
  selectedSeries: string | null;
}) {
  const amounts = rows.flatMap(row => series.map(key => cashValue(row,key))).filter((v): v is number => v !== null);
  const low = Math.min(0, ...amounts);
  const high = Math.max(0, ...amounts);
  const span = high - low || 1;
  const zero = -low / span * 100;

  return <div className={styles.columns} aria-label="Движение денег по месяцам">
    <div className={styles.axis} aria-hidden="true">
      <span>{cashMoney(high)}</span>
      {high !== low && <span>{cashMoney(low)}</span>}
    </div>
    <div className={styles.plot} style={{'--zero': zero+'%'} as CSSProperties}>
      {rows.map(row => <div className={styles.columnMonth} key={row.month}>
        <div className={styles.columnGroup}>{series.map((key,index) => {
          const value = cashValue(row,key);
          const label = cashLabels[key]+' · '+monthLabel(row.month)+' · '+cashMoney(value);
          const fill = value === null ? null : <i data-color={index} style={{
            bottom:(zero + Math.min(0,value)/span*100)+'%',
            height:Math.abs(value)/span*100+'%',
          }}/>;
          return allowDetails && value !== null
            ? <button key={key} className={styles.column} type="button" title={label} aria-label={label}
                aria-pressed={selectedMonth===row.month && selectedSeries===key} onClick={()=>onSelect(row.month,key)}>{fill}</button>
            : <span key={key} className={styles.column} role="img" aria-label={label} title={label}>{fill}</span>;
        })}</div>
        <b title={monthLabel(row.month)}>{monthTick(row.month)}</b>
        {row.coverage !== 'FULL' && <small>{coverage[row.coverage]}</small>}
      </div>)}
    </div>
  </div>;
}

export function CashMovement({model, overview=false}:{model:WorkspaceModelV1;overview?:boolean}) {
  const query = useSyncExternalStore(subscribe,currentQuery,serverQuery);
  const params = new URLSearchParams(query);
  const sameAnalysis = params.get('cashFor')===model.analysisId;
  const candidate = sameAnalysis && params.get('cashMode');
  const mode:Mode = candidate && Object.hasOwn(modes,candidate) ? candidate as Mode : 'flow';
  const series:readonly CashSeries[] = modes[mode].series;
  const allRows = model.basic.bankingFacts.monthly??[];
  const rows = overview ? allRows.slice(-6) : allRows;
  const selectedMonth = sameAnalysis ? params.get('cashMonth') : null;
  const selectedSeries = sameAnalysis ? params.get('cashSeries') : null;
  const selected = rows.find(r=>r.month===selectedMonth);
  const allowDetails = model.entitlement==='FULL';
  const max = rows.reduce((scale,r)=>Math.max(scale,...series.map(s=>cashValue(r,s)??0)),1);
  if (!rows.length) return <p>Для помесячного графика недостаточно данных. Добавьте выписку с датами операций.</p>;
  return <div className={styles.panel} style={{"--amount-width": Math.max(cashMoney(max).length, "Нет данных".length)+1+"ch"} as CSSProperties}>
    {!overview && <p className={styles.note}>{model.basic.analysis.company.name} · {model.basic.sources.statements.bankNames?.join(", ") || "Банк не определён"} · {model.basic.analysis.period.from} — {model.basic.analysis.period.to}</p>}
    {!overview && <BalanceSummary model={model}/>}
    <div className={styles.modes} role="group" aria-label="Режим графика">{modeKeys.map(key=>
      <button type="button" key={key} aria-pressed={key===mode}
        disabled={!rows.some(r=>modes[key].series.some(s=>cashValue(r,s)!==null))}
        onClick={()=>select(model.analysisId,key)}>{modes[key].title}</button>)}</div>
    {!overview && <h3>{questions[mode]}</h3>}
    <p className={styles.note}>{overview ? monthLabel(rows[0].month)+' — '+monthLabel(rows[rows.length-1].month) : model.basic.analysis.period.from+' — '+model.basic.analysis.period.to} · По представленным счетам · ₽</p>
    <div className={styles.legend}>{series.map((s,i)=><span key={s}><i data-color={i}/>{cashLabels[s]}</span>)}</div>
    {overview ? <CashColumns rows={rows} series={series} allowDetails={allowDetails}
      selectedMonth={selectedMonth} selectedSeries={selectedSeries}
      onSelect={(month,key)=>select(model.analysisId,mode,month,key)}/>
    : rows.map(r=><div className={styles.month} key={r.month}>
      <div className={styles.period}><b>{monthLabel(r.month)}</b><small>{coverage[r.coverage]}</small></div>
      <div className={styles.series}>{series.map((s,i)=>{
        const value=cashValue(r,s);
        const contents=<><span className={styles.track} aria-hidden="true"><i data-color={i} style={{width:((value??0)/max*100)+'%'}}/></span><span>{cashMoney(value)}</span></>;
        return allowDetails && value!==null
          ? <button className={styles.bar} type="button" key={s} data-source={"metricsV2.monthly."+s} aria-label={cashLabels[s]+' · '+monthLabel(r.month)+' · '+cashMoney(value)}
            aria-pressed={selectedMonth===r.month && selectedSeries===s} onClick={()=>select(model.analysisId,mode,r.month,s)}>{contents}</button>
          : <div key={s} className={styles.bar} data-source={"metricsV2.monthly."+s} aria-label={cashLabels[s]}>{contents}</div>;
      })}</div>
    </div>)}
    {model.basic.bankingFacts.operationListTruncated && <p className={styles.note}>Итоги рассчитаны по полной загрузке. Сохранён сокращённый список операций, полная расшифровка недоступна.</p>}
    {!allowDetails && <p className={styles.note}>Список операций доступен в полном анализе.</p>}
    <details className="pc-chart-data"><summary>Данные графика в таблице</summary><div className="pc-table-scroll" tabIndex={0} aria-label="Помесячное движение денег">
      <table><caption>{overview ? 'Суммы в рублях за показанные месяцы' : 'Суммы в рублях за каждый месяц выписки'}</caption><thead><tr><th>Месяц</th>{series.map(s=><th key={s}>{cashLabels[s]}</th>)}<th>Покрытие</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.month}><th scope="row">{monthLabel(r.month)}</th>{series.map(s=>{
          const value=cashValue(r,s);
          return <td key={s}>{overview && allowDetails && value!==null
            ? <button className={styles.tableValue} type="button" aria-label={cashLabels[s]+' за '+monthLabel(r.month)+' · '+cashMoney(value)}
                onClick={()=>select(model.analysisId,mode,r.month,s)}>{cashMoney(value)}</button>
            : cashMoney(value)}</td>;
        })}<td>{coverage[r.coverage]}</td></tr>)}</tbody></table>
    </div></details>
    {allowDetails && selected && isCashSeries(selectedSeries) && series.includes(selectedSeries) && cashValue(selected,selectedSeries)!==null &&
      <CashOperations key={[model.analysisId,selected.month,selectedSeries].join('/')} analysisId={model.analysisId} month={selected.month} series={selectedSeries}/>}
  </div>;
}
