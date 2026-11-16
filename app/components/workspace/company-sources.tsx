'use client';
import {useRouter} from 'next/navigation';
import {useEffect,useState,useRef} from 'react';
import type {FormEvent} from 'react';
import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {PLAN} from '../../../lib/billing/domain';
import {SourceReview} from './source-review';
import {LiquidityCalendar} from './liquidity-calendar';
import {InvestmentProfile} from './investment-profile';
import {CalendarSheetReview} from './calendar-sheet-review';
import {CalendarEntries} from './calendar-entries';
import {FinancialDynamics} from './financial-dynamics';
import {label} from './credit-depth';
import {numeric,Warnings} from './client-financials';
import {Panel} from './client-insights';
import DocumentsHub from '../../dashboard/documents-hub';
import {ManualDebtForm} from './manual-debt-form';
import {DossierPortfolio} from './dossier-portfolio';
import './client-registers.css';
import {ReceivablesReview} from './receivables-review';
import {SettlementRegisters} from './settlement-registers';
import {Account51Comparison} from './account51-comparison';
import type {WorkspaceBasicV1} from '../../../lib/workspace/model';
import {CompanyPassport} from './client-passport';
import type {PassportPublicProfile} from '../../../lib/workspace/public-passport';

type Company={id:string;inn:string};
type PublicProfile=PassportPublicProfile;
type Profile=ReturnType<typeof sourceProjection>&{company:Company;versions:{id:string;name:string;start:string;end:string}[];publicProfile:PublicProfile|null;entitlement:string};
const labels:Record<string,string>={CALENDAR_SHEET:'График платежей · XLS, XLSX, CSV',ACCOUNT_51:'Карточка счёта 51 · XLS / XLSX',BFO:'Годовая бухгалтерская отчётность',QUARTERLY:'Промежуточная отчётность',BKI:'БКИ · НБКИ, ОКБ или СБ БКИ',COUNTERPARTIES:'ОСВ 60, 62 и 76',DEBT_LEDGER:'ОСВ 66, 67 и 76',CHECKO:'Публичные сведения',BANK_STATEMENT:'Банковская выписка',BANK_XLSX:'Банковская выписка СберБизнес XLSX · проверка',BANK_QUESTIONNAIRE:'Банковская анкета XLSX · предварительное извлечение',CALENDAR:'Календарь',CREDIT_DOCUMENT:'Кредитные договоры',COMMERCIAL_DOCUMENT:'Контракты и договоры контрагентов',BFO_REVIEW:'Проверка полей БФО PDF'};
const kinds:Record<string,string[]>={calendar:['CALENDAR_SHEET'],banking:['ACCOUNT_51','BANK_XLSX'],bfo:['BFO','QUARTERLY','BFO_REVIEW'],obligations:['BKI','DEBT_LEDGER','CREDIT_DOCUMENT'],counterparties:['COUNTERPARTIES','COMMERCIAL_DOCUMENT'],documents:['BANK_QUESTIONNAIRE','BANK_XLSX','ACCOUNT_51','BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER','BFO_REVIEW','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT']};
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
  const form=event.currentTarget,data=new FormData(form),targetId=id||company?.id;
  const submittedFrom=window.location.href;
  if(targetId)data.set('id',targetId);else if(inn.trim())data.set('inn',inn.trim());
  setBusy(true);setError('');setNotice('');
  try{
    const result=await read<{id:string;duplicate:boolean;dossierId:string;pending:boolean;layout?:string}>('/api/dossier',{method:'POST',body:data});
    if(targetId&&result.dossierId!==targetId)throw Error('Документ вернул ссылку на другое досье. Обновите страницу для проверки.');
    if(!mounted.current)return;
    if(view==='bfo'&&!result.pending)setYear(result.id);
    form.reset();setRevision(n=>n+1);
    if(result.pending){
      try{await recognize(result.dossierId,result.id,result.layout??String(data.get('layout')??'SINGLE'));}
      catch(e){if(company)throw e;sessionStorage.setItem('pc-ocr-notice:'+result.dossierId,String((e as Error).message));}
    }
    if(!mounted.current)return;
    if(!targetId){if(window.location.href===submittedFrom)location.assign(dossierHref(result.dossierId,view));return;}
    if(!result.pending)await onSourceChanged?.();
    setNotice(result.duplicate?'Этот документ уже учтён.':result.pending?'Документ сохранён. Проверьте распознанные поля.':'Документ сохранён.');
  }
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const selectedPeriodId=profile?.lines.find(line=>line.sourceId===selectedYear)?.id??selectedYear;
 const years=profile?.financial?.history??[],period=years.find(p=>p.id===selectedPeriodId)??years.at(-1);
 const periodSourceId=profile?.lines.find(s=>s.id===period?.id)?.sourceId;
 const periodSource=profile?.sources.find(s=>s.id===periodSourceId)??(period&&profile?.publicProfile&&[...profile.sources].reverse().find(s=>s.kind==='CHECKO'));
 const relevantClaims=profile?.claims.filter(c=>view==='home'||view==='analysis'||view==='actions'||view==='financing'&&c.stage==='product'||c.sources.some(s=>view==='bfo'?['BFO','QUARTERLY'].includes(s.type):view==='obligations'?s.type==='BKI'||profile.sources.some(r=>c.sourceIds.includes(r.id)&&r.kind==='CREDIT_DOCUMENT'):false))??[];
 const [portfolioSource,setPortfolioSource]=useState('BKI');
 const portfolioTabs=[['BKI','БКИ'],['CREDIT_DOCUMENT','Кредитные договоры'],['DEBT_LEDGER','ОСВ 66, 67 и 76']];
 const visibleKinds=view==='calendar'&&profile?.entitlement!=='FULL'?[]:view==='obligations'?[portfolioSource]:kinds[view]??[];
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
    <div className="pc-bfo-identity"><div><span>ФИНАНСОВЫЙ ПРОФИЛЬ</span><h2>{profile.publicProfile?.company.name||profile.versions[0]?.name||'Компания · ИНН '+company?.inn}</h2><p>ИНН {company?.inn}{profile.publicProfile?.company.region?' · '+profile.publicProfile.company.region:''}{profile.publicProfile?.company.status?' · '+profile.publicProfile.company.status:''}</p></div>
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

 const passport=view==='home'&&(company||preview)?<CompanyPassport dossier={company?{statementCompanyName:profile?.versions[0]?.name}:undefined} inn={company?.inn??inn} profile={company&&inn!==company.inn?(profile?.publicProfile??null):(preview??profile?.publicProfile??null)} hasStatements={(profile?.versions.length??0)>0} hasAnnual={!!profile?.financial?.history.some(p=>p.period.kind==='ANNUAL')} full={profile?.entitlement==='FULL'} onBankUpload={openBank}/>:null;
 return <div className="ws pc-company-sources" aria-label="Источники компании">
 {company&&passport}
 {(!company||view==='home')&&<Panel title={view==='home'?'Выбрать или добавить компанию':'Компания по ИНН'}>
  {companies.length>0&&<label>Компании в моём досье <select value={company?.id??''} onChange={e=>{if(e.target.value)location.assign(dossierHref(e.target.value,view))}}><option value="">Выберите компанию</option>{companies.map(c=><option key={c.id} value={c.id}>{c.inn}</option>)}</select></label>}
  <form onSubmit={e=>{e.preventDefault();void submit('save')}}><label>ИНН новой компании <input required inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" value={inn} disabled={busy} onChange={e=>{setInn(e.target.value.replace(/\D/g,'').slice(0,12));setPreview(null);setNotice('')}} placeholder="10 или 12 цифр"/></label>
  {view==='home'&&<button type="button" disabled={busy||!inn} onClick={()=>void submit('preview')}>Проверить Checko</button>}
  <button type="submit" disabled={busy||!inn}>+ Добавить компанию</button></form>
  {view==='home'&&company&&preview&&inn!==company.inn&&<div role="status" aria-label="Предварительная проверка новой компании">
    <strong>{preview.company.name}</strong><p>ИНН {inn}{preview.company.region?' · '+preview.company.region:''}{preview.company.status?' · '+preview.company.status:''}</p>
    <p>Чтобы сохранить эту компанию в досье, нажмите «Добавить компанию».</p>
  </div>}
  </Panel>}
  {view==='counterparties'&&<SettlementRegisters rows={profile?.settlements??[]} full={profile?.entitlement==='FULL'} save={async(entry,key,revision)=>{if(!company)throw Error('Выберите компанию.');await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'settlement',id:company.id,entry,key,revision})});setRevision(v=>v+1);}}/>}
  {view==='counterparties'&&company&&profile?.entitlement==='FULL'&&<ReceivablesReview rows={profile.settlements} checks={profile.counterpartyChecks} refresh={async inn=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'counterparty-check',id:company.id,inn})});setRevision(n=>n+1);}}/>}
  {profile&&company&&['home','banking','bfo','documents','obligations','counterparties'].includes(view)&&
   <Panel title="Покрытие периодов · дозагрузка и пересечения">
    <p>Новые документы дополняют досье. Совпадающие даты не означают одинаковые операции или суммы. Эта проверка не изменяет скоринг без сверки источников.</p>
    {profile.periodAudit.duplicates.length>0&&<details open><summary>Одинаковые файлы: {profile.periodAudit.duplicates.length} групп</summary>
     <p>Побайтово одинаковые документы обнаружены повторно. Они сохранены в истории досье, но не считаются двумя независимыми периодами. Само совпадение периода без совпадения файла проверяется отдельно.</p>
     {profile.periodAudit.duplicates.map((d,i)=><p key={i}>Повторный файл: {d.kinds.join(' / ')} · экземпляров: {d.sourceIds.length}. Не суммировать; сохранены исходные версии.</p>)}
    </details>}
    {profile.periodAudit.groups.filter(g=>g.gaps.length||g.overlaps.length).map(g=>
     <details key={g.id} open={g.gaps.length>0}>
      <summary>{g.kind} · {g.scope} · пробелов: {g.gaps.length}, пересечений: {g.overlaps.length}</summary>
      <p>{g.note}</p>
      {g.gaps.map((gap,i)=><p key={'gap'+i}>{gap.action} Не покрыто {gap.days} календарных дней.</p>)}
      {g.overlaps.map((o,i)=><p key={'overlap'+i}>Пересечение {o.from} — {o.to}: {o.kind==='SAME_DATE'?'совпадает дата снимков':o.kind==='SAME_PERIOD'?'один отчётный период':'частично совпадают периоды'}. Не складывать без проверки первичных данных.</p>)}
      {g.gaps.length>0&&(g.kind==='BANK_STATEMENT'
        ?<button type="button" disabled={busy} onClick={openBank}>Дозагрузить выписку для этого периода</button>
        :<a href={dossierHref(company.id,g.kind==='BFO'||g.kind==='QUARTERLY'?'bfo':g.kind==='ACCOUNT_51'||g.kind==='BANK_XLSX_PREVIEW'?'banking':'documents')}>Открыть загрузку недостающего документа</a>)}
     </details>)}
    {!profile.periodAudit.requiresRecalculationReview&&<p>Во внутренних интервалах с подтверждёнными датами пробелов или пересечений не найдено. Полнота за пределами загруженного диапазона не подтверждена.</p>}
    {profile.periodAudit.unknown.length>0&&<p>Для {profile.periodAudit.unknown.length} документов период пока не установлен или непрерывное покрытие к ним неприменимо.</p>}
    <p>БКИ и ОСВ — снимки по датам. Договоры и анкеты — отдельные документы. Предварительный банковский XLSX пока не участвует в B-Score.</p>
   </Panel>}
  {view==='banking'&&<Account51Comparison cards={profile?.cards51??[]} bank={bank}/>}
  {view==='banking'&&profile?.bankXlsxReviews.map(p=><Panel key={p.id} title={'XLSX: '+p.name}><p>Предварительно извлечено операций: {p.totalOperations}. Счетов: {p.accounts}. Этот файл пока не участвует в B-Score.</p><p>Требуется проверка ИНН владельца, периодов и банковских остатков.</p></Panel>)}
  {view==='documents'&&profile?.questionnaireReviews.map(p=><Panel key={p.id} title={'Анкета: '+p.name}><p>Предварительные сведения по компании. Поля не заполняют анкеты автоматически; паспортные и персональные данные не извлекаются.</p>{p.sheets.map(s=><details key={s.name}><summary>{s.name} · кандидатов: {s.fields.length}</summary><dl>{s.fields.map((f,i)=><div key={f.key+':'+i}><dt>{f.key} · строка {f.row}</dt><dd>{f.raw}</dd></div>)}</dl></details>)}</Panel>)}
  {!company&&passport}
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
 {view==='calendar'&&profile.entitlement==='FULL'&&<><LiquidityCalendar profile={profile} bank={bank}/>{profile.sheets.map(sheet=><CalendarSheetReview key={sheet.id} sheet={sheet} confirm={async(mapping,rows)=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm-sheet',id:company.id,sourceId:sheet.id,mapping,rows})});setRevision(v=>v+1);}}/>)}</>}
 {view==='analysis'&&profile.entitlement==='FULL'&&<InvestmentProfile/>}
 {view==='calendar'&&profile.entitlement==='FULL'&&<CalendarEntries items={profile.calendar} save={async(entry,key)=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'calendar',id:company.id,entry,key})});setRevision(v=>v+1);}}/>}
   {reviewPanels}

 {view==='documents'&&!bankInn&&<DocumentsHub companyInn={company.inn} companyName={profile.publicProfile?.company.name??company.inn} analysisId="" dossierId={company.id} showHeading={false}/>}

 {view==='obligations'&&portfolioSource==='BKI'&&profile.bureauReports.map(report=><details key={report.id}><summary>{report.source} · {report.date} · {report.companyDebt?'Отчёт заёмщика':'Личный отчёт · вне долга компании'}</summary>{report.obligations.map((o,i)=><p key={i}>{o.creditor} · {o.product} · {o.status}{o.total!==null&&' · Общая задолженность '+o.total.toLocaleString('ru-RU')+' ₽'} · {o.reference}</p>)}</details>)}
 {view==='obligations'&&!bankInn&&<DossierPortfolio profile={profile} />}
 {view==='obligations'&&profile.entitlement==='FULL'&&<ManualDebtForm save={async entry=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'manual-debt',id:company.id,entry,confirmed:true})});setRevision(n=>n+1);await onSourceChanged?.();}}/>}
 {(view==='counterparties'||view==='obligations'&&portfolioSource==='DEBT_LEDGER')&&<details><summary>Формат импорта ОСВ</summary><p>Одна строка на счёт, контрагента, договор и дату. Заголовки колонок: ИНН организации, Дата остатка, Счёт, Контрагент, Договор, Дебет, руб., Кредит, руб. Дата в формате ГГГГ-ММ-ДД. CSV с разделителем «точка с запятой» либо книга XLS/XLSX. Дополнительно: ИНН контрагента, Вид задолженности, Дата платежа по договору. Для основного долга укажите «Основной долг» и номер договора.</p></details>}
 {view==='obligations'&&portfolioSource==='DEBT_LEDGER'&&currentLedger.length>0&&<Panel title="Остатки по документам ОСВ"><div className="pc-table-scroll"><table><thead><tr>{['Счёт','Контрагент','Договор','Дата','Дебет, ₽','Кредит, ₽','Источник'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{currentLedger.map(l=><tr key={l.sourceId+':'+l.row}><td>{l.account}</td><td>{l.party}{l.partyInn&&<small>ИНН {l.partyInn}</small>}</td><td>{l.contract??'—'}{l.due&&<small>Платёж по договору · {l.due}</small>}</td><td>{l.asOf}</td><td>{l.debit??'—'}</td><td>{l.credit??'—'}</td><td>{profile.sources.find(s=>s.id===l.sourceId)?.name}, строка {l.row}</td></tr>)}</tbody></table></div></Panel>}
 {(view==='documents'||view==='home'||view==='bfo')&&profile.sources.length>0&&<Panel title="Источники досье">{profile.sources.map(s=><p key={s.id}>{s.documentId?<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>{s.name}</a>:s.name} · {labels[s.kind]??'Документ'} · {s.received.slice(0,10)}</p>)}</Panel>}
 </>}
 {visibleKinds.length>0&&<section className="pc-panel pc-source-intake"><h2>Добавить источник</h2><p>Банковский XLSX и анкета сохраняются только как предварительный разбор — без автоматического изменения скоринга или заполнения персональных данных.</p>{visibleKinds.map(kind=>{
   const contract=['CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT'].includes(kind),bureau=kind==='BKI',scan=contract||bureau||kind==='BFO_REVIEW';
   const accept=['BANK_XLSX','BANK_QUESTIONNAIRE'].includes(kind)?'.xlsx':kind==='CALENDAR_SHEET'?'.xls,.xlsx,.csv':kind==='ACCOUNT_51'?'.xls,.xlsx':contract?'.pdf,.docx,.png,.jpg,.jpeg':scan?'.pdf,.png,.jpg,.jpeg':kind.endsWith('LEDGER')||kind==='COUNTERPARTIES'?'.csv,.xls,.xlsx':'.pdf,.xls,.xlsx,.csv';
   return <form onSubmit={upload} key={kind} aria-label={labels[kind]}><input name="kind" type="hidden" value={kind}/>
     <label>{labels[kind]} <input aria-label={labels[kind]} name="file" required type="file" accept={accept}/></label>
     {(kind==='COUNTERPARTIES'||kind==='DEBT_LEDGER'||kind==='BANK_QUESTIONNAIRE')&&<label><input type="checkbox" name="identityConfirmed" value="yes"/> Подтверждаю компанию/период ОСВ или право передать анкету для обработки</label>}
     {bureau&&<label>Кому принадлежит отчёт <select name="relationship">{['Компания-заёмщик','ИП-заёмщик','Собственник','Руководитель','Поручитель'].map(r=><option key={r}>{r}</option>)}</select></label>}
     {scan&&<><ScanLayout/><small>{contract?'PDF, DOCX, JPG, PNG':'PDF, JPG, PNG'} · скан до 16 МБ</small></>}
     {bureau&&<label><input required type="checkbox"/> Подтверждаю право передать отчёт и согласие на обработку.</label>}
     <button disabled={busy}>Добавить документ</button>
   </form>;})}</section>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
