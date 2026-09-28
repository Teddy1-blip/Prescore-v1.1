"use client";
import { useEffect, useState } from "react";
import { Analyze, Crm, type StoredAnalysis, type Deal } from "./client-operations";
import { Shell, EmptyHome, Home, Heading, Financing, Obligations, BankingAnalysis, FullAccessNotice, date, reportUrl } from "./presentation";
import { useWorkspaceModel, selectAnalysis } from "./use-model";
import { CompanyData, SourceUpload, RecipientApplications } from "./source-operations";
import DocumentsHub from "../../dashboard/documents-hub";
import AiAnalyst from "../../dashboard/ai-analyst";
import "../../dashboard/dashboard.css";
import "./workspace.css";
export default function ClientWorkspace(){
 const [analyses,setAnalyses]=useState<StoredAnalysis[]>([]),[deals,setDeals]=useState<Deal[]>([]),[selectedId,setSelectedId]=useState(''),[view,setView]=useState('home'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[readOnly,setReadOnly]=useState(false),[revision,setRevision]=useState(0),[modules,setModules]=useState<Record<string,boolean>>({});
 const selected=analyses.find(a=>a.id===selectedId), state=useWorkspaceModel(selectedId,revision),model=state.model;
 const locked=readOnly||!!model?.access.readOnly;
 useEffect(()=>{const c=new AbortController();const q=new URLSearchParams(window.location.search),client=q.get('client');
 fetch(client?`/api/workspace?client=${encodeURIComponent(client)}&from=agent`:'/api/workspace',{signal:c.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Не удалось получить сохранённые анализы.');return r.json();}).then(data=>{setAnalyses(data.analyses??[]);setDeals(data.deals??[]);setReadOnly(!!data.readOnly);const wanted=q.get('analysisId')??client;const id=data.analyses?.find((a:StoredAnalysis)=>a.id===wanted)?.id??data.analyses?.[0]?.id??'';setSelectedId(id);if(id)selectAnalysis(id);const aliases:Record<string,string>={overview:'home',report:'analysis',credit:'obligations',offers:'financing',crm:'applications',analyze:'upload'};const v=q.get('view');if(v)setView(aliases[v]??(['home','analysis','financing','obligations','documents','applications','company','analyst'].includes(v)?v:'home'));}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
 fetch('/api/modules',{signal:c.signal}).then(r=>r.json()).then(d=>setModules(d.modules??{})).catch(()=>{});return()=>c.abort();},[]);
 function choose(v:string){setView(v);const url=new URL(window.location.href);url.searchParams.set('view',v);window.history.replaceState(null,'',url);}
 function refresh(){setRevision(x=>x+1);}
 async function accept(result:StoredAnalysis){setAnalyses(items=>[result,...items.filter(a=>a.id!==result.id)]);setSelectedId(result.id);selectAnalysis(result.id);choose('home');refresh();setNotice('Выписки обработаны. Загружаем сохранённую финансовую картину.');}
 async function addDeal(input:Omit<Deal,'id'>){if(locked)return;const deal={...input,id:crypto.randomUUID()};const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'deal',deal})});if(!r.ok){setNotice('Заявка не сохранена. Повторите попытку.');return;}setDeals(items=>[deal,...items]);refresh();setNotice('Заявка сохранена.');}
 async function updateDeal(id:string,status:string){if(locked)return;const r=await fetch('/api/workspace',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(!r.ok){setNotice('Статус не сохранён.');return;}setDeals(items=>items.map(d=>d.id===id?{...d,status}:d));refresh();}
 const moduleKeys:Record<string,string>={home:'overview',upload:'analysis',analysis:'report',financing:'offers',obligations:'credit',applications:'applications',documents:'documents',company:'company',analyst:'analyst'};
 const disabled=modules[moduleKeys[view]]===false;
 return <Shell view={view} choose={choose} secondary={<><button onClick={()=>choose('company')}>Компания и отчётность</button><button onClick={()=>choose('analyst')}>Помощник</button></>} context={selected&&<section className="ws-context"><div><span className="ws-eyebrow">{locked?'ДОСЬЕ · ТОЛЬКО ЧТЕНИЕ':'КОМПАНИЯ'}</span><h2>{model?.basic.analysis.company.name??selected.companyName}</h2><p>ИНН {model?.basic.analysis.company.inn??selected.companyInn}</p></div><label>Сохранённый анализ<select aria-label="Сохранённый анализ" value={selectedId} onChange={e=>{setSelectedId(e.target.value);selectAnalysis(e.target.value);}}>{analyses.map(a=><option key={a.id} value={a.id}>{a.companyName} · {date(a.createdAt??a.periodTo)}</option>)}</select><small>{model?`${date(model.basic.analysis.period.from)} — ${date(model.basic.analysis.period.to)}`:'Получаем данные'}</small></label>{!locked&&modules.analysis!==false&&<button onClick={()=>choose('upload')}>Добавить выписки ↗</button>}</section>}>
 {notice&&<p role="status" className="ws-notice">{notice}</p>}{error&&<p role="alert">{error} <button onClick={()=>window.location.reload()}>Повторить</button></p>}
 {loading?<p role="status">Загружаем кабинет…</p>:disabled?<p>Раздел временно недоступен.</p>:view==='upload'&&!locked?<Analyze onResult={accept}/>:!selected?(!error&&<EmptyHome start={()=>choose('upload')}/>):state.loading?<p role="status">Загружаем финансовую картину…</p>:state.error?<p role="alert">{state.error} <button onClick={refresh}>Повторить</button></p>:model&&<>
 {view==='home'&&<Home key={selectedId} model={model} retry={refresh}/>}
 {view==='analysis'&&<><Heading eyebrow="АНАЛИЗ КОМПАНИИ" title="Банковские факты и кредитная оценка"><p>Сначала — рассчитанные данные по выпискам. Полный кредитный анализ добавляется только при наличии достаточных источников.</p></Heading><BankingAnalysis model={model}/>{model.full?<a className="ws-primary" href={reportUrl(selectedId)}>Открыть подробный кредитный анализ ↗</a>:<FullAccessNotice model={model} retry={refresh}/>}</>}
 {view==='financing'&&<><Financing model={model}/>{!locked&&<section className="ws-section"><h2>Подготовить обычную заявку</h2><p>Вы можете указать цель и запрошенную сумму самостоятельно.</p><button onClick={()=>choose('applications')}>Перейти к заявкам ↗</button></section>}</>}
 {view==='obligations'&&<><Obligations model={model}/>{!locked&&<SourceUpload analysisId={selectedId} kind="BKI" saved={refresh}/>}</>}
 {view==='documents'&&<DocumentsHub key={selectedId} companyInn={selected.companyInn} companyName={selected.companyName} analysisId={selectedId} readOnly={locked}/>}
 {view==='applications'&&(locked?<p>Управление заявками доступно в кабинете брокера.</p>:<><Crm key={selectedId} deals={deals.filter(d=>d.analysisId===selectedId)} analyses={analyses} selected={selected} addDeal={addDeal} updateDeal={updateDeal}/><RecipientApplications analysis={selected} saved={items=>{setDeals(current=>[...items,...current]);refresh();}}/></>)}
 {view==='company'&&<><CompanyData key={selectedId} id={selectedId} inn={selected.companyInn} updated={refresh}/>{!locked&&<SourceUpload analysisId={selectedId} kind="QUARTERLY" saved={refresh}/>}</>}
 {view==='analyst'&&(model.full?<AiAnalyst key={selectedId} analysisId={selectedId}/>:<FullAccessNotice model={model} retry={refresh}/>)}
 </>}
 </Shell>;
}
