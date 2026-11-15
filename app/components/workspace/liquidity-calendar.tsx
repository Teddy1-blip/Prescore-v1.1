'use client';
import {useState} from 'react';
import type {WorkspaceBasicV1} from '../../../lib/workspace/model';
import {calendarEvents,cashForecast,type CalendarSources} from '../../../lib/workspace/liquidity-calendar';
import {Panel} from './client-insights';

const rub=(n:number|null)=>n===null?'—':n.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
export function LiquidityCalendar({profile,bank}:{profile:CalendarSources;bank?:WorkspaceBasicV1}){
  const [days,setDays]=useState<30|60|90|180>(30),[delay,setDelay]=useState(0),[assumptions,setAssumptions]=useState(false);
  const today=new Date().toISOString().slice(0,10),fact=bank?.bankingFacts.endingBalance;
  const bankDate=fact?.periodTo??bank?.analysis.period.to;
  const [asOf,setAsOf]=useState(today);
  const opening=fact?.status==='KNOWN'&&bankDate===asOf?fact.value:null;
  const events=calendarEvents(profile),forecast=cashForecast(events,opening,asOf,days,delay,assumptions);
  return <><Panel title="Платёжный календарь и ПДДС"><p>План с дня после выбранной даты. Поступления покупателей зависят от исполнения договоров.</p>
    <div className="pc-source-actions"><label>Остаток на дату <input type="date" value={asOf} onChange={e=>{if(e.target.value&&e.target.value.length===10)setAsOf(e.target.value);}}/></label>
    <label>Горизонт <select value={days} onChange={e=>setDays(Number(e.target.value) as typeof days)}>{[30,60,90,180].map(n=><option key={n} value={n}>{n} дней</option>)}</select></label>
    <label>Сценарий поступлений <select value={delay} onChange={e=>setDelay(Number(e.target.value))}><option value={0}>Базовый · в срок</option><option value={7}>Осторожный · на 7 дней позже</option><option value={30}>Стрессовый · на 30 дней позже</option></select></label>
    <label><input type="checkbox" checked={assumptions} onChange={e=>setAssumptions(e.target.checked)}/> Включить сценарные записи клиента</label></div>
    {bankDate&&fact?.value!=null&&bankDate!==asOf&&<button type="button" onClick={()=>setAsOf(bankDate)}>Рассчитать от банковского остатка на {bankDate}</button>}
    <p>Начальный остаток · {rub(opening)}. Горизонт до {forecast.end}.</p>
    {opening===null?<p>Для прогноза остатка нужна выписка с подтверждённым сальдо на выбранную дату.</p>:forecast.rows.length===0?<p>Добавьте датированные события на этот период, чтобы оценить минимум и дефицит.</p>:<p>Минимальный остаток на конец дня · <strong>{rub(forecast.minimum)}</strong> на {forecast.minDate}. {forecast.firstGap?'Первый дефицит '+forecast.firstGap+'. Сверьте платежи этого дня и согласуйте перенос или более раннее поступление.':'По включённым событиям дефицита на конец дня нет.'}</p>}
    <div className="pc-table-scroll pc-register"><table aria-label="Прогноз остатка"><thead><tr>{['Дата','Поступления','Выплаты','Остаток','Причина изменения'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{forecast.daily.map(d=><tr key={d.date}><th>{d.date}</th><td>{rub(d.incoming)}</td><td>{rub(d.outgoing)}</td><td>{rub(d.balance)}</td><td>{d.items.join(', ')}</td></tr>)}</tbody></table></div>
    </Panel><Panel title="Реестр событий"><div className="pc-table-scroll pc-register"><table aria-label="Реестр событий"><thead><tr>{['Дата по основанию','Вид','Назначение','Сумма','Источник'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.type}</td><th>{e.label}</th><td>{e.direction==='IN'?'+':'−'}{rub(e.amount)}</td><td>{e.basis}{e.ambiguous&&<small>Совпали дата и сумма. Запись исключена из прогноза до сверки.</small>}</td></tr>)}</tbody></table></div>{!events.length&&<p>Добавьте график обязательства, подтвердите срок по ОСВ или внесите плановое событие ниже.</p>}</Panel></>;
}
