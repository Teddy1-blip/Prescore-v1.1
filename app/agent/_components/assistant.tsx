'use client';
import {useState} from 'react';
import Link from 'next/link';
import AiAnalyst from '../../dashboard/ai-analyst';
import {clientUrl} from '../../../lib/agent/workflow';
import type {Lead,AnalysisRef} from '../../../lib/agent/types';
import {Notice,PageHeader,Pager,useAgentRead} from './data';
function AnalystForClient({id,analysisId}:{id:string;analysisId:string}){
  const params=new URLSearchParams({surface:'client',id,analysisId});
  const state=useAgentRead<{analyses:AnalysisRef[]}>('/api/agent?'+params),selected=analysisId||state.data?.analyses[0]?.id;
  return !state.data?<Notice {...state}/>:selected?<><Link href={clientUrl(id,'credit-profile')+(analysisId?'?analysisId='+encodeURIComponent(analysisId):'')}>К досье →</Link><AiAnalyst key={selected} analysisId={selected}/></>:<p>Запросите у клиента выписку для первого анализа.</p>;
}
export function AssistantPage({client,analysisId}:{client?:string;analysisId?:string}){
  const [q,setQ]=useState(''),[page,setPage]=useState(1);
  return <><PageHeader title="Спросить Prescore"/>{client?<AnalystForClient id={client} analysisId={analysisId||''}/>:<><label className="ag-filter">Выберите компанию с анализом<input value={q} type="search" placeholder="Компания или ИНН" onChange={e=>{setQ(e.target.value);setPage(1);}}/></label>
    <AnalystClients q={q} page={page} change={setPage}/></>}</>;
}
function AnalystClients({q,page,change}:{q:string;page:number;change:(n:number)=>void}){
  const state=useAgentRead<{leads:Lead[];hasNext:boolean}>('/api/agent?surface=clients&filter=ready&page='+page+'&q='+encodeURIComponent(q));
  return !state.data?<Notice {...state}/>:<div className="ag-card">{state.data.leads.map(l=><p key={l.id}><Link href={'/agent/assistant?client='+encodeURIComponent(l.id)}>{l.companyName}</Link></p>)}
    {!state.data.leads.length&&<p>Ассистенту нужен доступный анализ компании.</p>}<Pager page={page} change={change} next={state.data.hasNext}/></div>;
}
