'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {DocumentRow,Lead} from '../../../lib/agent/types';
import {applicationUrl,clientUrl} from '../../../lib/agent/workflow';
import {day,Notice,PageHeader,Pager,Section,useAgentRead} from './data';
type FileRow={id:string;fileName:string;category:string;createdAt:string;uploadedBy:string;status:string;companyName?:string;clientId?:string;applicationId?:string};
export function DocumentTable({documents}:{documents:FileRow[]}){
  if(!documents.length)return <p className="ag-empty">Вложения появятся после загрузки файлов в досье или обсуждение заявки.</p>;
  return <div className="ag-table-wrap"><table className="ag-table"><thead><tr>{['Файл','Категория','Статус','Загрузил','Дата'].map(t=><th key={t}>{t}</th>)}</tr></thead>
    <tbody>{documents.map(d=><tr key={d.id}><td><a href={'/api/documents?download='+encodeURIComponent(d.id)}>{d.fileName}</a>
      {d.clientId&&<small><Link href={clientUrl(d.clientId,'documents')}>{d.companyName}</Link></small>}{d.applicationId&&<small><Link href={applicationUrl(d.applicationId,'documents')}>К заявке →</Link></small>}</td>
      <td data-label="Категория">{d.category}</td><td data-label="Статус">{d.status}</td><td data-label="Загрузил">{d.uploadedBy==='Брокер'?'Агент':d.uploadedBy}</td><td data-label="Дата">{day(d.createdAt)}</td></tr>)}</tbody></table></div>;
}
export function DocumentsPage(){
  const [q,setQ]=useState(''),[page,setPage]=useState(1),params=new URLSearchParams({q,page:String(page),limit:'25'});
  const state=useAgentRead<{documents:DocumentRow[];hasNext:boolean}>('/api/agent?surface=documents&'+params);
  const sources=useAgentRead<{leads:Lead[];hasNext:boolean}>('/api/agent?surface=clients&filter=ready&'+params);
  return <><PageHeader title="Документы"/><div className="ag-filter"><label>Поиск<input type="search" value={q} placeholder="Компания, ИНН или название файла" onChange={e=>{setQ(e.target.value);setPage(1);}}/></label></div>
    <Section title="Источники для расчёта">{sources.data?<>{sources.data.leads.map(l=><p key={l.id}><Link href={clientUrl(l.id,'documents')}>{l.companyName} · ИНН {l.companyInn}</Link></p>)}
      {!sources.data.leads.length&&<p>Здесь появятся компании с доступными выписками, БФО или БКИ.</p>}</>:<Notice {...sources}/>}</Section>
    <Section title="Файлы досье и заявок">{state.data?<DocumentTable documents={state.data.documents}/>:<Notice {...state}/>}</Section>
    <Pager page={page} next={!!(state.data?.hasNext||sources.data?.hasNext)} change={setPage}/></>;
}
