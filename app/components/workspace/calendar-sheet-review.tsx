'use client';
import {useState} from 'react';
import {mapSheetRow,type SheetMapping} from '../../../lib/workspace/calendar-sheet';
import {Panel} from './client-insights';

type Sheet={id:string;name:string;rows:string[][];confirmed:number[]};
export function CalendarSheetReview({sheet,confirm}:{sheet:Sheet;confirm:(m:SheetMapping,rows:number[])=>Promise<void>}){
 const [map,set]=useState<SheetMapping>({header:0,date:0,amount:1,purpose:2,direction:'OUT'}),[selected,select]=useState<number[]>([]),[busy,wait]=useState(false),[msg,notice]=useState('');
 const change=(v:Partial<SheetMapping>)=>{set({...map,...v});select([]);notice('');};
 const columns=sheet.rows[map.header]??[];
 const available=sheet.rows.map((_,i)=>({i,entry:mapSheetRow(sheet.rows,map,i,sheet.name)})).filter(o=>o.entry);
 return <Panel title={'Сопоставление колонок · '+sheet.name}><p>Выберите заголовок и три колонки. Подтверждайте отдельные датированные платежи. Месячный ПДДС используется как план за период и не задаёт даты выплат.</p>
 <label>Номер строки заголовков <input type="number" min="1" max={sheet.rows.length} value={map.header+1} onChange={e=>change({header:Math.max(0,Math.min(sheet.rows.length-1,Number(e.target.value)-1))})}/></label>
 {(['date','amount','purpose'] as const).map(k=><label key={k}>{{date:'Дата',amount:'Сумма, ₽',purpose:'Назначение'}[k]} <select value={map[k]} onChange={e=>change({[k]:Number(e.target.value)})}>{columns.map((v,i)=><option key={i} value={i}>{i+1} · {v}</option>)}</select></label>)}
 <label>Направление выбранных строк <select value={map.direction} onChange={e=>change({direction:e.target.value as 'IN'|'OUT'})}><option value="OUT">Выплата</option><option value="IN">Поступление</option></select></label>
 <div className="pc-table-scroll pc-register"><table><thead><tr>{['Выбрать','Строка','Дата','Назначение','Сумма, ₽'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{available.map(({i,entry})=><tr key={i}><td><input aria-label={'Строка '+(i+1)} type="checkbox" disabled={sheet.confirmed.includes(i)||busy} checked={sheet.confirmed.includes(i)||selected.includes(i)} onChange={e=>select(e.target.checked?[...selected,i]:selected.filter(j=>j!==i))}/></td><td>{i+1}</td><td>{entry!.date}</td><td>{entry!.purpose}</td><td>{entry!.amount.toLocaleString('ru-RU')}</td></tr>)}</tbody></table></div>
 {!available.length&&<p>Нужны календарная дата, сумма и назначение в одной строке. Проверьте соответствие колонок.</p>}
 <button disabled={!selected.length||selected.length>250||busy} onClick={async()=>{wait(true);try{await confirm(map,selected);select([]);notice('Выбранные события сохранены.');}catch(e){notice((e as Error).message);}finally{wait(false);}}}>Подтвердить выбранные строки ({selected.length})</button>{msg&&<p role="status">{msg}</p>}</Panel>;
}
