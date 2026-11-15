'use client';
import {useRouter} from 'next/navigation';
import {useEffect,useState,useRef} from 'react';
import type {FormEvent} from 'react';
import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {PLAN} from '../../../lib/billing/domain';
import {SourceReview} from './source-review';
import {CalendarEntries} from './calendar-entries';
import {FinancialDynamics} from './financial-dynamics';
import {label} from './credit-depth';
import {numeric,Warnings} from './client-financials';
import {Panel} from './client-insights';
import DocumentsHub from '../../dashboard/documents-hub';
import {DossierPortfolio} from './dossier-portfolio';
import './client-registers.css';
import {SettlementRegisters} from './settlement-registers';
import {Account51Comparison} from './account51-comparison';
import type {WorkspaceBasicV1} from '../../../lib/workspace/model';
import {CompanyPassport} from './client-passport';
import type {PassportPublicProfile} from '../../../lib/workspace/public-passport';

type Company={id:string;inn:string};
type PublicProfile=PassportPublicProfile;
type Profile=ReturnType<typeof sourceProjection>&{company:Company;versions:{id:string;name:string;start:string;end:string}[];publicProfile:PublicProfile|null;entitlement:string};
const labels:Record<string,string>={ACCOUNT_51:'Карточка счёта 51 · XLSX',BFO:'Годовая бухгалтерская отчётность',QUARTERLY:'Промежуточная отчётность',BKI:'БКИ · НБКИ, ОКБ или СБ БКИ',COUNTERPARTIES:'ОСВ 60, 62 и 76',DEBT_LEDGER:'ОСВ 66 и 67',CHECKO:'Публичные сведения',BANK_STATEMENT:'Банковская выписка',CALENDAR:'Календарь',CREDIT_DOCUMENT:'Кредитные договоры',COMMERCIAL_DOCUMENT:'Контракты и договоры контрагентов',BFO_REVIEW:'Проверка полей БФО PDF'};
const kinds:Record<string,string[]>={banking:['ACCOUNT_51'],bfo:['BFO','QUARTERLY','BFO_REVIEW'],obligations:['BKI','DEBT_LEDGER','CREDIT_DOCUMENT'],counterparties:['COUNTERPARTIES','COMMERCIAL_DOCUMENT'],documents:['ACCOUNT_51','BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER','BFO_REVIEW','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT']};
const dossierHref=(id:string,view:string)=>'/dashboard?'+new URLSearchParams({dossierId:id,view});
async function read<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...options}),body=await response.json();
 if(!response.ok)throw Error(body.error??'Не удалось открыть досье.');
 return body;
}
function ScanLayout(){
 return <details><summary>Раскладка скана</summary><label>Страницы PDF <select name="layout" defaultValue="SINGLE"><option value="SINGLE">Одна страница на листе</option><option value="TWO_UP_ROTATED">Две страницы на повёрнутом листе</option></select></label></details>;
}
export function CompanySources({view,id,bankInn,bank,openBank,onCompany,onSourceChanged}:{view:string;id:string;bankInn?:string;bank?:WorkspaceBasicV1;openBank:()=>void;onCompany:(inn:string)=>void;onSourceChanged?:()=>Promise<unknown>}){
 const router=useRouter();
 const [inn,setInn]=useState(bankInn??''),[companies,setCompanies]=useState<Company[]>([]),[profile,setProfile]=useState<Profile|null>(null),[preview,setPreview]=useState<PublicProfile|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[selectedYear,setYear]=useState('');
 useEffect(()=>{const ctrl=new AbortController();(async()=>{
   const list=await read<{companies:Company[]}>('/api/dossier',{signal:ctrl.signal});
   if(ctrl.signal.aborted)return;
   setCompanies(list.companies);
   if(id){
     const key='pc-ocr-notice:'+id,message=sessionStorage.getItem(key);
     if(message){setError(message);sessionStorage.removeItem(key);}
   }
   const matched=id||list.companies.find(c=>c.inn===bankInn)?.id;
   if(matched){const current=await read<Profile>('/api/dossier?id='+encodeURIComponent(matched),{signal:ctrl.signal});if(!ctrl.signal.aborted){setProfile(current);onCompany(current.company.inn);}}
 })().catch(e=>{if(!ctrl.signal.aborted)setError(e.message)});return()=>ctrl.abort();},[id,bankInn,revision,onCompany]);
 const company=profile?.company;
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function recognize(id:string,sourceId:string,layout:string){
   let through=0;
   while(mounted.current){
     const batch=await read<{through:number;total:number}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recognize',id,sourceId,layout})});
     if(!mounted.current)return;
     if(batch.through<=through)throw Error('Распознавание приостановлено. Продолжите с сохранённой страницы.');
     through=batch.through;
     setNotice('Распознано страниц: '+through+' из '+batch.total);
     if(through===batch.total)break;
   }
   setRevision(n=>n+1);
 }
 async function submit(action:'preview'|'save'){
  setBusy(true);setError('');setNotice('');
  try{
    const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,inn,attachPublic:!!preview,refreshPublic:action==='save'&&view==='home'&&!preview})};
    if(action==='preview'){
      const result=await read<{profile:PublicProfile|null;status:string}>('/api/dossier',options);setPreview(result.profile);
      if(!result.profile)setNotice(({NOT_CONFIGURED:'Checko не настроен.',RETRY_LATER:'Повторите запрос позже.',FAILED:'Checko не вернул данные.'} as Record<string,string>)[result.status]??'Публичные сведения пока недоступны.');
    } else {const result=await read<{company:Company}>('/api/dossier',options);location.assign(dossierHref(result.company.id,view));}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=event.currentTarget,data=new FormData(form);if(company)data.set('id',company.id);else if(inn.trim())data.set('inn',inn.trim());
  setBusy(true);setError('');setNotice('');
  try{
    const result=await read<{id:string;duplicate:boolean;dossierId:string;pending:boolean;layout?:string}>('/api/dossier',{method:'POST',body:data});
    form.reset();setRevision(n=>n+1);
    if(result.pending){
      try{await recognize(result.dossierId,result.id,result.layout??String(data.get('layout')??'SINGLE'));}
      catch(e){if(company)throw e;sessionStorage.setItem('pc-ocr-notice:'+result.dossierId,String((e as Error).message));}
    }
    if(!company){location.assign(dossierHref(result.dossierId,view));return;}
    if(!result.pending)await onSourceChanged?.();
    setNotice(result.duplicate?'Этот документ уже учтён.':result.pending?'Документ сохранён. Проверьте распознанные поля.':'Документ сохранён.');
  }
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const years=profile?.financial?.history??[],period=years.find(p=>p.id===selectedYear)??years.at(-1);
 const periodSourceId=profile?.lines.find(s=>s.id===period?.id)?.sourceId;
 const periodSource=profile?.sources.find(s=>s.id===periodSourceId)??(period&&profile?.publicProfile&&[...profile.sources].reverse().find(s=>s.kind==='CHECKO'));
 const relevantClaims=profile?.claims.filter(c=>view==='home'||view==='analysis'||view==='actions'||view==='financing'&&c.stage==='product'||c.sources.some(s=>view==='bfo'?['BFO','QUARTERLY'].includes(s.type):view==='obligations'?s.type==='BKI'||profile.sources.some(r=>c.sourceIds.includes(r.id)&&r.kind==='CREDIT_DOCUMENT'):false))??[];
 const [portfolioSource,setPortfolioSource]=useState('BKI');
 const portfolioTabs=[['BKI','БКИ'],['CREDIT_DOCUMENT','Кредитные договоры'],['DEBT_LEDGER','ОСВ 66 и 67']];
 const visibleKinds=view==='obligations'?[portfolioSource]:kinds[view]??[];
 const currentLedger=profile?.ledger.filter(l=>l.kind===(view==='obligations'?'DEBT_LEDGER':'COUNTERPARTIES'))??[];

 const bfoClaims=profile?.claims.filter(c=>c.sources.some(s=>['BFO','QUARTERLY','CHECKO'].includes(s.type)))??[];
 const reviews=profile?.reviews.filter(review=>view==='documents'||visibleKinds.includes(profile.sources.find(s=>s.id===review.id)?.kind??''))??[];
 const reviewPanels=company&&reviews.map(review=><SourceReview key={review.id} review={review}
   recognize={layout=>recognize(company.id,review.id,layout)}
   approveBureau={async()=>{
     await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm-bureau',id:company.id,sourceId:review.id})});
     setRevision(v=>v+1);await onSourceChanged?.();
   }}
   save={async(field,value)=>{
     await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify-field',id:company.id,sourceId:review.id,field,value,previous:review.verified[field]})});
     setRevision(v=>v+1);await onSourceChanged?.();
   }}/>);
 if(view==='bfo'){
  const metrics=period?.groups.flatMap(g=>g.metrics)??[];
  const keys=['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','RECEIVABLES','PAYABLES','TOTAL_BORROWINGS','TOTAL_LIABILITIES','netMargin','currentRatio'];
  const kpis=metrics.filter(m=>keys.includes(m.key)&&m.value!==null);
  const stages=[
   {key:'expert',title:'Экспертность',empty:'Финансовые выводы появятся после получения подтверждённых показателей.'},
   {key:'stop',title:'Стоп-факторы',empty:'Отдельный подтверждённый стоп-фактор по доступным источникам не опубликован.'},
   {key:'recommendation',title:'Рекомендации',empty:'Добавьте финансовые показатели для формирования адресных рекомендаций.'},
   {key:'product',title:'Предложения',empty:'Финансирование подбирается по общему кредитному профилю, а не по одному балансу.'},
   {key:'plan',title:'План 7 / 30 / 60',empty:'План действий формируется по подтверждённым фактам компании.'}
  ] as const;
  async function lookup(){
   setBusy(true);setError('');setNotice('');
   try{
     const post=(nextAction:'preview'|'save',attachPublic=false)=>({
       method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action:nextAction,inn,attachPublic}),
     });
     // A BFO entry always opens an existing company dossier. Checko is
     // optional, and failed external lookup cannot block an INN-only company.
     let attachPublic=!!preview;
     if(!attachPublic){
       try{
         const result=await read<{profile:PublicProfile|null;status:string}>('/api/dossier',post('preview'));
         attachPublic=!!result.profile;
       }catch{
         // Preserve the independent INN-only path.
       }
     }
     const result=await read<{company:Company}>('/api/dossier',post('save',attachPublic));
     location.assign(dossierHref(result.company.id,view));
   }catch(e){setError((e as Error).message);}
   finally{setBusy(false);}
  }
  return <div className="ws pc-company-sources pc-bfo" aria-label="Финансовый профиль БФО">
   <div className="pc-bfo-intro"><span>ФИНАНСОВАЯ АНАЛИТИКА PRESCORE</span><h2>Бухгалтерская отчётность</h2><p>Финансовые показатели, динамика и выводы по подтверждённым источникам. Начните с ИНН или загрузите отчётность.</p></div>
   <div className="pc-bfo-start">
    <section className="pc-bfo-input">
     <h3>Найти компанию по ИНН</h3><p>Проверим доступные сведения через Checko и откроем финансовый профиль.</p>
     <form onSubmit={e=>{e.preventDefault();void lookup()}}>
      <label htmlFor="bfo-company-inn">ИНН компании</label>
      <div className="pc-bfo-inline"><input id="bfo-company-inn" required inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" value={inn} onChange={e=>{setInn(e.target.value.replace(/\D/g,'').slice(0,12));setPreview(null);}} placeholder="10 или 12 цифр" disabled={busy}/><button type="submit" disabled={busy}>Получить данные</button></div>
     </form>
     {companies.length>0&&<label className="pc-bfo-existing">Мои компании <select value={company?.id??''} onChange={e=>{if(e.target.value)location.assign(dossierHref(e.target.value,'bfo'))}}><option value="">Выберите компанию</option>{companies.map(c=><option key={c.id} value={c.id}>{c.inn}</option>)}</select></label>}
    </section>
    <section className="pc-bfo-input">
     <h3>Загрузить баланс и Ф2</h3><p>Годовая отчётность доступна бесплатно. Промежуточная отчётность и углублённый анализ входят в полный доступ.</p>
     <form onSubmit={upload}>
      <input type="hidden" name="kind" value="AUTO_BFO"/>
      <label htmlFor="bfo-upload-file">Файл отчётности (PDF, фото, Excel, CSV)</label>
      <input id="bfo-upload-file" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv" required disabled={busy}/>
      <ScanLayout/>
      <button type="submit" disabled={busy}>Загрузить и проанализировать</button>
     </form>
    </section>
   </div>
   {profile&&<section className="pc-bfo-dashboard" aria-label="Дашборд бухгалтерской отчётности">
    <div className="pc-bfo-identity"><div><span>ФИНАНСОВЫЙ ПРОФИЛЬ</span><h2>{profile.publicProfile?.company.name||'Компания · ИНН '+company?.inn}</h2><p>ИНН {company?.inn}{profile.publicProfile?.company.region?' · '+profile.publicProfile.company.region:''}{profile.publicProfile?.company.status?' · '+profile.publicProfile.company.status:''}</p></div>
     {company&&(period||profile.publicProfile)&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const report=await read<{snapshot:string}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'issue-report',id:company.id})});router.push('/dashboard/report-v2?'+new URLSearchParams({dossierId:company.id,snapshotId:report.snapshot,print:'1'}));}catch(e){setError((e as Error).message);setBusy(false);}}}>Отчёт PDF</button>}
    </div>
    {period&&<div className="pc-bfo-period"><label htmlFor="bfo-reporting-period">Отчётный период</label><select id="bfo-reporting-period" value={period.id} onChange={e=>setYear(e.target.value)}>{years.map(p=><option key={p.id} value={p.id}>{p.period.from||'Дата не указана'} — {p.period.to||p.period.asOf||'Дата не указана'}</option>)}</select><span>{period.period.kind==='ANNUAL'?'Годовая отчётность':'Промежуточная отчётность'}</span></div>}
    {period?<><div className="pc-bfo-kpis">{kpis.map(m=><article key={m.key} className="pc-bfo-kpi"><h3>{m.label}</h3><strong>{numeric(m.value,m.status,m.unit).replace(/[\u00a0\u202f]/g,' ')}</strong><span>{m.periodFrom&&m.periodTo?m.periodFrom+' — '+m.periodTo:m.asOf??period.period.asOf}</span><small>{label(m.origin)} · {label(m.confidence)}</small></article>)}</div>
     <div className="pc-bfo-charts"><FinancialDynamics history={years}/></div>
     <div className="pc-bfo-balance"><h3>Контроль отчётности</h3><p>{period.quality.balanceReconciled===true?'Баланс сходится: активы согласованы с капиталом и обязательствами.':period.quality.balanceReconciled===false?'Обнаружено расхождение баланса. Проверьте строки и единицы измерения.':'Сверка баланса требует дополнительных подтверждённых строк.'}</p>{periodSource&&<small>Источник: {periodSource.name}</small>}</div>
     <details className="pc-bfo-detail"><summary>Все финансовые коэффициенты и строки Ф1 / Ф2</summary>{period.groups.map(g=><section key={g.key}><h3>{g.title}</h3><dl>{g.metrics.filter(m=>m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></section>)}</details>
    </>:<div className="pc-bfo-no-finances"><h3>Компания добавлена в финансовый профиль</h3><p>{profile.publicProfile?'Данные Checko доступны в пределах текущего тарифа. Загрузите БФО, чтобы получить показатели и динамику в этом разделе.':'Загрузите БФО либо получите доступные сведения Checko по ИНН. Финансовые цифры без источников не создаются.'}</p></div>}
   </section>}
   {profile&&<section className="pc-bfo-insights" aria-label="Экспертные выводы по БФО"><header><h2>Экспертность и следующие действия</h2><p>Все выводы видны сразу. Содержание зависит от подтверждённых данных компании.</p></header><div className="pc-bfo-insight-grid">{stages.map((stage,i)=>{const items=bfoClaims.filter(c=>c.stage===stage.key);const balanceText=stage.key==='expert'&&period?(period.quality.balanceReconciled===true?'БФО: баланс сходится':period.quality.balanceReconciled===false?'БФО: баланс требует сверки':'БФО: сверка баланса не подтверждена'):null;return <article className="pc-bfo-insight" key={stage.key}><span>{i+1} / 5</span><h3>{stage.title}</h3>{balanceText&&<p className="pc-bfo-main-fact">{balanceText}</p>}{items.length>0?<ul>{items.map(c=><li key={c.id}><strong>{c.horizon?({'DAY_7':'7 дней','DAY_30':'30 дней','DAY_60':'60 дней'}[c.horizon])+' · ':''}{c.title}</strong><p>{c.text}</p>{c.sources.length>0&&<small>Основание: {c.sources.map(s=>s.type+' · '+s.date).join('; ')}</small>}</li>)}</ul>:!balanceText&&<p>{stage.empty}</p>}</article>})}</div></section>}
   {reviewPanels}
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </div>;
 }

 return <div className="ws pc-company-sources" aria-label="Источники компании">
 {(!company||view==='home')&&<Panel title={view==='home'?'Выбрать или добавить компанию':'Компания по ИНН'}>
  {companies.length>0&&<label>Компании в моём досье <select value={company?.id??''} onChange={e=>{if(e.target.value)location.assign(dossierHref(e.target.value,view))}}><option value="">Выберите компанию</option>{companies.map(c=><option key={c.id} value={c.id}>{c.inn}</option>)}</select></label>}
  <form onSubmit={e=>{e.preventDefault();void submit('save')}}><label>ИНН новой компании <input required inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" value={inn} disabled={busy} onChange={e=>{setInn(e.target.value.replace(/\D/g,'').slice(0,12));setPreview(null);setNotice('')}} placeholder="10 или 12 цифр"/></label>
  {view==='home'&&<button type="button" disabled={busy||!inn} onClick={()=>void submit('preview')}>Проверить Checko</button>}
  <button type="submit" disabled={busy||!inn}>+ Добавить компанию</button></form>
  </Panel>}
  {view==='counterparties'&&<SettlementRegisters rows={profile?.settlements??[]}/>}
  {view==='banking'&&<Account51Comparison cards={profile?.cards51??[]} bank={bank}/>}
  {view==='home'&&(company||preview)&&<CompanyPassport inn={company?.inn??inn} profile={profile?.publicProfile??preview} hasStatements={(profile?.versions.length??0)>0} hasAnnual={!!profile?.financial?.history.some(p=>p.period.kind==='ANNUAL')} full={profile?.entitlement==='FULL'} onBankUpload={openBank}/>}
  {view==='home'&&preview&&!company&&<p className="pc-muted">Публичная проверка выполнена для предварительного просмотра. Чтобы сохранить сведения в личном досье, нажмите «Добавить компанию».</p>}
  {view==='obligations'&&<nav className="pc-source-actions" aria-label="Источники кредитного портфеля">{portfolioTabs.map(([kind,title])=><button type="button" key={kind} aria-pressed={portfolioSource===kind} onClick={()=>setPortfolioSource(kind)}>{title}</button>)}</nav>}
 {view==='obligations'&&!company&&!bankInn&&<DossierPortfolio profile={null} />}
 {company&&<><p>Досье компании · ИНН {company.inn}</p>
 {['home','bfo','analysis','documents'].includes(view)&&(profile.financial||profile.obligations.length>0||profile.publicProfile)&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const report=await read<{snapshot:string}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'issue-report',id:company.id})});router.push('/dashboard/report-v2?'+new URLSearchParams({dossierId:company.id,snapshotId:report.snapshot,print:'1'}));}catch(e){setError((e as Error).message);setBusy(false);}}}>Версия отчёта для PDF</button>}
 {view==='bfo'&&profile.financial?.history.length&&profile.versions.length>0?<Panel title="Сверка с выписками">{profile.versions.map(v=><p key={v.id}><a href={'/dashboard?'+new URLSearchParams({analysisId:v.id,view:'banking'})}>Сверка X02/X03 · {v.start} — {v.end}</a></p>)}</Panel>:null}
 {view==='home'&&!profile.publicProfile&&<p className="pc-muted">Публичный паспорт можно дополнить через Checko. Банковские выписки загружаются независимо от его доступности.</p>}
 {(view==='home'||view==='analysis'||view==='documents')&&profile.versions.length>0&&<Panel title="Сохранённые банковские анализы">{profile.versions.map(v=><p key={v.id}><a href={'/dashboard?'+new URLSearchParams({analysisId:v.id,view:view==='documents'?'documents':'analysis'})}>{v.name} · {v.start} — {v.end}</a></p>)}</Panel>}

 {view==='bfo'&&period&&<Panel title="Финансовый профиль БФО"><label>Отчётный период <select value={period.id} onChange={e=>setYear(e.target.value)}>{years.map(p=><option value={p.id} key={p.id}>{p.period.from} — {p.period.to}</option>)}</select></label>
 <dl className="pc-source-kpis">{period.groups.flatMap(g=>g.metrics).filter(m=>['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','RECEIVABLES','PAYABLES','TOTAL_BORROWINGS','currentRatio'].includes(m.key)&&m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit).replace(/[\u00a0\u202f]/g,' ')}</dd><small>{m.periodFrom&&m.periodTo?m.periodFrom+' — '+m.periodTo:m.asOf??period.period.asOf}</small><details><summary>Основание</summary><p>{label(m.origin)} · {label(m.confidence)}</p>{periodSource?.documentId?<a href={'/api/documents?download='+encodeURIComponent(periodSource.documentId)}>{periodSource.name}</a>:<p>{periodSource?.name??labels[period.source]??'Бухгалтерская отчётность'}</p>}<Warnings items={m.warnings}/></details>{profile.financial?.trends.filter(t=>t.currentId===period.id&&t.absolute.key===m.key&&t.comparability.startsWith('COMPARABLE')&&t.absolute.value!==null).map(t=><small key={t.previousId}>Изменение · {numeric(t.absolute.value,t.absolute.status,t.absolute.unit)}</small>)}</div>)}</dl>
 <FinancialDynamics history={years}/><p><a href={dossierHref(company.id,'counterparties')}>Открыть расчёты с контрагентами</a></p><p>Сверка баланса · {period.quality.balanceReconciled===true?'сходится':period.quality.balanceReconciled===false?'есть расхождение':'недостаточно строк'}</p><Warnings items={period.quality.warnings}/>
 {period.groups.flatMap(g=>g.metrics).some(m=>['INVENTORIES','RECEIVABLES','PAYABLES','netWorkingCapital'].includes(m.key)&&m.value!==null)&&<section><h3>Оборотный капитал</h3><dl className="pc-definition">{period.groups.flatMap(g=>g.metrics).filter(m=>['INVENTORIES','RECEIVABLES','PAYABLES','netWorkingCapital'].includes(m.key)&&m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></section>}
 {profile.lines.filter(s=>s.id===period.id&&s.rows.length).map(s=><details key={s.id}><summary>Подробная отчётность Ф1/Ф2</summary><dl>{s.rows.map(v=><div key={v.code}><dt>Строка {v.code}</dt><dd>{v.raw.toLocaleString('ru-RU')} {v.scale===1000?'тыс. ₽':v.scale===1000000?'млн ₽':v.scale===1?'₽':'(единица не подтверждена)'}</dd></div>)}</dl></details>)}
 {period.groups.map(g=><details key={g.key}><summary>{g.title}</summary><dl>{g.metrics.filter(m=>m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></details>)}</Panel>}
 {(['expert','stop','recommendation','product','plan'] as const).map(stage=>{const items=relevantClaims.filter(c=>c.stage===stage);if(!items.length)return null;return <Panel key={stage} title={{expert:'Экспертные выводы',stop:'Подтверждённые стоп-факторы',recommendation:'Рекомендации',product:'Подходящие виды финансирования',plan:'План 7/30/60'}[stage]}>{items.map(c=><details key={c.id}><summary>{c.horizon&&({'DAY_7':'7 дней','DAY_30':'30 дней','DAY_60':'60 дней'}[c.horizon])} {c.title}</summary><p>{c.text}</p><p>{c.sources.map((s,i)=>(profile.sources.find(r=>r.id===c.sourceIds[i])?.name??labels[s.type]??'Источник')+' · '+(s.periods[0]?.from&&s.periods[0]?.to?s.periods[0].from+' — '+s.periods[0].to:s.date)).join(', ')}</p></details>)}</Panel>})}
 {view==='billing'&&<Panel title="Подписка компании"><p>Текущий доступ · {profile.entitlement}</p><p>{PLAN.name} · {(PLAN.amountMinor/100).toLocaleString('ru-RU')} ₽</p></Panel>}
 {view==='financing'&&<Panel title="Финансирование">{profile.versions.length?<a href={'/dashboard?'+new URLSearchParams({analysisId:profile.versions[0].id,view:'financing'})}>Открыть подбор и заявки по сохранённому анализу</a>:<p>Предложения появятся при подтверждённом соответствии условиям продукта.</p>}</Panel>}
 {view==='calendar'&&profile.entitlement!=='FULL'&&<Panel title="Платёжный календарь"><p>График обязательств, сроки расчётов и сценарии движения денег доступны в полном кабинете.</p><a href={dossierHref(company.id,'billing')}>Посмотреть условия доступа</a></Panel>}
 {view==='calendar'&&profile.schedule.length>0&&<Panel title="Даты по обязательствам">{profile.schedule.map(e=><p key={e.id}>{e.date} · {e.creditor} · {e.contract} · {e.amount==null?'Сумма не указана':numeric(e.amount,'KNOWN','RUB')}</p>)}</Panel>}
 {view==='calendar'&&profile.entitlement==='FULL'&&<CalendarEntries items={profile.calendar} save={async(entry,key)=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'calendar',id:company.id,entry,key})});setRevision(v=>v+1);}}/>}
   {reviewPanels}

 {view==='documents'&&!bankInn&&<DocumentsHub companyInn={company.inn} companyName={profile.publicProfile?.company.name??company.inn} analysisId="" dossierId={company.id} showHeading={false}/>}

 {view==='obligations'&&portfolioSource==='BKI'&&profile.bureauReports.map(report=><details key={report.id}><summary>{report.source} · {report.date} · {report.companyDebt?'Отчёт заёмщика':'Личный отчёт · вне долга компании'}</summary>{report.obligations.map((o,i)=><p key={i}>{o.creditor} · {o.product} · {o.status}{o.total!==null&&' · Общая задолженность '+o.total.toLocaleString('ru-RU')+' ₽'} · {o.reference}</p>)}</details>)}
 {view==='obligations'&&!bankInn&&<DossierPortfolio profile={profile} />}
 {(view==='counterparties'||view==='obligations'&&portfolioSource==='DEBT_LEDGER')&&<details><summary>Формат импорта ОСВ</summary><p>Одна строка на счёт, контрагента, договор и дату. Заголовки колонок: ИНН организации, Дата остатка, Счёт, Контрагент, Договор, Дебет, руб., Кредит, руб. Дата в формате ГГГГ-ММ-ДД. CSV с разделителем «точка с запятой» либо книга XLS/XLSX. Дополнительно: ИНН контрагента, Вид задолженности, Дата платежа по договору. Для основного долга укажите «Основной долг» и номер договора.</p></details>}
 {view==='obligations'&&portfolioSource==='DEBT_LEDGER'&&currentLedger.length>0&&<Panel title="Остатки по документам ОСВ"><div className="pc-table-scroll"><table><thead><tr>{['Счёт','Контрагент','Договор','Дата','Дебет, ₽','Кредит, ₽','Источник'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{currentLedger.map(l=><tr key={l.sourceId+':'+l.row}><td>{l.account}</td><td>{l.party}{l.partyInn&&<small>ИНН {l.partyInn}</small>}</td><td>{l.contract??'—'}{l.due&&<small>Платёж по договору · {l.due}</small>}</td><td>{l.asOf}</td><td>{l.debit??'—'}</td><td>{l.credit??'—'}</td><td>{profile.sources.find(s=>s.id===l.sourceId)?.name}, строка {l.row}</td></tr>)}</tbody></table></div></Panel>}
 {(view==='documents'||view==='home'||view==='bfo')&&profile.sources.length>0&&<Panel title="Источники досье">{profile.sources.map(s=><p key={s.id}>{s.documentId?<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>{s.name}</a>:s.name} · {labels[s.kind]??'Документ'} · {s.received.slice(0,10)}</p>)}</Panel>}
 </>}
 {visibleKinds.length>0&&<section className="pc-panel pc-source-intake"><h2>Добавить источник</h2>{visibleKinds.map(kind=>{
   const contract=['CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT'].includes(kind),bureau=kind==='BKI',scan=contract||bureau||kind==='BFO_REVIEW';
   const accept=kind==='ACCOUNT_51'?'.xlsx':contract?'.pdf,.docx,.png,.jpg,.jpeg':scan?'.pdf,.png,.jpg,.jpeg':kind.endsWith('LEDGER')||kind==='COUNTERPARTIES'?'.csv,.xls,.xlsx':'.pdf,.xls,.xlsx,.csv';
   return <form onSubmit={upload} key={kind} aria-label={labels[kind]}><input name="kind" type="hidden" value={kind}/>
     <label>{labels[kind]} <input aria-label={labels[kind]} name="file" required type="file" accept={accept}/></label>
     {bureau&&<label>Кому принадлежит отчёт <select name="relationship">{['Компания-заёмщик','ИП-заёмщик','Собственник','Руководитель','Поручитель'].map(r=><option key={r}>{r}</option>)}</select></label>}
     {scan&&<><ScanLayout/><small>{contract?'PDF, DOCX, JPG, PNG':'PDF, JPG, PNG'} · скан до 16 МБ</small></>}
     {bureau&&<label><input required type="checkbox"/> Подтверждаю право передать отчёт и согласие на обработку.</label>}
     <button disabled={busy}>Добавить документ</button>
   </form>;})}</section>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
