'use client';
import Link from 'next/link';
import {useSearchParams,usePathname} from 'next/navigation';
import {createContext,useContext,useState,type ReactNode} from 'react';
import type {AgentIdentity,Lead,Application,AnalysisRef} from '../../../lib/agent/types';
import {clientUrl,applicationUrl} from '../../../lib/agent/workflow';
import {useWorkspaceModel} from '../../components/workspace/use-model';
import {FullCreditAnalysis,FinancingProducts,ActionPlan} from '../../components/workspace/client-analysis';
import {RiskSections} from '../../components/workspace/profile-sections';
import {Why,ActionItem} from '../../components/workspace/client-insights';
import {CashMovement} from '../../components/workspace/cash-movement';
import {BankingLedger} from '../../components/workspace/banking-ledger';
import {FinancialStatements} from '../../components/workspace/client-financials';
import {DocumentSources} from '../../components/workspace/client-documents';
import DocumentsHub from '../../dashboard/documents-hub';
import {ApplicationCard,ApplicationCreate} from './lists';
import {Badge,day,Notice,PageHeader,Pager,Section,StatusControl,useAgentRead} from './data';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';

const tabs=[['','Обзор'],['credit-profile','Кредитный профиль'],['finance','Финансы'],['financing','Финансирование'],['documents','Документы'],['applications','Заявки клиента']];
type ClientData=AgentIdentity&{asOf:string;lead:Lead|null;analyses:AnalysisRef[];applications:Application[];hasNext:boolean};
type RecordContext={data:ClientData;model:ReturnType<typeof useWorkspaceModel>;clientId:string;analysisId:string;
  page:number;setPage:(n:number)=>void;reload:()=>void;href:(s:string)=>string};
const ClientContext=createContext<RecordContext|null>(null);
function useClientRecord(){const r=useContext(ClientContext);if(!r)throw Error('Требуется карточка клиента');return r;}
export function ClientRecord({id,children}:{id:string;children:ReactNode}){
  const q=useSearchParams(),explicit=q.get('analysisId')??'',path=usePathname(),[page,setPage]=useState(1);
  const params=new URLSearchParams({surface:'client',id,analysisId:explicit,page:String(page)});
  const state=useAgentRead<ClientData>('/api/agent?'+params),d=state.data;
  const selected=explicit||d?.analyses[0]?.id||'';
  const model=useWorkspaceModel(d?selected:'');
  if(!d)return <Notice {...state}/>;
  const href=(section:string)=>clientUrl(id,section)+(explicit?'?analysisId='+encodeURIComponent(explicit):'');
  const company=d.lead??d.analyses[0];
  return <ClientContext.Provider value={{data:d,model,clientId:id,analysisId:selected,page,setPage,reload:state.reload,href}}>
    <Link href="/agent/clients" className="ag-back">← Клиенты</Link><PageHeader title={company.companyName} subtitle={'ИНН '+company.companyInn}>
      {d.lead&&<Badge value={d.lead.status}/>}</PageHeader>
    <nav className="ag-tabs" aria-label="Разделы досье">{tabs.map(([slug,label])=><Link key={slug} aria-current={path===clientUrl(id,slug)?'page':undefined} href={href(slug)}>{label}</Link>)}</nav>{children}
  </ClientContext.Provider>;
}
function ModelSurface({children}:{children:(model:WorkspaceModelV1)=>ReactNode}){
  const {analysisId,model}=useClientRecord();
  if(!analysisId)return <p className="ag-empty">Запросите у клиента банковскую выписку, чтобы открыть финансовый профиль.</p>;
  if(!model.model)return <Notice error={model.error||undefined} reload={()=>void model.refresh()}/>;
  return <>{children(model.model)}</>;
}
export function CanonicalSnapshot({model}:{model:WorkspaceModelV1}){
  const r=model.full?.report,idx=model.full?.canonical.prescoreIndex.value;
  return <Section title="Заключение Prescore">
    <small>{day(model.basic.analysis.period.from)} — {day(model.basic.analysis.period.to)} · Только чтение</small>
    {r?<><h3>{r.hero.headline}</h3><p>{r.hero.summary}</p><div className="ag-inline-facts">
      {idx!=null&&<div><small>Prescore Index</small><strong>{idx}</strong></div>}
      {r.readiness.level&&<div><small>Готовность к финансированию</small><strong>{r.readiness.level}</strong></div>}</div></>:
      <p>Доступна базовая финансовая картина по выпискам.</p>}</Section>;
}
function RecommendationPreview({model}:{model:WorkspaceModelV1}){
  const r=model.full?.report;if(!r)return null;
  return <>{r.recommendations.primary.length>0&&<Section title="Приоритетные рекомендации">{r.recommendations.primary.slice(0,3).map(a=><ActionItem key={a.id} item={a} model={model}/>)}</Section>}
    {r.productFit.primary.length>0&&<Section title="Подходящие продукты">{r.productFit.primary.slice(0,3).map(p=><article key={p.id}><h3>{p.title}</h3><p>{p.purpose}</p><Why model={model} ids={[p.claimId]}/></article>)}</Section>}</>;
}
export function ClientOverview(){
  const {data:d,reload,clientId,analysisId}=useClientRecord(),l=d.lead;
  return <div className="ag-stack">{l&&<Section title="Работа с компанией"><div className="ag-pair"><div><h3>{l.contactName}</h3><p>{[l.phone,l.email].filter(Boolean).join(' · ')}</p><small>{l.source}</small></div>
    <StatusControl id={l.id} entity="lead" value={l.status} onSaved={reload}/></div>
    {d.applications[0]?.nextAction&&<p><b>Следующий шаг</b> · {d.applications[0].nextAction}</p>}</Section>}
    {d.analyses.length>0&&<Section title="Связанные анализы">{d.analyses.map(a=><p key={a.id}><Link href={clientUrl(clientId,'credit-profile')+'?analysisId='+encodeURIComponent(a.id)}>{a.companyName} · {day(a.createdAt)}</Link>{a.id===analysisId&&' · выбран'}</p>)}</Section>}
    <ModelSurface>{m=><><CanonicalSnapshot model={m}/><RiskSections model={m}/><RecommendationPreview model={m}/>{m.full&&<ActionPlan model={m}/>}</>}</ModelSurface>
    {l&&<Section title="История работы"><p>{day(l.createdAt)} · Клиент добавлен</p>{d.applications.map(a=><p key={a.id}>{day(a.updatedAt)} · <Link href={applicationUrl(a.id,'history')}>{a.product} · {a.status}</Link></p>)}</Section>}</div>;
}
export function ClientCredit(){const {model}=useClientRecord();return <ModelSurface>{m=><FullCreditAnalysis key={m.analysisId} model={m} retry={()=>void model.refresh()}/>}</ModelSurface>;}
export function ClientFinance(){return <ModelSurface>{m=><><Section title="Движение денег"><CashMovement model={m}/></Section><BankingLedger model={m}/><FinancialStatements model={m}/></>}</ModelSurface>;}
export function ClientFinancing(){return <ModelSurface>{m=><FinancingProducts model={m}/>}</ModelSurface>;}
export function ClientDocuments(){const {data,analysisId}=useClientRecord();return <><ModelSurface>{m=><DocumentSources model={m} readOnly/>}</ModelSurface>
  {data.lead&&<DocumentsHub companyInn={data.lead.companyInn} companyName={data.lead.companyName} analysisId={analysisId} readOnly/>}</>;}
export function ClientApplications(){
  const {data:d,reload,page,setPage}=useClientRecord(),[open,setOpen]=useState(false),[notice,setNotice]=useState('');
  return <Section title="Заявки клиента" action={d.lead&&<button onClick={()=>setOpen(true)}>Создать заявку</button>}>
    {notice&&<p role="status">{notice}</p>}{open&&d.lead&&<ApplicationCreate lead={d.lead} close={()=>setOpen(false)} saved={()=>{setOpen(false);setNotice('Заявка добавлена');reload();}}/>}
    <div className="ag-grid">{d.applications.map(a=><ApplicationCard key={a.id} a={a} asOf={d.asOf}/>)}</div>{!d.applications.length&&<p>Компания ещё не подавала заявок через этого агента.</p>}
    <Pager page={page} next={d.hasNext} change={setPage}/></Section>;
}
