"use client";
import type {buyerBalanceSummary} from '../../../lib/workspace/settlement-events';
import {BfoMatrix,DossierMatrixContext} from './bfo-matrix';
import type {StatementMatrix} from '../../../lib/workspace/statement-matrix';
import {CompanySources} from './company-sources';
import {latestCompanyVersion,resolveClientSelection} from '../../../lib/workspace/client-navigation';
import {BankBfoReconciliation} from './bank-bfo-reconciliation';
import {Account51ServerReconciliation} from './account51-comparison';
import {ClientPaymentCalendar} from './client-payment-calendar';
import {ClientAnalyticPipeline} from './client-analytic-pipeline';
import { useCallback, useEffect, useRef, useState } from "react";
import { Analyze, Crm, ScreeningSummary, type UploadReceipt, type StoredAnalysis, type Deal } from "./client-operations";
import { EmptyHome, FullAccessNotice, WorkspaceDiagnosticBlock, date } from "./presentation";
import { useWorkspaceModel } from "./use-model";
import { RecipientApplications } from "./source-operations";
import {ClientBilling} from './billing';
import {ClientShell,LivePage} from './approved/live-shell';
import {Panel} from './client-insights';
import {ClientOverview} from './client-launch-overview';
import {FullCreditAnalysis,FinancingProducts,DebtPortfolio,ActionPlan} from './client-analysis';
import {BankingLedger} from './banking-ledger';
import {FinancingRequest} from './financing-request';
import {BrokerPermissions} from './client-operations';
import {DocumentSources} from './client-documents';
import AiAnalyst from "../../dashboard/ai-analyst";
import "../../dashboard/dashboard.css";
import "./workspace.css";
import "../../dashboard/report-v2/analysis-v3.css";
import "./client-product.css";
export const clientModuleKeys:Record<string,string>={counterparties:'company',actions:'report',home:'overview',banking:'report',bfo:'report',calendar:'report',upload:'analysis',analysis:'report',financing:'offers',obligations:'credit',applications:'applications',documents:'documents',analyst:'analyst',billing:'billing'};
export function resolveClientView(value:string|null){
 const aliases:Record<string,string>={finance:'banking',funding:'financing',overview:'home',report:'analysis',credit:'obligations',offers:'financing',crm:'applications',analyze:'upload',company:'documents',sources:'documents',reconciliation:'analysis',recommendations:'analysis'};
 return value?(aliases[value]??(Object.hasOwn(clientModuleKeys,value)?value:'home')):'home';
}
export function clientAvailableViews(modules:Record<string,boolean>,readOnly:boolean){
 return Object.keys(clientModuleKeys).filter(view=>modules[clientModuleKeys[view]]!==false&&!(['upload','billing'].includes(view)&&readOnly));
}
// Operational sections have their own protected APIs and must remain available
// when the analytical model cannot be produced. No entitlement is granted here.
export function clientViewNeedsModel(view:string){
 return !['upload','documents','obligations','applications','billing','counterparties','bfo'].includes(view);
}
export function clientSectionTitle(view:string){
 const titles:Record<string,string>={counterparties:'Контрагенты',home:'Обзор',bfo:'БФО',calendar:'Платёжный календарь',actions:'План действий',analysis:'Кредитный профиль',banking:'Движение денег',obligations:'Кредитный портфель',financing:'Финансирование',documents:'Досье клиента',applications:'Заявки',analyst:'Кредитный эксперт',billing:'Подписка компании'};
 return Object.hasOwn(titles,view)?titles[view]:'Раздел кабинета';
}
export default function ClientWorkspace(){
 const [analyses,setAnalyses]=useState<StoredAnalysis[]>([]),[deals,setDeals]=useState<Deal[]|null>(null),[selectedId,setSelectedId]=useState(''),[view,setView]=useState('home'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[readOnly,setReadOnly]=useState(false),[revision,setRevision]=useState(0),[modules,setModules]=useState<Record<string,boolean>>({}),[modulesLoading,setModulesLoading]=useState(true);
 const [operationsError,setOperationsError]=useState(''),[operationsLoading,setOperationsLoading]=useState(false),[uploadReceipt,setUploadReceipt]=useState<{id:string;receipt:UploadReceipt}|null>(null);
 const [dossierId,setDossierId]=useState(''),[dossierInn,setDossierInn]=useState(''),[agentWorkspace,setAgentWorkspace]=useState(false);
 const [financialDossier,setFinancialDossier]=useState<{company:{id:string;inn:string};matrix:StatementMatrix}|null>(null);
 const [companies,setCompanies]=useState<{id:string;inn:string}[]>([]);
 const [ownerTestWorkspace,setOwnerTestWorkspace]=useState(false);
 const [buyerData,setBuyerData]=useState<{id:string;balances:ReturnType<typeof buyerBalanceSummary>}|null>(null);
 const [companyEntry,setCompanyEntry]=useState(0);
 const operationsReady=deals!==null;
 const operationsRequest=useRef(0),scope=useRef(''),selection=useRef(''),draftRequests=useRef(new Map<string,string>());
 const state=useWorkspaceModel(selectedId,revision);
 const unavailable=state.error==='Эта версия анализа недоступна.'||state.error.startsWith('Сессия завершена');
 const selected=unavailable?undefined:analyses.find(a=>a.id===selectedId),model=selected?state.model:null;
 const locked=readOnly||!!model?.access.readOnly;
 useEffect(()=>{const c=new AbortController();const q=new URLSearchParams(window.location.search),client=q.get('client');scope.current=client??'';
 const initialView=resolveClientView(q.get('view'));
 const initialEndpoint=client?`/api/workspace?client=${encodeURIComponent(client)}&from=agent`:initialView==='applications'?'/api/workspace':'/api/workspace?projection=summary';
 async function initialize(){
  const response=await fetch(initialEndpoint,{signal:c.signal,cache:'no-store'});
  if(!response.ok)throw Error(response.status===401?'Сессия завершена. Войдите в кабинет повторно.':response.status===403?'Нет доступа к этому кабинету.':'Не удалось открыть кабинет.');
  const data=await response.json(),rows:StoredAnalysis[]=data.analyses??[];
  let directory:{id:string;inn:string}[]=[];
  if(!client&&!data.readOnly){
   const result=await fetch('/api/dossier',{signal:c.signal,cache:'no-store'});
   if(!result.ok)throw Error('Не удалось загрузить список компаний. Обновите кабинет.');
   const listing=await result.json();
   if(c.signal.aborted)return;
   directory=listing.companies;
   setOwnerTestWorkspace(listing.ownerTestWorkspace===true);
  }
  if(c.signal.aborted)return;
  let remembered='';try{remembered=sessionStorage.getItem('prescore.selectedDossier')??'';}catch{}
  const {dossier,version}=resolveClientSelection(q,directory,rows,remembered);
  const id=initialView==='upload'?'':version;
  setAgentWorkspace(!!client);setCompanies(directory);setAnalyses(rows);
  setDeals(initialEndpoint==='/api/workspace?projection=summary'?null:data.deals??[]);setReadOnly(!!data.readOnly);
  setDossierId(dossier?.id??'');setDossierInn(dossier?.inn??'');selection.current=id;setSelectedId(id);setView(initialView);
  if(dossier){
   try{sessionStorage.setItem('prescore.selectedDossier',dossier.id);}catch{}
   const url=new URL(window.location.href);url.searchParams.set('dossierId',dossier.id);
   if(id)url.searchParams.set('analysisId',id);else url.searchParams.delete('analysisId');
   window.history.replaceState(null,'',url);
  }
 }
 void initialize().catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
 fetch('/api/modules',{signal:c.signal}).then(r=>r.json()).then(d=>setModules(d.modules??{})).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setModulesLoading(false);});return()=>c.abort();},[]);
 function choose(v:string,section?:string){if(v!=='home')setCompanyEntry(0);setView(v);const url=new URL(window.location.href);
  if(v==='analysis'&&section)url.searchParams.set('section',section);
  else if(v!==view)url.searchParams.delete('section');
  if(v!==view)url.hash='';
  if(v==='upload'){selection.current='';setSelectedId('');setUploadReceipt(null);setNotice('');url.searchParams.delete('analysisId');}if(v!=='upload'&&!selection.current&&dossierId){
   const latest=latestCompanyVersion(analyses,dossierInn);
   if(latest){selection.current=latest.id;setSelectedId(latest.id);}
  }
  if(v!=='upload'&&selection.current)url.searchParams.set('analysisId',selection.current);url.searchParams.set('view',v);if(url.href!==window.location.href)(window.history.pushState??window.history.replaceState).call(window.history,null,'',url);}
 useEffect(()=>{const restore=()=>window.location.reload();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
 const loadOperations=useCallback(async()=>{const request=++operationsRequest.current;setOperationsLoading(true);try{const r=await fetch(scope.current?`/api/workspace?client=${encodeURIComponent(scope.current)}&from=agent`:'/api/workspace',{cache:'no-store'});const d=await r.json();if(!r.ok){if(request===operationsRequest.current&&[401,403].includes(r.status)){setAnalyses([]);setDeals(null);}throw Error(r.status===401?'Сессия завершена. Войдите в кабинет повторно.':d.error||'Не удалось обновить заявки');}const rows:StoredAnalysis[]=d.analyses??[];if(request===operationsRequest.current){setAnalyses(rows);setDeals(d.deals??[]);setReadOnly(!!d.readOnly);setOperationsError('');return rows;}return null;}catch(e){if(request===operationsRequest.current)setOperationsError(e instanceof Error?e.message:'Не удалось обновить данные');return null;}finally{if(request===operationsRequest.current)setOperationsLoading(false);}},[]);
 const reloadModel=state.refresh;
 const refresh=useCallback(async()=>{await loadOperations();await reloadModel();},[loadOperations,reloadModel]);
 const refreshSource=useCallback(async()=>{
  const refreshed=await loadOperations();
  if(!refreshed)throw Error('Документ сохранён, но список анализов не обновился. Нажмите «Повторить» перед продолжением.');
  if(!selectedId&&dossierId){
   const latest=latestCompanyVersion(refreshed,dossierInn);
   if(latest){
    selection.current=latest.id;setSelectedId(latest.id);
    const url=new URL(window.location.href);url.searchParams.set('dossierId',dossierId);url.searchParams.set('analysisId',latest.id);
    window.history.replaceState(null,'',url);
    return;
   }
  }
  if(!selectedId||!await reloadModel())throw Error('Документ сохранён, но актуальная версия анализа не подтвердилась. Нажмите «Повторить» перед продолжением.');
 },[loadOperations,reloadModel,selectedId,dossierId,dossierInn]);
 useEffect(()=>{if(!['applications','financing'].includes(view)||loading)return;const timer=setTimeout(()=>void loadOperations(),0);return()=>clearTimeout(timer);},[view,loading,loadOperations]);
 function chooseAnalysis(id:string,inn=analyses.find(a=>a.id===id)?.companyInn,directory=companies){
  const company=directory.find(item=>item.inn===inn);
  const retained=!agentWorkspace&&(company?.id||(dossierId&&dossierInn===inn?dossierId:''));
  setDossierId(retained||'');setDossierInn(retained?inn??'':'');selection.current=id;setSelectedId(id);
  const u=new URL(window.location.href);u.searchParams.set('analysisId',id);
  if(retained)u.searchParams.set('dossierId',retained);else u.searchParams.delete('dossierId');
  for(const key of ['bankMonth','cashMonth','cashSeries','cashFor','cashMode'])u.searchParams.delete(key);
  if(u.href!==window.location.href)window.history.pushState(null,'',u);setUploadReceipt(null);setNotice('');
 }
 async function accept(result:StoredAnalysis,receipt?:UploadReceipt){setAnalyses(items=>[result,...items.filter(a=>a.id!==result.id)]);let directory=companies;
  if(!agentWorkspace&&!directory.some(d=>d.inn===result.companyInn)){
   const response=await fetch('/api/dossier',{cache:'no-store'});
   if(response.ok){directory=(await response.json()).companies;setCompanies(directory);}
  }
  chooseAnalysis(result.id,result.companyInn,directory);setUploadReceipt({id:result.id,receipt:receipt??{screeningResults:result.screeningResults}});choose('banking');setRevision(x=>x+1);setNotice('Выписка 1С обработана и добавлена в расчёт.');}
 async function addDeal(input:Omit<Deal,'id'>){if(locked)throw Error('Изменения недоступны в режиме чтения');const key=JSON.stringify(input),id=draftRequests.current.get(key)??crypto.randomUUID();draftRequests.current.set(key,id);try{const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'deal',deal:{...input,id}})});const d=await r.json();if(!r.ok||d.deal?.id!==id)throw Error(d.error||'Заявка не сохранена. Повторите попытку.');draftRequests.current.delete(key);}catch(e){throw Error(e instanceof TypeError?'Нет подтверждения сохранения. Проверьте список заявок перед повторной попыткой.':e instanceof Error?e.message:'Заявка не сохранена');}await refresh();if(selection.current===input.analysisId)setNotice('Сервер подтвердил сохранение черновика. Внешняя отправка не выполнялась.');}
 async function updateDeal(id:string,status:string){if(locked)throw Error('Изменения недоступны в режиме чтения');try{const r=await fetch('/api/workspace',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw Error(d.error||'Статус не сохранён');}catch(e){throw Error(e instanceof TypeError?'Не удалось подтвердить действие. Обновите список перед повтором.':e instanceof Error?e.message:'Статус не сохранён');}await refresh();if(selection.current===selectedId)setNotice('Действие подтверждено сервером.');}
 const availableViews=clientAvailableViews(modules,locked||loading||modulesLoading);
 const needsModel=clientViewNeedsModel(view);
 useEffect(()=>{if(loading||modulesLoading||state.loading)return;const timer=setTimeout(()=>{const allowed=clientAvailableViews(modules,locked);if(!allowed.includes(view)){const fallback=allowed.includes('home')?'home':allowed[0];setNotice(view==='upload'&&locked?'Загрузка выписок недоступна в режиме чтения.':'Раздел временно недоступен.');if(fallback){setView(fallback);const url=new URL(window.location.href);url.searchParams.set('view',fallback);window.history.replaceState(null,'',url);}}},0);return()=>clearTimeout(timer);},[loading,modulesLoading,state.loading,modules,locked,view]);
 const disabled=modules[clientModuleKeys[view]]===false;
 const showApproved=!(['counterparties','calendar'].includes(view)&&!agentWorkspace&&!locked)&&!loading&&!modulesLoading&&!disabled&&!error&&!unavailable&&(!needsModel||!!model)&&!!selected&&!(view==='applications'&&(!operationsReady||!!operationsError));
 const companyName=model?.basic.analysis.company.name?.trim()||selected?.companyName?.trim()||'Ваш кредитный профиль';
 const sourcesVisible=!loading&&!modulesLoading&&!disabled&&!error&&!locked&&!agentWorkspace&&!unavailable&&(!selectedId||!!selected)&&['home','banking','bfo','counterparties','obligations','documents','analysis','calendar','actions','financing','billing'].includes(view);
 const sourcesWidget=sourcesVisible?<CompanySources key={'sources:'+dossierId+':'+selectedId+':'+view} view={view} choose={choose} id={dossierId} analysisId={selected?.id} model={model} onMatrix={setFinancialDossier} ownerTestWorkspace={ownerTestWorkspace} onBuyerBalances={ownerTestWorkspace&&view==='home'?setBuyerData:undefined} companyEntry={view==='home'?companyEntry:0} bankInn={selected?.companyInn} bank={model?.basic} onCompany={setDossierInn} onSourceChanged={selectedId||dossierId?refreshSource:undefined} openBank={()=>choose('documents')}/>:null;
 const openCompanyEntry=!locked&&availableViews.includes('home')&&!agentWorkspace&&!error
  ?()=>{choose('home');setCompanyEntry(n=>n+1);} : undefined;
 const currentMatrix=sourcesVisible&&financialDossier?.matrix&&
   (!dossierId||financialDossier.company.id===dossierId)&&(!selected||financialDossier.company.inn===selected.companyInn)&&
   (dossierId||selected)?financialDossier.matrix:null;
 return <DossierMatrixContext.Provider value={currentMatrix}><ClientShell buyerBalances={ownerTestWorkspace&&buyerData?.id===dossierId?buyerData.balances:null} onAddCompany={openCompanyEntry} key={dossierId||selectedId} companies={companies} dossier={dossierId?{id:dossierId,inn:dossierInn}:undefined} selected={selected} analyses={unavailable||error?[]:analyses} model={model} locked={locked||loading||modulesLoading} select={chooseAnalysis} add={addDeal} deals={deals??[]}
 renderPage={showApproved} view={view} choose={choose} availableViews={availableViews} context={<div className="pc-company"><b>{companyName}</b><span>{selected?'ИНН '+(model?.basic.analysis.company.inn??selected.companyInn):'Кредитный профиль компании'}{model?' · '+date(model.basic.analysis.period.from)+' — '+date(model.basic.analysis.period.to):''}{locked?' · Режим просмотра':''}</span></div>}>

 {(error.startsWith('Сессия завершена')||state.error.startsWith('Сессия завершена')||operationsError.startsWith('Сессия завершена'))&&<p role="alert">Сессия завершена. <a href={'/login?returnTo='+encodeURIComponent(window.location.pathname+window.location.search+window.location.hash)}>Войти снова</a></p>}
 {operationsError&&<p role="alert">{operationsError}. Показанные операции могут быть неактуальны. <button disabled={operationsLoading} onClick={()=>void refresh()}>Обновить операции</button></p>}
 {state.refreshing&&<p role="status" className="pc-muted">Обновляем данные. Текущая версия остаётся на экране.</p>}{state.refreshError&&<p role="alert">{state.refreshError} Показана последняя полученная версия. <button onClick={refresh}>Повторить</button></p>}{notice&&<p role="status" className="ws-notice">{notice}</p>}{error&&<p role="alert">{error} <button onClick={()=>window.location.reload()}>Повторить</button></p>}
 {view==='documents'&&!locked&&!agentWorkspace&&availableViews.includes('upload')&&!loading&&!modulesLoading&&<section className="pc-panel pc-statement-upload" aria-label="Выписка 1С"><h2>Выписка 1С (.txt)</h2><p className="pc-muted">Файл 1CClientBankExchange разбирается движком Prescore, привязывается к выбранной компании и сразу попадает в «Движение денег» и кредитный расчёт.</p><Analyze key={'stmt:'+view+':'+dossierId} dossierId={dossierId||undefined} onResult={accept}/></section>}
 {view==='banking'&&!locked&&!agentWorkspace&&availableViews.includes('documents')&&!loading&&!modulesLoading&&<div className="pc-banking-actions"><button type="button" className="btn primary" onClick={()=>choose('documents')}>Загрузить документы</button></div>}
  {view==='documents'&&sourcesWidget}
 {view==='home'&&(!model||companyEntry>0)&&sourcesWidget}
 {view==='home'&&uploadReceipt?.id===model?.analysisId&&model&&uploadReceipt&&<section className="pc-register-receipt" aria-label="Результат загрузки выписки">
   <h2>Обновлён анализ денежных потоков</h2><p>{date(model.basic.analysis.period.from)} — {date(model.basic.analysis.period.to)}</p>
   <dl className="pc-source-kpis">{[model.basic.bankingFacts.grossInflow,model.basic.bankingFacts.grossOutflow].map((fact,i)=>
     typeof fact.value==='number'&&<div key={i}><dt>{i===0?'Внешние поступления':'Внешние списания'}</dt><dd>{fact.value.toLocaleString('ru-RU')} ₽</dd></div>)}</dl>
   {model.basic.bankingFacts.balanceCheck?.state==='VERIFIED'&&<p>Остатки сверены · на конец периода {model.basic.bankingFacts.balanceCheck.closing.toLocaleString('ru-RU')} ₽</p>}
   {model.basic.bankingFacts.balanceCheck?.state==='MISMATCH'&&<p>Проверка остатков выявила расхождение. Сверьте начальный и конечный остатки с выпиской.</p>}
   <button type="button" onClick={()=>choose('banking')}>Открыть движение денег</button></section>}
 {view==='home'&&uploadReceipt?.id===selectedId&&uploadReceipt?.receipt.screeningResults?.some(s=>s.status!=='ACCEPTED')&&<ScreeningSummary receipt={uploadReceipt.receipt} open/>}
 <LivePage>{loading||modulesLoading?<p role="status">Загружаем кабинет…</p>:disabled?<p>Раздел временно недоступен.</p>:view==='bfo'?null:view==='upload'?(locked?<p>Загрузка выписок недоступна в режиме чтения. Выберите доступный раздел в меню.</p>:<Analyze key={selectedId} dossierId={dossierId||undefined} onResult={accept}/>):!selected?(selectedId?<p role="alert">Этот анализ больше недоступен. Откройте обзор или создайте новый.</p>:!error&&(view==='home'&&!dossierId?<EmptyHome start={availableViews.includes('upload')?()=>choose('upload'):undefined}/>:dossierId&&['home','banking','bfo','counterparties','obligations','documents','analysis','calendar','actions','financing','billing'].includes(view)?null:<Panel title={clientSectionTitle(view)}><p>Выберите компанию для работы с её источниками.</p>{['banking','documents'].includes(view)&&availableViews.includes('upload')&&<button className="pc-primary" onClick={()=>choose('upload')}>Новый анализ</button>}</Panel>)):needsModel&&state.loading?<p role="status">Загружаем финансовую картину…</p>:needsModel&&(state.error||!model)?<><p role="alert">{state.error||'Не удалось открыть анализ.'} <button onClick={refresh}>Повторить</button><button onClick={()=>choose('documents')}>Открыть документы</button></p><WorkspaceDiagnosticBlock model={model} diagnosticMessage={state.diagnostic}/></>:selected&&<>
 {!needsModel&&state.error&&<><p role="alert">{state.error} Это не означает, что документы отсутствуют. <button onClick={refresh}>Повторить загрузку сводки</button></p><WorkspaceDiagnosticBlock model={model} diagnosticMessage={state.diagnostic}/></>}
 {view==='billing'&&<ClientBilling key={selectedId} analysisId={selectedId} readOnly={locked}/>}
 {view==='home'&&model&&!showApproved&&<ClientOverview key={selectedId} model={model} choose={choose} retry={refresh}/>} 
 {view==='calendar'&&model&&(agentWorkspace||locked)&&<ClientPaymentCalendar model={model}/>}
 {view==='banking'&&model&&<><div className="pc-page-title"><div><h1>Финансы</h1><p>Денежный поток, ликвидность и финансовая отчётность</p></div></div><BankingLedger model={model}/><Account51ServerReconciliation items={model.basic.account51Reconciliation}/><BankBfoReconciliation rows={model.full?.report.reconciliation?.bankBfo}/>{model.full&&!model.full.report.financialAnalysis?.history.length&&<button className="pc-text-button" onClick={()=>choose('documents')}>Добавить отчётность в документах →</button>}<Panel title="Крупнейшие контрагенты">{model.basic.bankingFacts.topCounterparties?.length?<div className="pc-table-scroll"><table><thead><tr><th>Контрагент</th><th>Поступления, ₽</th><th>Доля</th></tr></thead><tbody>{model.basic.bankingFacts.topCounterparties.map((c,i)=><tr key={c.name+i}><th>{c.name}</th><td>{new Intl.NumberFormat('ru-RU').format(c.amount)}</td><td>{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(c.share*100)}%</td></tr>)}</tbody></table></div>:<p>Контрагенты не определены в доступной выписке.</p>}</Panel></>}
 {view==='analysis'&&model&&<FullCreditAnalysis key={selectedId} compactHeader={showApproved} statementMatrix={currentMatrix?<BfoMatrix matrix={currentMatrix}/>:null} model={model} dossierId={locked||agentWorkspace?undefined:dossierId} retry={refresh}/>}
  {view==='actions'&&model&&(model.full?<ActionPlan key={selectedId} model={model}/>:<FullAccessNotice model={model} retry={refresh} diagnosticMessage={state.diagnostic}/>)}
 {view==='financing'&&model&&<><div className="pc-page-title"><div><h1>Финансирование</h1><p>Цель, параметры и подходящие механизмы финансирования</p></div></div><FinancingRequest key={selectedId+'-request'} model={model} saved={refresh}/><FinancingProducts model={model} showHeading={false}/>{operationsReady&&!operationsError&&<Crm key={selectedId+'-financing-deals'} readOnly={locked} deals={deals.filter(d=>d.analysisId===selectedId)} analyses={[selected]} selected={selected} addDeal={addDeal} updateDeal={updateDeal}/>} {!operationsReady&&!operationsError&&<p role="status">Загружаем заявки и переписку…</p>}</>}
 {view==='obligations'&&<>{model?<DebtPortfolio key={selectedId} model={model} embedded={showApproved}/>:<div className="pc-page-title"><div><h1>Обязательства</h1><p>Добавьте отчёт БКИ или кредитный договор в досье компании.</p></div></div>}</>}
 {view==='documents'&&<><div className="pc-page-title"><div><h1>Документы</h1><p>Комплект источников и файлы компании</p></div></div>{!locked&&<nav className="pc-source-actions" aria-label="Добавить источники анализа"><a href="#dossier-intake">Добавить документ в досье</a></nav>}{model&&<DocumentSources model={model} readOnly={locked} externalEnabled={modules.company!==false} saved={locked?undefined:refreshSource}/>}{!locked&&<BrokerPermissions key={selectedId+'-permissions'} analysisId={selectedId}/>}</>}
 {view==='applications'&&!operationsReady&&!operationsError&&<p role="status">Загружаем заявки…</p>}
 {view==='applications'&&operationsReady&&!operationsError&&<><div className="pc-page-title"><div><h1>Заявки</h1><p>Сохранённые заявки, статусы и переписка</p></div><button disabled={operationsLoading} onClick={()=>void refresh()}>{operationsLoading?'Обновляем…':'Обновить'}</button></div><Crm key={selectedId} readOnly={locked} deals={deals.filter(d=>d.analysisId===selectedId)} analyses={[selected]} selected={selected} addDeal={addDeal} updateDeal={updateDeal}/>{!locked&&<RecipientApplications key={selectedId} analysis={selected} saved={refresh}/>}</>}
 {view==='analyst'&&model&&(model.full?<AiAnalyst key={selectedId} analysisId={selectedId}/>:<FullAccessNotice model={model} retry={refresh} diagnosticMessage={state.diagnostic}/>)}
 </>}</LivePage>
 {view!=='documents'&&(view!=='home'||(model&&companyEntry===0))&&sourcesWidget}
 {showApproved&&model&&(['home','counterparties','obligations'] as string[]).includes(view)&&<ClientAnalyticPipeline key={'pipeline:'+selectedId+':'+view} model={model} scope={view as 'home'|'bfo'|'counterparties'|'obligations'} choose={choose}/>}
 </ClientShell></DossierMatrixContext.Provider>;
}
