"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Analyze, Crm, ScreeningSummary, type UploadReceipt, type StoredAnalysis, type Deal } from "./client-operations";
import { EmptyHome, FullAccessNotice, date } from "./presentation";
import { useWorkspaceModel, selectAnalysis } from "./use-model";
import { CompanyData, SourceUpload, RecipientApplications } from "./source-operations";
import {ClientBilling} from './billing';
import {ClientShell} from './client-shell';
import {CashTrend,Panel} from './client-insights';
import {ClientOverview} from './client-launch-overview';
import {FullCreditAnalysis,FinancingProducts,DebtPortfolio} from './client-analysis';
import {FinancialStatements} from './client-financials';
import {sourceState} from './credit-depth';
import {BankingLedger} from './banking-ledger';
import {FinancingRequest} from './financing-request';
import {BrokerPermissions} from './client-operations';
import {DocumentSources} from './client-documents';
import DocumentsHub from "../../dashboard/documents-hub";
import AiAnalyst from "../../dashboard/ai-analyst";
import "../../dashboard/dashboard.css";
import "./workspace.css";
import "../../dashboard/report-v2/analysis-v3.css";
import "./client-product.css";
export const clientModuleKeys:Record<string,string>={home:'overview',banking:'report',upload:'analysis',analysis:'report',financing:'offers',obligations:'credit',applications:'applications',documents:'documents',analyst:'analyst',billing:'billing'};
export function resolveClientView(value:string|null){
 const aliases:Record<string,string>={overview:'home',report:'analysis',credit:'obligations',offers:'financing',crm:'applications',analyze:'upload',company:'documents',sources:'documents',reconciliation:'analysis',recommendations:'analysis'};
 return value?(aliases[value]??(Object.hasOwn(clientModuleKeys,value)?value:'home')):'home';
}
export function clientAvailableViews(modules:Record<string,boolean>,readOnly:boolean){
 return Object.keys(clientModuleKeys).filter(view=>modules[clientModuleKeys[view]]!==false&&!(['upload','billing'].includes(view)&&readOnly));
}
// Operational sections have their own protected APIs and must remain available
// when the analytical model cannot be produced. No entitlement is granted here.
export function clientViewNeedsModel(view:string){
 return !['upload','documents','obligations','applications','billing'].includes(view);
}
export function clientSectionTitle(view:string){
 const titles:Record<string,string>={home:'Обзор',analysis:'Анализ Prescore',banking:'Финансы',obligations:'Обязательства',financing:'Финансирование',documents:'Документы',applications:'Заявки',analyst:'Кредитный аналитик',billing:'Подписка компании'};
 return Object.hasOwn(titles,view)?titles[view]:'Раздел кабинета';
}
export default function ClientWorkspace(){
 const [analyses,setAnalyses]=useState<StoredAnalysis[]>([]),[deals,setDeals]=useState<Deal[]>([]),[selectedId,setSelectedId]=useState(''),[view,setView]=useState('home'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[readOnly,setReadOnly]=useState(false),[revision,setRevision]=useState(0),[modules,setModules]=useState<Record<string,boolean>>({}),[modulesLoading,setModulesLoading]=useState(true);
 const [operationsError,setOperationsError]=useState(''),[operationsLoading,setOperationsLoading]=useState(false),[uploadReceipt,setUploadReceipt]=useState<{id:string;receipt:UploadReceipt}|null>(null);
 const operationsRequest=useRef(0),scope=useRef(''),selection=useRef(''),draftRequests=useRef(new Map<string,string>()),openDataRequests=useRef(new Set<string>());
 const state=useWorkspaceModel(selectedId,revision);
 const unavailable=state.error==='Эта версия анализа недоступна.'||state.error.startsWith('Сессия завершена');
 const selected=unavailable?undefined:analyses.find(a=>a.id===selectedId),model=selected?state.model:null;
 const workAnalyses=analyses.filter(a=>a.historyPurpose!=='QA'),qaAnalyses=analyses.filter(a=>a.historyPurpose==='QA');
 const locked=readOnly||!!model?.access.readOnly;
 useEffect(()=>{const c=new AbortController();const q=new URLSearchParams(window.location.search),client=q.get('client');scope.current=client??'';
 const initialView=resolveClientView(q.get('view'));
 const initialEndpoint=client?`/api/workspace?client=${encodeURIComponent(client)}&from=agent`:initialView==='applications'?'/api/workspace':'/api/workspace?projection=summary';
 fetch(initialEndpoint,{signal:c.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error(r.status===401?'Сессия завершена. Войдите в кабинет повторно.':r.status===403?'Нет доступа к этому кабинету.':'Не удалось получить сохранённые анализы.');return r.json();}).then(data=>{setAnalyses(data.analyses??[]);setDeals(data.deals??[]);setReadOnly(!!data.readOnly);const wanted=q.get('analysisId')??client;const id=wanted??'';selection.current=id;setSelectedId(id);if(id)selectAnalysis(id);setView(resolveClientView(q.get('view')));}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
 fetch('/api/modules',{signal:c.signal}).then(r=>r.json()).then(d=>setModules(d.modules??{})).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setModulesLoading(false);});return()=>c.abort();},[]);
 function choose(v:string){setView(v);const url=new URL(window.location.href);if(v==='upload'){selection.current='';setSelectedId('');setUploadReceipt(null);setNotice('');url.searchParams.delete('analysisId');}url.searchParams.set('view',v);window.history.replaceState(null,'',url);}
 const loadOperations=useCallback(async()=>{const request=++operationsRequest.current;setOperationsLoading(true);try{const r=await fetch(scope.current?`/api/workspace?client=${encodeURIComponent(scope.current)}&from=agent`:'/api/workspace',{cache:'no-store'});const d=await r.json();if(!r.ok){if([401,403].includes(r.status)){setAnalyses([]);setDeals([]);}throw Error(r.status===401?'Сессия завершена. Войдите в кабинет повторно.':d.error||'Не удалось обновить заявки');}if(request===operationsRequest.current){setAnalyses(d.analyses??[]);setDeals(d.deals??[]);setReadOnly(!!d.readOnly);setOperationsError('');}return true;}catch(e){if(request===operationsRequest.current)setOperationsError(e instanceof Error?e.message:'Не удалось обновить данные');return false;}finally{if(request===operationsRequest.current)setOperationsLoading(false);}},[]);
 const reloadModel=state.refresh;
 const refresh=useCallback(async()=>{await loadOperations();await reloadModel();},[loadOperations,reloadModel]);
 const refreshSource=useCallback(async()=>{await loadOperations();if(!await reloadModel())throw Error('Документ сохранён, но обновление анализа не подтверждено. Нажмите «Повторить» в сообщении над разделом.');},[loadOperations,reloadModel]);
 useEffect(()=>{if(view!=='applications'||loading)return;const timer=setTimeout(()=>void loadOperations(),0);return()=>clearTimeout(timer);},[view,loading,loadOperations]);
 function chooseAnalysis(id:string){selection.current=id;setSelectedId(id);selectAnalysis(id);setNotice('');}
 async function enrichOpenData(result:StoredAnalysis){
  const inn=String(result.companyInn??'').replace(/\D/g,'');
  if(!inn||openDataRequests.current.has(result.id))return;
  openDataRequests.current.add(result.id);
  try{
   if(selection.current===result.id)setNotice('Банковский анализ готов. Подключаем открытые сведения по ИНН…');
   const response=await fetch(`/api/checko?inn=${encodeURIComponent(inn)}&analysisId=${encodeURIComponent(result.id)}`,{cache:'no-store'});
   const body=await response.json().catch(()=>({})) as {cached?:boolean;error?:string};
   if(!response.ok){
    if(selection.current===result.id)setNotice('Банковский анализ готов. Открытые сведения пока недоступны; результат по выписке сохранён и работает независимо.');
    return;
   }
   if(selection.current===result.id){
    setRevision(value=>value+1);
    setNotice(body.cached?'Банковский анализ готов. Свежие открытые сведения подключены из кэша.':'Банковский анализ готов. Открытые сведения получены и добавлены к текущему анализу.');
   }
  }catch{
   if(selection.current===result.id)setNotice('Банковский анализ готов. Открытые сведения пока недоступны; результат по выписке сохранён и работает независимо.');
  }
 }
 async function accept(result:StoredAnalysis,receipt?:UploadReceipt){setAnalyses(items=>[result,...items.filter(a=>a.id!==result.id)]);chooseAnalysis(result.id);setUploadReceipt({id:result.id,receipt:receipt??{screeningResults:result.screeningResults}});choose('home');setRevision(x=>x+1);setNotice('Анализ сохранён. Серверная проверка файлов показана ниже.');void enrichOpenData(result);}
 async function addDeal(input:Omit<Deal,'id'>){if(locked)throw Error('Изменения недоступны в режиме чтения');const key=JSON.stringify(input),id=draftRequests.current.get(key)??crypto.randomUUID();draftRequests.current.set(key,id);try{const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'deal',deal:{...input,id}})});const d=await r.json();if(!r.ok)throw Error(d.error||'Заявка не сохранена. Повторите попытку.');draftRequests.current.delete(key);}catch(e){throw Error(e instanceof TypeError?'Нет подтверждения сохранения. Проверьте список заявок перед повторной попыткой.':e instanceof Error?e.message:'Заявка не сохранена');}await refresh();if(selection.current===input.analysisId)setNotice('Сервер подтвердил сохранение черновика. Внешняя отправка не выполнялась.');}
 async function updateDeal(id:string,status:string){if(locked)throw Error('Изменения недоступны в режиме чтения');try{const r=await fetch('/api/workspace',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw Error(d.error||'Статус не сохранён');}catch(e){throw Error(e instanceof TypeError?'Не удалось подтвердить действие. Обновите список перед повтором.':e instanceof Error?e.message:'Статус не сохранён');}await refresh();if(selection.current===selectedId)setNotice('Действие подтверждено сервером.');}
 const availableViews=clientAvailableViews(modules,locked||loading||modulesLoading);
 const needsModel=clientViewNeedsModel(view);
 useEffect(()=>{if(loading||modulesLoading||state.loading)return;const timer=setTimeout(()=>{const allowed=clientAvailableViews(modules,locked);if(!allowed.includes(view)){const fallback=allowed.includes('home')?'home':allowed[0];setNotice(view==='upload'&&locked?'Загрузка выписок недоступна в режиме чтения.':'Раздел временно недоступен.');if(fallback){setView(fallback);const url=new URL(window.location.href);url.searchParams.set('view',fallback);window.history.replaceState(null,'',url);}}},0);return()=>clearTimeout(timer);},[loading,modulesLoading,state.loading,modules,locked,view]);
 const disabled=modules[clientModuleKeys[view]]===false;
 const companyName=model?.basic.analysis.company.name?.trim()||selected?.companyName?.trim()||'Ваш кредитный профиль';
 return <ClientShell view={view} choose={choose} availableViews={availableViews} context={<><div className="pc-company"><b>{companyName}</b><span>{selected?.historyPurpose==='QA'?'Тестовые данные · ':''}{selected?'ИНН '+(model?.basic.analysis.company.inn??selected.companyInn):'Добавьте компанию с первой выпиской'}{model?' · '+(model.entitlement==='FULL'?'Полный анализ':'Базовый анализ')+' · Выписки: '+sourceState(model.basic.sources.statements.status):''}{locked?' · Режим просмотра':''}</span></div>{analyses.length>0&&<label className="pc-version"><span>Версия анализа</span><select aria-label="Сохранённый анализ" value={selectedId} onChange={e=>chooseAnalysis(e.target.value)}><option value="">Выберите анализ</option>{workAnalyses.length>0&&<optgroup label="Рабочие компании">{workAnalyses.map(a=><option key={a.id} value={a.id}>{a.companyName} · {date(a.createdAt??a.periodTo)}</option>)}</optgroup>}{qaAnalyses.length>0&&<optgroup label="Тестовые данные">{qaAnalyses.map(a=><option key={a.id} value={a.id}>Тест · {a.companyName} · {date(a.createdAt??a.periodTo)}</option>)}</optgroup>}</select><small>{model?date(model.basic.analysis.period.from)+' — '+date(model.basic.analysis.period.to):selectedId?'Получаем данные':'Выберите сохранённый анализ явно'}</small></label>}</>}>

 {(error.startsWith('Сессия завершена')||state.error.startsWith('Сессия завершена')||operationsError.startsWith('Сессия завершена'))&&<p role="alert">Сессия завершена. <a href={'/login?returnTo='+encodeURIComponent('/dashboard?'+new URLSearchParams({view,...(selectedId?{analysisId:selectedId}:{})}))}>Войти снова</a></p>}
 {selected&&state.diagnostic&&<p role="alert" className="ws-notice" data-workspace-diagnostic>{state.diagnostic}</p>}
 {operationsError&&<p role="alert">{operationsError}. Показанные операции могут быть неактуальны. <button disabled={operationsLoading} onClick={()=>void refresh()}>Обновить операции</button></p>}
 {state.refreshing&&<p role="status" className="pc-muted">Обновляем данные. Текущая версия остаётся на экране.</p>}{state.refreshError&&<p role="alert">{state.refreshError} Показана последняя полученная версия. <button onClick={refresh}>Повторить</button></p>}{notice&&<p role="status" className="ws-notice">{notice}</p>}{error&&<p role="alert">{error} <button onClick={()=>window.location.reload()}>Повторить</button></p>}
 {loading||modulesLoading?<p role="status">Загружаем кабинет…</p>:disabled?<p>Раздел временно недоступен.</p>:view==='upload'?(locked?<p>Загрузка выписок недоступна в режиме чтения. Выберите доступный раздел в меню.</p>:<Analyze key={selectedId} onResult={accept}/>):!selected?(selectedId?<p role="alert">Запрошенный анализ недоступен. Выберите доступную версию в истории; другой анализ автоматически не подставляется.</p>:!error&&<>{view==='home'?<EmptyHome start={availableViews.includes('upload')?()=>choose('upload'):undefined}/>:<Panel title={clientSectionTitle(view)}><p>Выберите сохранённый анализ компании для этого раздела. Ниже показаны доступные версии; выбор не выполняется автоматически.</p>{view==='documents'&&<><p className="pc-muted">Документы привязываются к выбранному анализу. Сначала выберите компанию в списке версий выше или откройте её из истории ниже. Старую компанию Prescore не подставляет автоматически.</p><p className="pc-muted">Для новой компании начните с банковской выписки TXT 1С в разделе «Новый анализ». После сохранения анализа здесь появятся отдельные формы БФО, БКИ и квартальной отчётности. Дополнительные файлы досье не запускают кредитный расчёт.</p>{availableViews.includes('upload')&&<button className="pc-primary" onClick={()=>choose('upload')}>Новый анализ по банковской выписке</button>}</>}{workAnalyses.length===0&&<p>Сохранённых анализов пока нет. Создайте первый по банковской выписке, затем добавьте отчётность и кредитную историю.</p>}{availableViews.includes('upload')&&<button className="pc-primary" onClick={()=>choose('upload')}>Создать анализ по выписке</button>}</Panel>}{workAnalyses.length>0&&<Panel title="Последние активные анализы"><p>Выберите компанию и период. Предыдущий результат не открывается автоматически.</p><div className="pc-recent-analyses">{workAnalyses.slice(0,6).map(a=><button className="pc-secondary" key={a.id} onClick={()=>chooseAnalysis(a.id)}>{a.companyName} · ИНН {a.companyInn}<small>{date(a.periodFrom)} — {date(a.periodTo)} · Создан {date(a.createdAt)}</small></button>)}</div></Panel>}{qaAnalyses.length>0&&<details className="pc-test-history"><summary>Тестовые данные · {qaAnalyses.length}</summary><p>Контрольные примеры для проверки Prescore. Они сохранены отдельно от рабочих компаний.</p><div className="pc-recent-analyses">{qaAnalyses.map(a=><button className="pc-secondary" key={a.id} onClick={()=>chooseAnalysis(a.id)}>{a.companyName}<small>Тестовый анализ · {date(a.createdAt??a.periodTo)}</small></button>)}</div></details>}</>):needsModel&&state.loading?<p role="status">Загружаем финансовую картину…</p>:needsModel&&(state.error||!model)?<p role="alert">{state.error||'Аналитическая сводка пока недоступна.'} <button onClick={refresh}>Повторить</button><button onClick={()=>choose('documents')}>Открыть документы</button></p>:selected&&<>
 {!needsModel&&state.error&&<p role="alert">{state.error} Это не означает, что документы отсутствуют. <button onClick={refresh}>Повторить загрузку сводки</button></p>}
 {view==='billing'&&<ClientBilling key={selectedId} analysisId={selectedId} readOnly={locked}/>}
 {view==='home'&&model&&<><ClientOverview key={selectedId} model={model} choose={choose} retry={refresh}/>{uploadReceipt?.id===selectedId&&<ScreeningSummary key={selectedId} receipt={uploadReceipt.receipt} open/>}</>}
 {view==='banking'&&model&&<><div className="pc-page-title"><div><h1>Финансы</h1><p>Денежный поток, ликвидность и финансовая отчётность</p></div></div><Panel title="Движение денег"><CashTrend model={model}/></Panel><BankingLedger model={model}/><FinancialStatements model={model}/>{!model.full?.report.financialAnalysis?.history.length&&<button className="pc-text-button" onClick={()=>choose('documents')}>Добавить отчётность в документах →</button>}<Panel title="Крупнейшие контрагенты">{model.basic.bankingFacts.topCounterparties?.length?<div className="pc-table-scroll"><table><thead><tr><th>Контрагент</th><th>Поступления, ₽</th><th>Доля</th></tr></thead><tbody>{model.basic.bankingFacts.topCounterparties.map((c,i)=><tr key={c.name+i}><th>{c.name}</th><td>{new Intl.NumberFormat('ru-RU').format(c.amount)}</td><td>{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(c.share*100)}%</td></tr>)}</tbody></table></div>:<p>Контрагенты не определены в доступной выписке.</p>}</Panel></>}
 {view==='analysis'&&model&&<FullCreditAnalysis key={selectedId} model={model} retry={refresh}/>}
 {view==='financing'&&model&&<><div className="pc-page-title"><div><h1>Финансирование</h1><p>Цель, параметры и подходящие механизмы финансирования</p></div></div><FinancingRequest key={selectedId+'-request'} model={model} saved={refresh}/><FinancingProducts model={model} showHeading={false}/>{!locked&&availableViews.includes('applications')&&<Panel title="Подготовить заявку"><p>Укажите цель и запрашиваемую сумму. Подготовка заявки не означает отправку в банк.</p><button className="pc-primary" onClick={()=>choose('applications')}>Перейти к заявкам</button></Panel>}</>}
 {view==='obligations'&&<>{model?<DebtPortfolio key={selectedId} model={model}/>:<div className="pc-page-title"><div><h1>Обязательства</h1><p>Кредитная история добавляется к выбранному анализу. Портфель появится после получения расчётной сводки.</p></div></div>}{!locked&&<SourceUpload key={selectedId+'-bki'} analysisId={selectedId} kind="BKI" saved={refreshSource}/>}</>}
 {view==='documents'&&<><div className="pc-page-title"><div><h1>Документы</h1><p>Комплект источников и файлы компании</p></div></div>{!locked&&<nav className="pc-source-actions" aria-label="Добавить источники анализа"><a href="#source-bfo">Добавить бухгалтерскую отчётность</a><a href="#source-bki">Добавить кредитную историю</a></nav>}{model&&<DocumentSources model={model} saved={locked?undefined:refreshSource}/>} {!locked&&<><SourceUpload key={selectedId+'-bki'} analysisId={selectedId} kind="BKI" saved={refreshSource}/><SourceUpload key={selectedId+'-bfo'} analysisId={selectedId} kind="BFO" saved={refreshSource}/><SourceUpload key={selectedId+'-quarterly'} analysisId={selectedId} kind="QUARTERLY" saved={refreshSource}/>{modules.company!==false&&<CompanyData key={selectedId} id={selectedId} inn={selected.companyInn} updated={refreshSource}/>}</>}<DocumentsHub key={selectedId} companyInn={selected.companyInn} companyName={selected.companyName} analysisId={selectedId} readOnly={locked} showHeading={false}/>{!locked&&<BrokerPermissions key={selectedId+'-permissions'} analysisId={selectedId}/>}</>}
 {view==='applications'&&<><div className="pc-page-title"><div><h1>Заявки</h1><p>Сохранённые заявки, статусы и переписка</p></div><button disabled={operationsLoading} onClick={()=>void refresh()}>{operationsLoading?'Обновляем…':'Обновить'}</button></div><Crm key={selectedId} readOnly={locked} deals={deals.filter(d=>d.analysisId===selectedId)} analyses={[selected]} selected={selected} addDeal={addDeal} updateDeal={updateDeal}/>{!locked&&<RecipientApplications key={selectedId} analysis={selected} saved={refresh}/>}</>}
 {view==='analyst'&&model&&(model.full?<AiAnalyst key={selectedId} analysisId={selectedId}/>:<FullAccessNotice model={model} retry={refresh}/>)}
 </>}
 </ClientShell>;
}
