'use client';
import Link from 'next/link';
import type {Lead,Application,EventRow} from '../../../lib/agent/types';
import {applicationUrl,clientUrl} from '../../../lib/agent/workflow';
import {amount,Badge,day,Notice,PageHeader,Section,useAgentRead} from './data';

type Desk={metrics:{clients:number;analyzed:number;active:number;documents:number;approved:number};forecast:number;
  pending:Lead[];leads:Lead[];applications:Application[];events:EventRow[]};
function MetricCard({label,value,href}:{label:string;value:number;href:string}){
  return <Link className="ag-metric" href={href}><span>{label}</span><strong>{value}</strong></Link>;
}
function TaskQueue({data}:{data:Desk}){
  const tasks=[...data.applications.map(a=>({id:a.id,href:applicationUrl(a.id),name:a.companyName,status:a.status,
    detail:[a.product,a.bank].filter(Boolean).join(' · '),step:a.nextAction||'Открыть заявку и согласовать следующий шаг',date:a.updatedAt})),
    ...data.pending.map(l=>({id:l.id,href:clientUrl(l.id),name:l.companyName,status:l.status,
      detail:l.contactName,step:'Запросить банковскую выписку у клиента',date:l.updatedAt}))];
  return <Section title="Сегодня в работе" action={<Link href="/agent/pipeline">Вся воронка →</Link>}>
    {tasks.length?<ul className="ag-queue">{tasks.map(t=><li key={t.href}><div><Link href={t.href}>{t.name}</Link>{t.detail&&<small>{t.detail}</small>}<p>{t.step}</p></div>
      <div><Badge value={t.status}/><small>{day(t.date)}</small></div><Link className="ag-arrow" href={t.href} aria-label={'Открыть — '+t.name}>↗</Link></li>)}</ul>:
      <p className="ag-empty">Очередь свободна. <Link href="/agent/clients?action=new">Добавить первого клиента</Link></p>}
  </Section>;
}
export function AgentDesk(){
  const state=useAgentRead<Desk>('/api/agent?surface=home'),d=state.data;
  return <><PageHeader title="Рабочий стол"><Link href="/agent/clients?action=new" className="ag-primary">+ Добавить клиента</Link></PageHeader>
    {!d?<Notice {...state}/>:<><div className="ag-metrics">
      <MetricCard label="Клиенты всего" value={d.metrics.clients} href="/agent/clients"/>
      <MetricCard label="С анализом" value={d.metrics.analyzed} href="/agent/clients?filter=ready"/>
      <MetricCard label="Без анализа" value={Number(d.metrics.clients)-Number(d.metrics.analyzed)} href="/agent/clients?filter=missing"/>
      <MetricCard label="Активные заявки" value={d.metrics.active} href="/agent/applications?filter=active"/>
      <MetricCard label="Требуются документы" value={d.metrics.documents} href="/agent/applications?filter=documents"/>
      <MetricCard label="Одобрено / выдано" value={d.metrics.approved} href="/agent/applications?filter=approved"/>
    </div><div className="ag-desk"><TaskQueue data={d}/><div className="ag-stack"><Section title="Быстрые действия"><div className="ag-links">
      <Link href="/agent/applications?action=new">Создать заявку →</Link><Link href="/agent/leads">Импортировать базу →</Link><Link href="/agent/pipeline">Открыть воронку →</Link></div></Section>
      {d.forecast>0&&<Section title="Прогноз вознаграждения"><strong>{amount(d.forecast)}</strong><p>Оценка по заявкам. Фактические начисления — в разделе комиссий.</p></Section>}</div></div>
    <div className="ag-pair"><Section title="Последние клиенты">{d.leads.length?d.leads.map(l=><p key={l.id}><Link href={clientUrl(l.id)}>{l.companyName}</Link> <small>{day(l.createdAt)}</small></p>):<p>Здесь появятся добавленные компании.</p>}</Section>
      <Section title="Изменения заявок">{d.events.length?d.events.map((e,i)=><p key={i}><Link href={applicationUrl(e.applicationId,'history')}>{e.companyName}</Link> · {e.status} <small>{day(e.createdAt)}</small></p>):<p>История появится при создании первой заявки.</p>}</Section></div></>}</>;
}
