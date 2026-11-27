'use client';
import {useState,type FormEvent} from 'react';
import type {SettlementEvent,SettlementState} from '../../../lib/workspace/settlement-events';

export type SaveSettlement=(entry:Partial<SettlementEvent>,key:string,revision:string)=>Promise<void>;
const titles={DUE:'Подтвердить срок',PAYMENT:'Связать оплату с выпиской',TASK:'Добавить задачу',PROMISE:'Записать обещание оплаты'};
export function SettlementDetails({row,full,save}:{row:SettlementState;full:boolean;save:SaveSettlement}){
  const [kind,setKind]=useState<keyof typeof titles>('DUE'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[key,setKey]=useState('');
  const [open,setOpen]=useState(false);
  const today=new Date().toISOString().slice(0,10);
  const late=row.dueDate&&row.remaining!==null&&row.remaining>0&&!row.conflict?Math.max(0,Math.floor((Date.parse(today)-Date.parse(row.dueDate))/86400000)):null;
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');
    try{await save({kind,position:row.id,asOf:row.asOf,note:String(f.get('note')),date:String(f.get('date')??''),bankId:String(f.get('bank')??'')},key,row.revision);setOpen(false);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(row.side==='other')return null;
  return <details><summary>Действия и история</summary>
    <p>Связанные оплаты после даты ОСВ · {row.paid.toLocaleString('ru-RU')} ₽</p>
    {full&&late!==null&&<p>{late?'После подтверждённого срока прошло '+late+' дн.':'Договорный срок ещё не прошёл.'} Остаток рассчитан по загруженным источникам.</p>}
    {full&&row.side==='buyers'&&row.remaining!==null&&row.remaining>0&&<p>{row.conflict?'Сверьте противоречащие документы до обсуждения финансирования.':row.contract&&row.dueDate?'Для обсуждения факторинга проверьте документы исполнения, условия уступки и наличие возражений покупателя.':'Для оценки применимости факторинга привяжите договор, подтверждение исполнения и срок оплаты.'}</p>}
    {row.history.map(e=><p key={e.id}><strong>{titles[e.kind]}</strong> · {e.date} · {e.note}{e.amount!==undefined&&' · '+e.amount.toLocaleString('ru-RU')+' ₽'}<small>Записано {new Date(e.recordedAt).toLocaleString('ru-RU')}</small></p>)}
    {!row.conflict&&!open&&<button type="button" onClick={()=>{setKey(crypto.randomUUID());setOpen(true);setError('');}}>Изменить по основанию</button>}
    {open&&<form onSubmit={submit}><fieldset disabled={busy}><label>Действие <select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{(Object.keys(titles) as (keyof typeof titles)[]).filter(k=>(full||k==='DUE'||k==='PAYMENT')&&(k!=='PAYMENT'||row.candidates.length>0)).map(k=><option key={k} value={k}>{titles[k]}</option>)}</select></label>
    {kind==='PAYMENT'?<label>Банковская операция <select name="bank" required>{row.candidates.map(p=><option key={p.id} value={p.id}>{p.date} · {p.amount.toLocaleString('ru-RU')} ₽ · {p.source}</option>)}</select></label>:<label>Дата <input name="date" type="date" required/></label>}
    <label>Основание или комментарий <input name="note" maxLength={320} required/></label><button>Сохранить</button> <button type="button" onClick={()=>setOpen(false)}>Отмена</button></fieldset></form>}
    {error&&<p role="alert">{error}</p>}
  </details>;
}
