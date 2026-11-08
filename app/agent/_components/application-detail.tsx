'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {createContext,useContext,type ReactNode} from 'react';
import type {Application,Lead,ApplicationEvent} from '../../../lib/agent/types';
import {applicationUrl,clientUrl} from '../../../lib/agent/workflow';
import ApplicationChat from '../../dashboard/application-chat';
import {useWorkspaceModel} from '../../components/workspace/use-model';
import {CanonicalSnapshot} from './client-detail';
import {RiskSections} from '../../components/workspace/profile-sections';
import {Badge,amount,day,PageHeader,Notice,Section,StatusControl,useAgentRead} from './data';
import {DocumentTable} from './documents';
import type {DocumentMeta} from '../../dashboard/documents-hub';

type Detail={application:Application;lead?:Lead;history:ApplicationEvent[]};
const AppContext=createContext<(Detail&{reload:()=>void})|null>(null);
function useApplication(){const a=useContext(AppContext);if(!a)throw Error('Требуется заявка');return a;}
const tabs=[['','Обзор'],['comments','Комментарии'],['documents','Документы'],['history','История'],['prescore','Prescore'],['partner','Партнёр и статус']];
export function ApplicationRecord({id,children}:{id:string;children:ReactNode}){
  const state=useAgentRead<Detail>('/api/agent?surface=application&id='+encodeURIComponent(id)),path=usePathname(),a=state.data?.application;
  if(!a||!state.data)return <Notice {...state}/>;
  return <AppContext.Provider value={{...state.data,reload:state.reload}}><Link className="ag-back" href="/agent/applications">← Заявки</Link>
    <PageHeader title={a.companyName} subtitle={a.product+' · '+amount(a.requestedAmount)}><Badge value={a.status}/></PageHeader>
    <nav className="ag-tabs" aria-label="Разделы заявки">{tabs.map(([s,t])=><Link key={s} aria-current={path===applicationUrl(id,s)?'page':undefined} href={applicationUrl(id,s)}>{t}</Link>)}</nav>{children}</AppContext.Provider>;
}
export function AppOverview(){const {application:a,lead}=useApplication();return <Section title="Обзор заявки"><dl className="ag-facts">
  <div><dt>Запрошено</dt><dd>{amount(a.requestedAmount)}</dd></div><div><dt>Партнёр</dt><dd>{a.bank}</dd></div><div><dt>Дата создания</dt><dd>{day(a.createdAt)}</dd></div>
  {a.nextAction&&<div><dt>Следующий шаг</dt><dd>{a.nextAction}</dd></div>}{lead&&<div><dt>Карточка компании</dt><dd><Link href={clientUrl(lead.id)}>{lead.companyName}</Link></dd></div>}
  {a.analysisId&&<div><dt>Связанный анализ</dt><dd><Link href={applicationUrl(a.id,'prescore')}>Открыть заключение</Link></dd></div>}</dl></Section>;}
export function AppComments(){const {application:a,lead}=useApplication();return <ApplicationChat embedded applicationId={a.id} companyInn={lead?.companyInn??''} analysisId={a.analysisId??''} title={a.companyName+' · обсуждение'} role="broker"/>;}
export function AppDocuments(){const {application:a}=useApplication(),state=useAgentRead<{documents:DocumentMeta[]}>('/api/documents?applicationId='+encodeURIComponent(a.id));
  return <Section title="Документы заявки" action={<Link href={applicationUrl(a.id,'comments')}>Прикрепить в обсуждении →</Link>}>{state.data?<DocumentTable documents={state.data.documents}/>:<Notice {...state}/>}</Section>;}
export function AppHistory(){const {history}=useApplication();return <Section title="История статусов">{history.length?<ol className="ag-timeline">{history.map(e=><li key={e.id}><small>{day(e.createdAt)}</small><strong>{e.fromStatus?e.fromStatus+' → ':''}{e.toStatus}</strong>{e.comment&&<p>{e.comment.replace(/^Брокер создал заявку$/,'Агент создал заявку')}</p>}</li>)}</ol>:<p>Для заявки ещё не зарегистрированы изменения этапа.</p>}</Section>;}
export function AppPrescore(){const {application:a}=useApplication(),state=useWorkspaceModel(a.analysisId||'');if(!a.analysisId)return <p className="ag-empty">К заявке пока не привязан анализ.</p>;return state.model?<><CanonicalSnapshot model={state.model}/><RiskSections model={state.model}/></>:<Notice error={state.error||undefined} reload={()=>void state.refresh()}/>;}
export function AppPartner(){const {application:a,reload}=useApplication();return <Section title="Финансовый партнёр"><h3>{a.bank}</h3><p>{a.product} · {amount(a.requestedAmount)}</p><StatusControl entity="application" id={a.id} value={a.status} onSaved={reload}/>{a.nextAction&&<p>{a.nextAction}</p>}<Link href={applicationUrl(a.id,'history')}>История статусов →</Link></Section>;}
