'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {GuaranteePolicy} from '../../../lib/bank-guarantees';
import type {AgentIdentity,CuratedAgent,EventRow} from '../../../lib/agent/types';
import {applicationUrl} from '../../../lib/agent/workflow';
import {amount,day,Notice,PageHeader,Pager,Section,useAgentRead} from './data';
import {PartnerBilling} from '../../components/workspace/billing';

export function PartnersPage(){
  const state=useAgentRead<AgentIdentity&{guaranteePolicies:GuaranteePolicy[]}>('/api/agent?surface=partners'),[q,setQ]=useState('');
  const offers=(state.data?.offerOptions??[]).filter(o=>(o.bank+' '+o.kind+' '+o.product).toLowerCase().includes(q.toLowerCase()));
  const policies=(state.data?.guaranteePolicies??[]).filter(p=>p.providerConfirmed&&(p.provider+' гарантия '+p.laws.join(' ')).toLowerCase().includes(q.toLowerCase()));
  return <><PageHeader title="Банки и партнёры" subtitle="Каталог направлений и условия для подготовки заявки. Решение по заявке сообщает партнёр."/>
    <div className="ag-filter"><label>Поиск по каталогу<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Партнёр или продукт"/></label></div>
    {!state.data?<Notice {...state}/>:<Section title="Финансирование"><div className="ag-grid">{offers.map(o=><article className="ag-app" key={o.id}><small>{o.kind}</small><h3>{o.bank}</h3><p>{o.product}</p></article>)}</div>{!offers.length&&<p>Маршрутов по запросу нет.</p>}</Section>}
    {policies.length>0&&<Section title="Банковские гарантии"><div className="ag-grid">{policies.map(p=><article key={p.id} className="ag-app"><h3>{p.provider}</h3><p>{p.laws.join(' · ')}</p><small>Диапазон по политике</small><strong>{amount(p.minAmount)} — {amount(p.maxAmount)}</strong>{p.maxTermDays&&<small>До {p.maxTermDays} дней</small>}</article>)}</div></Section>}</>;
}
export function CommissionsPage(){
  const state=useAgentRead<{forecast:number}>('/api/agent?surface=home');
  return <><PartnerBilling/>{(state.data?.forecast??0)>0&&<Section title="Прогноз комиссии по сделкам"><strong>{amount(state.data!.forecast)}</strong><p>Оценка по текущим заявкам. Выплаты и начисления показаны в реестре выше.</p></Section>}</>;
}
function Referral({title,path}:{title:string;path:string}){
  const [hint,setHint]=useState('');
  return <Section title={title}><a className="ag-ref" href={path}>{path}</a><button onClick={async()=>{try{await navigator.clipboard.writeText(new URL(path,window.location.origin).href);setHint('Ссылка скопирована');}catch{setHint('Скопируйте адрес ссылки вручную.');}}}>Копировать ссылку</button>{hint&&<small role="status">{hint}</small>}</Section>;
}
export function NetworkPage(){
  const [page,setPage]=useState(1),state=useAgentRead<AgentIdentity&{agents:(CuratedAgent&{accruedMinor?:number})[];referralPath:string;hasNext:boolean}>('/api/agent?surface=network&page='+page+'&limit=25'),d=state.data;
  return <><PageHeader title="Агентская сеть" subtitle="Агент получает 30% от оплаченных подписок своих клиентов. Для действующей кураторской связи применяется доля 10%."/>
    {!d?<Notice {...state}/>:<><div className="ag-pair"><Referral title="Пригласить клиента" path={d.agent.referralPath}/><Referral title="Пригласить агента" path={d.referralPath}/></div>
      <Section title="Приглашённые агенты">{d.agents.length?<ul className="ag-queue">{d.agents.map(a=><li key={a.agentCode}><div><strong>{a.name}</strong><small>{[a.city,a.agency].filter(Boolean).join(' · ')}</small></div><span>{a.clientsCount} клиентов · {a.activeSubscriptions} активных подписок</span>{a.accruedMinor!=null&&<span>Начислено {amount(Number(a.accruedMinor)/100)}</span>}</li>)}</ul>:<p>Агенты появятся после регистрации по вашей ссылке.</p>}
      <Link href="/agent/commissions">Открыть начисления →</Link></Section><Pager page={page} change={setPage} next={d.hasNext}/></>}</>;
}
export function NotificationsPage(){
  const [page,setPage]=useState(1),state=useAgentRead<{events:EventRow[];hasNext:boolean}>('/api/agent?surface=notifications&page='+page);
  return <><PageHeader title="Уведомления" subtitle="Изменения статусов доступных заявок."/><Section title="Последние события">
    {!state.data?<Notice {...state}/>:<>{state.data.events.map(e=><p key={e.id}><small>{day(e.createdAt)}</small> <Link href={applicationUrl(e.applicationId,'history')}>{e.companyName}</Link> · {e.status}</p>)}
    {!state.data.events.length&&<p>Новых событий по заявкам пока нет.</p>}<Pager page={page} next={state.data.hasNext} change={setPage}/></>}</Section></>;
}
