'use client';
import {useState,type FormEvent} from 'react';
import {Panel} from './client-insights';
import type {ManualDebt} from '../../../lib/workspace/manual-debt';

export function ManualDebtForm({save}:{save:(entry:ManualDebt)=>Promise<void>}){
 const [pending,busy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget,f=new FormData(form),str=(k:string)=>String(f.get(k)??'');busy(true);setMessage('');
 try{await save({creditor:str('creditor'),creditorInn:str('inn'),contract:str('contract'),contractDate:str('contractDate'),asOf:str('asOf'),principal:Number(str('principal')),product:str('product') as ManualDebt['product'],basis:str('basis')});form.reset();setMessage('Подтверждение сохранено в кредитном портфеле.');}catch(e){setMessage((e as Error).message);}finally{busy(false);}}
 return <Panel title="Уточнить остаток по договору"><details><summary>Внести подтверждение вручную</summary><form onSubmit={submit}><fieldset disabled={pending}><label>Кредитор <input name="creditor" required maxLength={160}/></label><label>ИНН кредитора при наличии <input name="inn" pattern="[0-9]{10}|[0-9]{12}"/></label><label>Номер договора <input name="contract" required maxLength={120}/></label><label>Дата договора <input name="contractDate" type="date" required/></label><label>Вид обязательства <select name="product"><option value="TERM_LOAN">Кредит</option><option value="CREDIT_LINE">Кредитная линия</option><option value="OVERDRAFT">Овердрафт</option><option value="LEASING">Лизинг</option><option value="OTHER_DEBT">Прочее</option></select></label><label>Дата остатка <input name="asOf" type="date" max={new Date().toISOString().slice(0,10)} required/></label><label>Основной долг, ₽ <input name="principal" type="number" min="0" step=".01" required/></label><label>Основание <input name="basis" required maxLength={320}/></label><label><input type="checkbox" required/> Подтверждаю сумму и дату по указанному основанию</label><button>Сохранить подтверждение</button></fieldset></form>{message&&<p role="status">{message}</p>}</details></Panel>;
}
