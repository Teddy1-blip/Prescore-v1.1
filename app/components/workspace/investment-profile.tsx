'use client';
import {useState} from 'react';
import {businessValue} from '../../../lib/workspace/investment-model';
import {Panel} from './client-insights';

const number=(v:string)=>v.trim()!==''&&Number.isFinite(Number(v.replace(',','.')))?Number(v.replace(',','.')):null;
const fmt=(v:number)=>Math.round(v).toLocaleString('ru-RU')+' ₽';
export function InvestmentProfile(){
  const [values,set]=useState<Record<string,string>>({});
  const field=(key:string,title:string)=> <label key={key}>{title} <input type="text" inputMode="decimal" value={values[key]??''} onChange={e=>set({...values,[key]:e.target.value})}/></label>;
  const val=(k:string)=>number(values[k]??''),flows=[val('y1'),val('y2'),val('y3')],r=val('r'),g=val('g'),debt=val('debt'),ebitda=val('ebitda'),multiple=val('multiple');
  const ready=flows.every((n):n is number=>n!==null)&&r!==null&&g!==null;
  const result=ready?businessValue(flows as number[],r!,g!,debt):null;
  return <Panel title="Инвестиционный профиль"><details><summary>Демонстрационная оценка бизнеса</summary><p>Введите собственные предпосылки в рублях. Результат относится только к этому сценарию и рассчитывается отдельно от Prescore Index.</p>
  <fieldset><legend>Дисконтированные денежные потоки</legend>{[1,2,3].map(i=>field('y'+i,'Свободный поток для компании (FCFF), год '+i))}{field('r','Ставка дисконтирования WACC, %')}{field('g','Долгосрочный рост после третьего года, %')}{field('debt','Чистый долг на дату оценки, ₽')}</fieldset>
  {result?<><p>Стоимость бизнеса EV · <strong>{fmt(result.ev)}</strong>{result.equity!==null&&' · Стоимость капитала '+fmt(result.equity)}</p><p>Терминальная стоимость рассчитана по модели постоянного роста. Потоки дисконтируются на конец каждого года.</p><table><caption>Чувствительность EV к WACC</caption><thead><tr><th>WACC</th><th>EV</th></tr></thead><tbody>{[-2,0,2].map(delta=>{const value=businessValue(flows as number[],r!+delta,g!,debt);return <tr key={delta}><td>{r!+delta}%</td><td>{value?fmt(value.ev):'Вне области модели'}</td></tr>})}</tbody></table></>:<p>Укажите три FCFF, положительный поток третьего года и ставку дисконтирования выше долгосрочного роста.</p>}
  <fieldset><legend>Сравнительная оценка EV / EBITDA</legend>{field('ebitda','Сопоставимая годовая EBITDA, ₽')}{field('multiple','Мультипликатор из выбранного вами сопоставимого источника, ×')}<label>Источник и дата мультипликатора <input value={values.source??''} onChange={e=>set({...values,source:e.target.value})}/></label></fieldset>
  {ebitda!==null&&multiple!==null&&ebitda>0&&multiple>0&&values.source?.trim()&&<p>Стоимость бизнеса EV · {fmt(ebitda*multiple)}{debt!==null&&' · Стоимость капитала '+fmt(ebitda*multiple-debt)} · {values.source}</p>}</details></Panel>;
}
