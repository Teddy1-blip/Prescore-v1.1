'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {AgentIdentity,Application,Lead} from '../../../lib/agent/types';
import {clientStatuses,applicationStatuses,clientUrl,applicationUrl,stages} from '../../../lib/agent/workflow';
import {BrokerClientSummary} from '../../components/workspace/broker-client-summary';
import {LeadForm,ApplicationForm} from '../../components/workspace/broker-operations';
import {amount,Badge,day,Notice,PageHeader,Pager,StatusControl,useAgentRead} from './data';
type Rows=AgentIdentity&{asOf:string;leads:Lead[];applications:Application[];hasNext:boolean};
export function ApplicationCreate({close,saved,lead}:{close:()=>void;saved:()=>void;lead?:Lead}){
  const state=useAgentRead<Rows>('/api/agent?surface=clients&limit=50');
  if(!state.data)return <Notice {...state}/>;
  return <ApplicationForm leads={lead?[lead]:state.data.leads} initialLeadId={lead?.id} offers={state.data.offerOptions} close={close} saved={saved}/>;
}
function FilterBar({label,q,onQuery,filter,onFilter,options,status,onStatus,statuses}:{label:string;q:string;onQuery:(q:string)=>void;
  filter:string;onFilter:(q:string)=>void;options:string[][];status:string;onStatus:(q:string)=>void;statuses:string[]}){
  return <div className="ag-filter"><label>Поиск<input type="search" placeholder={label} value={q} onChange={e=>onQuery(e.target.value)}/></label>
    <label>Показать<select value={filter} onChange={e=>onFilter(e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
    <label>Этап<select value={status} onChange={e=>onStatus(e.target.value)}><option value="">Все этапы</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label></div>;
}
function useListing(surface:string,initialFilter:string){
  const [q,setQ]=useState(''),[filter,setFilter]=useState(initialFilter),[status,setStatus]=useState(''),[page,setPage]=useState(1);
  const params=new URLSearchParams({surface,q,filter,status,page:String(page),limit:'25'});
  const state=useAgentRead<Rows>('/api/agent?'+params);
  return {state,page,setPage,props:{q,filter,status,onQuery:(v:string)=>{setQ(v);setPage(1);},onStatus:(v:string)=>{setStatus(v);setPage(1);},
    onFilter:(v:string)=>{setFilter(v);setPage(1);}}};
}
function ClientTable({leads}:{leads:Lead[]}){
  return <div className="ag-table-wrap"><table className="ag-table"><thead><tr>{['Компания / контакт','Этап','Анализ','Заявки','Следующий шаг','Последняя активность'].map(t=><th key={t}>{t}</th>)}</tr></thead>
    <tbody>{leads.map(l=><tr key={l.id}><td><Link href={clientUrl(l.id)}>{l.companyName}</Link><small>{[l.companyInn,l.contactName,l.phone||l.email].filter(Boolean).join(' · ')}</small><small>{l.source}</small>{l.activeSubscription&&<small>Активная подписка</small>}</td>
      <td data-label="Этап"><Badge value={l.status}/></td><td data-label="Анализ">{l.analysisId?<Link href={clientUrl(l.id,'credit-profile')}>Открыть анализ</Link>:'Ожидает выписку'}</td>
      <td data-label="Активные заявки">{Number(l.activeCount||0)}</td><td data-label="Следующий шаг">{l.nextAction||(l.analysisId?'Обсудить результат':'Запросить выписку')}</td>
      <td data-label="Активность">{day(l.updatedAt||l.createdAt)}</td></tr>)}</tbody></table></div>;
}
export function ClientsPage({initialFilter='',create=false}:{initialFilter?:string;create?:boolean}){
  const {state,page,setPage,props}=useListing('clients',initialFilter),[open,setOpen]=useState(create),[notice,setNotice]=useState('');
  return <><PageHeader title="Клиенты"><button className="ag-primary" onClick={()=>setOpen(true)}>+ Добавить клиента</button></PageHeader>
    <FilterBar {...props} statuses={clientStatuses} label="Компания, ИНН или контакт" options={ [['','Все клиенты'],['ready','С анализом'],['missing','Без анализа']] }/>
    {notice&&<p role="status">{notice}</p>}{open&&<LeadForm close={()=>setOpen(false)} saved={()=>{setOpen(false);setNotice('Клиент добавлен');setPage(1);state.reload();}}/>}
    {!state.data?<Notice {...state}/>:<>{state.data.leads.length?<ClientTable leads={state.data.leads}/>:<p className="ag-empty">Компаний по выбранным условиям пока нет.</p>}
    <Pager page={page} change={setPage} next={state.data.hasNext}/></>}</>;
}
export function ApplicationCard({a,asOf}:{a:Application;asOf:string}){
  const created=a.createdAt?Date.parse(a.createdAt):NaN;
  const age=Number.isFinite(created)?Math.floor((Date.parse(asOf)-created)/86400000):null;
  return <article className="ag-app"><Link href={applicationUrl(a.id)}>{a.companyName}</Link>
    <p>{a.product} · {a.bank}</p><strong>{amount(a.requestedAmount)}</strong><Badge value={a.status}/>
    {a.nextAction&&<p>{a.nextAction}</p>}<small>Создана {day(a.createdAt)}{age!==null&&age>=0&&' · дн. с создания: '+age}</small>
    {a.analysisId&&<Link href={applicationUrl(a.id,'prescore')}>Открыть Prescore →</Link>}</article>;
}
export function ApplicationsPage({initialFilter='',create=false}:{initialFilter?:string;create?:boolean}){
  const {state,page,setPage,props}=useListing('applications',initialFilter),[open,setOpen]=useState(create),[notice,setNotice]=useState('');
  return <><PageHeader title="Заявки"><button className="ag-primary" onClick={()=>setOpen(true)}>Создать заявку</button></PageHeader>
    <FilterBar {...props} statuses={applicationStatuses} label="Компания, продукт или партнёр" options={ [['','Все заявки'],['active','Активные'],['closed','Закрытые'],['documents','Требуются документы'],['approved','Одобрено / выдано']] }/>
    {open&&<ApplicationCreate close={()=>setOpen(false)} saved={()=>{setOpen(false);setNotice('Заявка добавлена');setPage(1);state.reload();}}/>}
    {notice&&<p role="status">{notice}</p>}{!state.data?<Notice {...state}/>:<>{state.data.applications.length?<div className="ag-grid">{state.data.applications.map(a=><ApplicationCard key={a.id} a={a} asOf={state.data!.asOf}/>)}</div>:<p className="ag-empty">По выбранным условиям заявок пока нет.</p>}
    <Pager page={page} change={setPage} next={state.data.hasNext}/></>}</>;
}
export function PipelinePage(){
  const [page,setPage]=useState(1),state=useAgentRead<Rows>('/api/agent?surface=pipeline&limit=50&page='+page);
  const groups:typeof stages=[...stages];const data=state.data;
  const unknown=[...new Set([...(data?.leads??[]),...(data?.applications??[])].map(r=>r.status).filter(s=>!stages.some(g=>g.statuses.includes(s))))];
  if(unknown.length)groups.push({label:'Другие этапы',statuses:unknown});
  return <><PageHeader title="Воронка"><Link className="ag-primary" href="/agent/applications?action=new">Создать заявку</Link></PageHeader>
    {!data?<Notice {...state}/>:<><div className="ag-board" aria-label="Воронка по этапам" tabIndex={0}>{groups.map(({label,statuses})=>{
      const leads=data.leads.filter(l=>statuses.includes(l.status)),apps=data.applications.filter(a=>statuses.includes(a.status));
      return <section key={label}><h2>{label}<span>{leads.length+apps.length}</span></h2>{leads.map(l=><article key={l.id} className="ag-app"><Link href={clientUrl(l.id)}>{l.companyName}</Link><small>{l.analysisId?'Анализ доступен':'Запросить выписку'}</small>
        <StatusControl entity="lead" id={l.id} value={l.status} onSaved={state.reload}/></article>)}{apps.map(a=><div key={a.id} className="ag-board-app"><ApplicationCard a={a} asOf={data.asOf}/>{a.analysisId&&<BrokerClientSummary analysisId={a.analysisId}/>}<StatusControl entity="application" id={a.id} value={a.status} onSaved={state.reload}/></div>)}</section>;
    })}</div><Pager page={page} change={setPage} next={data.hasNext}/></>}</>;
}
