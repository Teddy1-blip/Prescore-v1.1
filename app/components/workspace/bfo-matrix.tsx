'use client';
import {createContext,Fragment,useEffect,useRef,useState} from 'react';
import {financialLabel} from '../../../lib/credit-engine/client-report/source-detail.ts';
import {statementGroups,statementColumns,statementCodes,statementNumber,displayUnits,type StatementMatrix,type StatementField,type StatementColumn} from '../../../lib/workspace/statement-matrix.ts';
import './bfo-matrix.css';

export const DossierMatrixContext=createContext<StatementMatrix|null>(null);
const totals=new Set(['1100','1200','1300','1400','1500','1600','1700','2100','2200','2300','2400']);
export function BfoMatrix({matrix,onPeriod}:{matrix:StatementMatrix;onPeriod?:(id:string)=>void}){
  const [unit,setUnit]=useState(1000),[range,setRange]=useState('recent'),[compact,setCompact]=useState(false);
  const [folded,setFolded]=useState<string[]>([]),[focus,setFocus]=useState<{id:string;field:StatementField}|null>(null);
  const panel=useRef<HTMLElement>(null);
  const trigger=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{if(focus)panel.current?.focus();},[focus]);
  function closeEvidence(){setFocus(null);trigger.current?.focus();}
  const all=statementColumns(matrix,range==='history');
  const years=all.filter(c=>c.annual),cutoff=years.at(-4)?.year??0;
  const columns=all.filter(c=>range!=='recent'||!c.annual||c.year>=cutoff);
  const focused=focus&&columns.find(c=>c.id===focus.id)?.period;
  const selected=focused?.selected,field=focus?.field;
  const cell=field&&selected?.values[field];
  function toggle(group:string){setFolded(previous=>previous.includes(group)?previous.filter(g=>g!==group):[...previous,group]);}
  function periodGroup(cs:StatementColumn[],annual:boolean){
    const count=cs.filter(c=>c.annual===annual).length;
    return count>0&&<th scope="colgroup" colSpan={count}>{annual?'Годовая отчётность':'Промежуточная отчётность'}</th>;
  }
  if(!all.length)return null;
  return <section className="bfo-matrix" aria-label="Многолетняя бухгалтерская отчётность">
    <header className="bfo-matrix-head"><div><h2>Бухгалтерская отчётность по периодам</h2><p>РСБУ · ИНН {matrix.inn}</p></div>
      <div className="bfo-controls"><label>Периоды<select aria-label="Периоды" value={range} onChange={e=>{setRange(e.target.value);setFocus(null);}}>
        <option value="recent">Последние годы</option><option value="all">Все годы</option><option value="history">История с кварталами</option>
      </select></label><label>Единица<select aria-label="Единица отображения" value={unit} onChange={e=>setUnit(Number(e.target.value))}>{Object.entries(displayUnits).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/> Только итоги</label></div></header>
    {(['Ф1','Ф2'] as const).map(form=><section key={form}><h3>{form==='Ф1'?'Ф1 · Бухгалтерский баланс':'Ф2 · Финансовые результаты'}</h3>
      <div className="bfo-scroll" role="region" aria-label={form+' · отчётные периоды'} tabIndex={0}>
      <table><thead><tr><th rowSpan={2} scope="col">Показатель<small>{displayUnits[unit]}</small></th>{periodGroup(columns,true)}{periodGroup(columns,false)}</tr>
      <tr>{columns.map(c=><th key={c.id} scope="col">{c.title}{!c.annual&&<small>{form==='Ф1'?c.period?.period.asOf:c.basis}</small>}</th>)}</tr></thead>
      <tbody>{statementGroups.filter(g=>g.form===form).map(g=><Fragment key={g.title}>
        <tr className="bfo-group"><th scope="row"><button type="button" aria-expanded={!folded.includes(g.title)} onClick={()=>toggle(g.title)}>{folded.includes(g.title)?'▸':'▾'} {g.title}</button></th><td colSpan={columns.length}/></tr>
        {!folded.includes(g.title)&&g.fields.filter(key=>!compact||totals.has(statementCodes[key])).map(key=><tr key={key} className={totals.has(statementCodes[key])?'bfo-total':undefined}>
          <th scope="row">{financialLabel(key)}<small>{statementCodes[key]}</small></th>
          {columns.map(c=>{const fact=c.period?.selected.values[key];return <td key={c.id}>{fact?
            <button type="button" aria-label={[financialLabel(key),c.title,c.basis,statementNumber(fact.value,unit),displayUnits[unit]].join(' · ')} aria-pressed={focus?.id===c.id&&field===key} onClick={e=>{trigger.current=e.currentTarget;setFocus({id:c.id,field:key});onPeriod?.(c.id);}}>
              {statementNumber(fact.value,unit)}</button>:<span className="bfo-blank">—</span>}</td>;})}</tr>)}
      </Fragment>)}</tbody></table></div></section>)}
    {columns.filter(c=>c.period?.difference!=null&&c.period.difference!==0).map(c=><p key={c.id} className="bfo-discrepancy">{c.title} · Расхождение строк 1600 и 1700 · {statementNumber(c.period!.difference!,1)} ₽</p>)}
    {focused&&field&&cell&&selected&&<aside className="bfo-evidence" ref={panel} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape')closeEvidence();}} aria-label="Основание показателя" aria-live="polite">
      <button className="bfo-close" onClick={closeEvidence} aria-label="Закрыть основание">×</button>
      <h3>{financialLabel(field)} · {statementCodes[field]}</h3><p>{focused.period.from} — {focused.period.asOf}</p>
      <strong>{statementNumber(cell.value,1)} ₽</strong><p>В источнике · {statementNumber(cell.original,1)} {displayUnits[selected.scale??1]}</p>
      <p>{selected.name} · Получен {selected.received.slice(0,10)} · Достоверность {cell.confidence==='HIGH'?'высокая':'средняя'}</p>
      {focused.changes?.[field]&&<p>Изменение к сопоставимому периоду на {focused.changes[field].previousDate} · {statementNumber(focused.changes[field].value,1)} ₽</p>}
      {selected.documentId&&<a href={'/api/documents?download='+encodeURIComponent(selected.documentId)}>Открыть оригинал</a>}
      {focused.difference!==null&&['ASSETS_TOTAL','BALANCE_TOTAL'].includes(field)&&<p>Разница строк 1600 и 1700 · {statementNumber(focused.difference,1)} ₽</p>}
      {focused.alternatives.map(s=><p key={s.id}>Другой источник · {s.name} · {s.received.slice(0,10)} · {statementNumber(s.values[field]?.value,1)} ₽ {s.documentId&&<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>Оригинал</a>}</p>)}
    </aside>}
  </section>;
}
