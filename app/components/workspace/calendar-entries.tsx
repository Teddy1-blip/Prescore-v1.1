'use client';
import {useState,type FormEvent} from 'react';
import {Panel} from './client-insights';
import type {CalendarEntry} from '../../../lib/workspace/calendar-entry';
export function CalendarEntries({items,save}:{items:CalendarEntry[];save:(entry:CalendarEntry,key:string)=>Promise<void>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[key,setKey]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const fields=new FormData(event.currentTarget);setBusy(true);setError('');
  try{await save({date:String(fields.get('date')),amount:Number(fields.get('amount')),direction:fields.get('direction') as CalendarEntry['direction'],purpose:String(fields.get('purpose')),source:String(fields.get('source')),certainty:fields.get('certainty') as CalendarEntry['certainty']},key);setOpen(false);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Panel title="Плановые поступления и платежи">
 <button onClick={()=>{setKey(crypto.randomUUID());setOpen(true)}} disabled={open}>Добавить платёж / поступление</button>
 {open&&<form onSubmit={submit}><fieldset disabled={busy}><label>Дата <input name="date" type="date" required/></label><label>Направление <select name="direction"><option value="OUT">Платёж</option><option value="IN">Поступление</option></select></label><label>Сумма, ₽ <input name="amount" type="number" step=".01" min=".01" required/></label><label>Назначение <input name="purpose" maxLength={240} required/></label><label>Основание <input name="source" maxLength={240} required/></label><label>Вид записи <select name="certainty"><option value="DECLARED">Указано пользователем</option><option value="SCENARIO">Сценарное предположение</option></select></label><button>Сохранить событие</button><button type="button" onClick={()=>setOpen(false)}>Отменить</button></fieldset></form>}
 {error&&<p role="alert">{error}</p>}
 {items.map((e,i)=><p key={i}>{e.date} · {e.direction==='IN'?'Поступление':'Платёж'} · {e.amount.toLocaleString('ru-RU')} ₽ · {e.purpose} · {e.source} · {e.certainty==='SCENARIO'?'Сценарий':'Указано пользователем'}</p>)}
 </Panel>;
}
