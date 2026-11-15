import type {SettlementState} from '../../../lib/workspace/settlement-events';
import {SettlementDetails,type SaveSettlement} from './settlement-details';
import {Panel} from './client-insights';

const rub=(value:number|null)=>value===null?'—':value.toLocaleString('ru-RU',{maximumFractionDigits:2});
export function SettlementRegisters({rows,full,save}:{rows:SettlementState[];full:boolean;save:SaveSettlement}){
 return <div className="pc-settlement-registers">{(['buyers','suppliers','other'] as const).map(side=>{
   const items=rows.filter(row=>row.side===side),buyer=side==='buyers',other=side==='other';
   if(other&&!items.length)return null;
   const title=buyer?'Покупатели':other?'Прочие расчёты':'Поставщики';
   return <Panel key={side} title={title}><div className="pc-table-scroll"><table aria-label={title}>
     <thead><tr><th>Контрагент / договор</th><th>Счёт</th><th>{other?'Дебет':'Остаток долга'}, ₽</th><th>{other?'Кредит':buyer?'Авансы полученные':'Авансы выданные'}, ₽</th><th>Дата остатка</th><th>Договорный срок</th><th>Источник</th></tr></thead>
     <tbody>{items.map(r=><tr key={JSON.stringify([r.id,r.debit,r.credit,r.due])}><th scope="row">{r.party}{r.partyInn&&<small>ИНН {r.partyInn}</small>}<small>{r.contract??'Договор не указан'}</small></th><td>{r.account}</td><td>{rub(other?r.debit:r.remaining)}{r.paid>0&&<small>По ОСВ {rub(r.amount)} ₽</small>}</td><td>{rub(buyer||other?r.credit:r.debit)}</td><td>{r.asOf}</td><td>{r.dueDate?<time dateTime={r.dueDate}>{r.dueDate}</time>:'Уточнить по договору'}<SettlementDetails row={r} full={full} save={save}/>{r.conflict&&<small>Расхождение источников на одну дату</small>}</td><td>{r.references.map((s,i)=><div key={i}>{s.documentId?<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>{s.name}</a>:s.name} · {s.page?'стр. договора':'строка ОСВ'} {s.row}</div>)}</td></tr>)}</tbody>
   </table></div>{!items.length&&<p>Загрузите ОСВ {buyer?'62':'60'}, чтобы увидеть остатки по контрагентам и договорам.</p>}</Panel>;
 })}</div>;
}
