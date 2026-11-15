'use client';
import {useState} from 'react';
import type {SettlementState} from '../../../lib/workspace/settlement-events';
import type {CounterpartyCheck} from '../../../lib/workspace/dossier-sources';
import {Panel} from './client-insights';
export function ReceivablesReview({rows,checks,refresh}:{rows:SettlementState[];checks:CounterpartyCheck[];refresh:(inn:string)=>Promise<void>}){
 const [active,set]=useState(''),[error,notice]=useState('');
 const today=new Date().toISOString().slice(0,10);
 const buyers=rows.filter(r=>r.side==='buyers'&&!r.conflict&&r.remaining!==null&&r.remaining>0);
 const buckets=['Срок не подтверждён','В пределах срока','1–30 дней','31–60 дней','61–90 дней','Свыше 90 дней'].map(label=>({label,count:0,cents:0}));
 for(const r of buyers){
   const days=r.dueDate?(Date.parse(today)-Date.parse(r.dueDate))/86400000:null;
   const i=days===null?0:days<=0?1:days<=30?2:days<=60?3:days<=90?4:5;
   buckets[i].count++;buckets[i].cents+=Math.round(r.remaining!*100);
 }
 const reminders=buyers.flatMap(r=>r.history.filter(e=>e.kind==='TASK'||e.kind==='PROMISE').map(e=>({...e,party:r.party}))).sort((a,b)=>a.date.localeCompare(b.date));
 const parties=[...new Map(buyers.filter(r=>r.partyInn?.length===10).map(r=>[r.partyInn!,r.party])).entries()];
 return <><Panel title="Возрастная структура дебиторской задолженности"><p>Дни после подтверждённого срока на {today}. Остатки учитывают загруженные ОСВ и связанные оплаты. Расхождения вынесены на сверку в реестре.</p>
 <div className="pc-table-scroll pc-register"><table><thead><tr><th>Срок</th><th>Требования</th><th>Остаток, ₽</th></tr></thead><tbody>{buckets.filter(b=>b.count>0).map(b=><tr key={b.label}><th>{b.label}</th><td>{b.count}</td><td>{(b.cents/100).toLocaleString('ru-RU')}</td></tr>)}</tbody></table></div>
 {!buyers.length&&<p>Загрузите ОСВ 62, чтобы распределить подтверждённые требования по срокам.</p>}</Panel>
 {reminders.length>0&&<Panel title="Задачи и обещания оплаты">{reminders.map(e=><p key={e.id}>{e.date} · {e.party} · {e.kind==='TASK'?'Задача':'Обещание'} · {e.note}</p>)}</Panel>}
 {parties.length>0&&<Panel title="Публичные события покупателей">{parties.map(([inn,name])=>{const c=checks.find(check=>check.inn===inn);
 return <section key={inn}><h3>{name}</h3>{c&&<p>Checko · {c.fetchedAt.slice(0,10)} · Судебные события: {c.cases??'покрытие уточняется'}. Исполнительные производства: {c.enforcements??'покрытие уточняется'}.</p>}{c&&((c.cases??0)>0||(c.enforcements??0)>0)&&<p>Проверьте предмет дела и исполнение этого договора перед изменением отсрочки.</p>}<button disabled={!!active} onClick={async()=>{set(inn);notice('');try{await refresh(inn);}catch(e){notice((e as Error).message);}finally{set('');}}}>{active===inn?'Проверяем…':'Проверить в Checko'}</button></section>})}{error&&<p role="status">{error}</p>}</Panel>}</>;
}
