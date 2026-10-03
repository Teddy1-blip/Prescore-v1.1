"use client";
import { useEffect, useState } from "react";
import { Analyze, Crm, type StoredAnalysis, type Deal } from "./client-operations";
import { Shell, EmptyHome, Home, Heading, Financing, Obligations, BankingAnalysis, FullAccessNotice, date } from "./presentation";
import { useWorkspaceModel, selectAnalysis } from "./use-model";
import { CompanyData, SourceUpload, RecipientApplications } from "./source-operations";
import {CreditDepth, CompanyReporting} from "./credit-depth";
import DocumentsHub from "../../dashboard/documents-hub";
import AiAnalyst from "../../dashboard/ai-analyst";
import "../../dashboard/dashboard.css";
import "./workspace.css";
export const clientModuleKeys:Record<string,string>={home:'overview',upload:'analysis',analysis:'report',financing:'offers',obligations:'credit',applications:'applications',documents:'documents',company:'company',analyst:'analyst'};
export function resolveClientView(value:string|null){
 const aliases:Record<string,string>={overview:'home',report:'analysis',credit:'obligations',offers:'financing',crm:'applications',analyze:'upload'};
 return value?(aliases[value]??(Object.hasOwn(clientModuleKeys,value)?value:'home')):'home';
}
export function clientAvailableViews(modules:Record<string,boolean>,readOnly:boolean){
 return Object.keys(clientModuleKeys).filter(view=>modules[clientModuleKeys[view]]!==false&&!(view==='upload'&&readOnly));
}
export default function ClientWorkspace(){
 const [analyses,setAnalyses]=useState<StoredAnalysis[]>([]),[deals,setDeals]=useState<Deal[]>([]),[selectedId,setSelectedId]=useState(''),[view,setView]=useState('home'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[readOnly,setReadOnly]=useState(false),[revision,setRevision]=useState(0),[modules,setModules]=useState<Record<string,boolean>>({}),[modulesLoading,setModulesLoading]=useState(true);
 const selected=analyses.find(a=>a.id===selectedId), state=useWorkspaceModel(selectedId,revision),model=state.model;
 const locked=readOnly||!!model?.access.readOnly;
 useEffect(()=>{const c=new AbortController();const q=new URLSearchParams(window.location.search),client=q.get('client');
 fetch(client?`/api/workspace?client=${encodeURIComponent(client)}&from=agent`:'/api/workspace',{signal:c.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Не удалось получить сохранённые анализы.');return r.json();}).then(data=>{setAnalyses(data.analyses??[]);setDeals(data.deals??[]);setReadOnly(!!data.readOnly);const wanted=q.get('analysisId')??client;const id=data.analyses?.find((a:StoredAnalysis)=>a.id===wanted)?.id??data.analyses?.[0]?.id??'';setSelectedId(id);if(id)selectAnalysis(id);setView(resolveClientView(q.get('view')));}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
 fetch('/api/modules',{signal:c.signal}).then(r=>r.json()).then(d=>setModules(d.modules??{})).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setModulesLoading(false);});return()=>c.abort();},[]);
 function choose(v:string){setView(v);const url=new URL(window.location.href);url.searchParams.set('view',v);window.history.replaceState(null,'',url);}
 function refresh(){setRevision(x=>x+1);}
 async function accept(result:StoredAnalysis){setAnalyses(items=>[result,...items.filter(a=>a.id!==result.id)]);setSelectedId(result.id);selectAnalysis(result.id);choose('home');refresh();setNotice('Выписки обработаны. Загружаем сохранённую финансовую картину.');}
 async function addDeal(input:Omit<Deal,'id'>){if(locked)return;const deal={...input,id:crypto.randomUUID()};const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'deal',deal})});if(!r.ok){setNotice('Заявка не сохранена. Повторите попытку.');return;}setDeals(items=>[deal,...items]);refresh();setNotice('Заявка сохранена.');}
 async function updateDeal(id:string,status:string){if(locked)return;const r=await fetch('/api/workspace',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(!r.ok){setNotice('Статус не сохранён.');return;}setDeals(items=>items.map(d=>d.id===id?{...d,status}:d));refresh();}
 const availableViews=clientAvailableViews(modules,locked||loading||modulesLoading||state.loading);
 const disabled=modules[clientModuleKeys[view]]===false;
 const companyName=model?.basic.analysis.company.name?.trim()||selected?.companyName?.trim()||'Компания не указана';
 return <Shell view={view} choose={choose} companyName={companyName} availableViews={availableViews} secondary={<><button onClick={()=>choose('company')}>Компания и отчётность</button><button onClick={()=>choose('analyst')}>Помощник</button></>} context={selected&&<section className="ws-context"><div><span className="ws-eyebrow">{locked?'ДОСЬЕ · ТОЛЬКО ЧТЕНИЕ':'КОМПАНИЯ'}</span><h2>{companyName}</h2><p>ИНН {model?.basic.analysis.company.inn??selected.companyInn}</p>{model&&<><p>Период: {date(model.basic.analysis.period.from)} — {date(model.basic.analysis.period.to)}</p><p>{model.basic.sources.statements.bankNames?.join(' · ')||'Банки не определены'}</p><p>Выписок: {model.basic.sources.statements.count??'не определено'} · Счетов: {model.basic.sources.statements.accountCount??'не определено'}</p></>}</div><label>Сохранённый анализ<select aria-label="Сохранённый анализ" value={selectedId} onChange={e=>{setSelectedId(e.target.value);selectAnalysis(e.target.value);}}>{analyses.map(a=><option key={a.id} value={a.id}>{a.companyName} · {date(a.createdAt??a.periodTo)}</option>)}</select><small>{model?`${date(model.basic.analysis.period.from)} — ${date(model.basic.analysis.period.to)}`:'Получаем данные'}</small></label>{availableViews.includes('upload')&&<button onClick={()=>choose('upload')}>Добавить выписки ↗</button>}</section>}>
 {notice&&<p role="status" className="ws-notice">{notice}</p>}{error&&<p role="alert">{error} <button onClick={()=>window.location.reload()}>Повторить</button></p>}
 {loading||modulesLoading?<p role="status">Загружаем кабинет…</p>:disabled?<p>Раздел временно недоступен.</p>:view==='upload'?(locked?<p>Загрузка выписок недоступна в режиме чтения. Выберите доступный раздел в меню.</p>:<Analyze onResult={accept}/>):!selected?(!error&&<EmptyHome start={availableViews.includes('upload')?()=>choose('upload'):undefined}/>):state.loading?<p role="status">Загружаем финансовую картину…</p>:state.error?<p role="alert">{state.error} <button onClick={refresh}>Повторить</button></p>:model&&<>
 {view==='home'&&<Home key={selectedId} model={model} retry={refresh}/>}
 {view==='analysis'&&<><Heading eyebrow="АНАЛИЗ КОМПАНИИ" title="Банковские факты и кредитная оценка"><p>Рассчитанные банковские данные сохранены. Ниже — кредитная интерпретация с основаниями и ограничениями текущего отчёта.</p></Heading><details className="ws-credit-card" open={!model.full}><summary>Банковский анализ: показатели и движение денег</summary><BankingAnalysis model={model}/></details><CreditDepth model={model} retry={refresh}/></>}
 {view==='financing'&&<><Financing model={model}/>{!locked&&availableViews.includes('applications')&&<section className="ws-section"><h2>Подготовить обычную заявку</h2><p>Вы можете указать цель и запрошенную сумму самостоятельно.</p><button onClick={()=>choose('applications')}>Перейти к заявкам ↗</button></section>}</>}
 {view==='obligations'&&<><Obligations model={model}/>{!locked&&<SourceUpload analysisId={selectedId} kind="BKI" saved={refresh}/>}</>}
 {view==='documents'&&<DocumentsHub key={selectedId} companyInn={selected.companyInn} companyName={selected.companyName} analysisId={selectedId} readOnly={locked}/>}
 {view==='applications'&&(locked?<p>Управление заявками доступно в кабинете брокера.</p>:<><Crm key={selectedId} deals={deals.filter(d=>d.analysisId===selectedId)} analyses={analyses} selected={selected} addDeal={addDeal} updateDeal={updateDeal}/><RecipientApplications analysis={selected} saved={items=>{setDeals(current=>[...items,...current]);refresh();}}/></>)}
 {view==='company'&&<><CompanyReporting model={model}/><CompanyData key={selectedId} id={selectedId} inn={selected.companyInn} updated={refresh}/>{!locked&&<SourceUpload analysisId={selectedId} kind="QUARTERLY" saved={refresh}/>}</>}
 {view==='analyst'&&(model.full?<AiAnalyst key={selectedId} analysisId={selectedId}/>:<FullAccessNotice model={model} retry={refresh}/>)}
 </>}
 </Shell>;
}
