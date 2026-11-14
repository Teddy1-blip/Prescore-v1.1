'use client';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {PLAN} from '../../../lib/billing/domain';
import {SourceReview} from './source-review';
import {CalendarEntries} from './calendar-entries';
import DocumentOcrPreview from '../../dashboard/document-ocr-preview';
import {FinancialDynamics} from './financial-dynamics';
import {label} from './credit-depth';
import {numeric,Warnings} from './client-financials';
import {Panel} from './client-insights';

type Company={id:string;inn:string};
type PublicProfile={company:{name:string;status?:string;region?:string};fetchedAt:string;publicRisks?:{enforcementDetected:boolean|null;legalEventsDetected:boolean|null};contracts?:{totalCount:number|null};legal?:{legalCases:number|null;enforcements:number|null};externalFacts?:{cases:{reference:string|null;title:string|null;date:string|null;receiptId:string}[];enforcements:{reference:string|null;title:string|null;date:string|null;receiptId:string}[];procurement:{items:{number:string;law:string;subject:string|null;amount:number|null;signedAt:string|null}[]}}};
type Profile=ReturnType<typeof sourceProjection>&{company:Company;versions:{id:string;name:string;start:string;end:string}[];publicProfile:PublicProfile|null;entitlement:string};
const labels:Record<string,string>={BFO:'Годовая бухгалтерская отчётность',QUARTERLY:'Промежуточная отчётность',BKI:'Корпоративный отчёт БКИ',COUNTERPARTIES:'ОСВ 60, 62 и 76',DEBT_LEDGER:'ОСВ 66 и 67',CHECKO:'Публичные сведения',BANK_STATEMENT:'Банковская выписка',CALENDAR:'Календарь',CREDIT_DOCUMENT:'Кредитный договор PDF или DOCX',COMMERCIAL_DOCUMENT:'Торговый договор PDF или DOCX',BFO_REVIEW:'Проверка полей БФО PDF'};
const kinds:Record<string,string[]>={bfo:['BFO','QUARTERLY','BFO_REVIEW'],obligations:['BKI','DEBT_LEDGER','CREDIT_DOCUMENT'],counterparties:['COUNTERPARTIES','COMMERCIAL_DOCUMENT'],documents:['BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER','BFO_REVIEW','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT']};
const dossierHref=(id:string,view:string)=>'/dashboard?'+new URLSearchParams({dossierId:id,view});
async function read<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...options}),body=await response.json();
 if(!response.ok)throw Error(body.error??'Не удалось открыть досье.');
 return body;
}
function PublicFacts({profile}:{profile:PublicProfile}){
 return <section><h3>{profile.company.name}</h3><p>{[profile.company.status,profile.company.region].filter(Boolean).join(' · ')}</p><dl>
 {([['Судебные события',profile.legal?.legalCases??profile.publicRisks?.legalEventsDetected],['Исполнительные производства',profile.legal?.enforcements??profile.publicRisks?.enforcementDetected],['Контракты',profile.contracts?.totalCount]] as const).map(([label,value])=>value!=null&&<div key={label}><dt>{label}</dt><dd>{typeof value==='boolean'?(value?'Есть записи':'Записи не найдены'):value}</dd></div>)}</dl><small>Checko · {profile.fetchedAt.slice(0,10)}</small>
 {profile.externalFacts&&<>{([['Судебные дела',profile.externalFacts.cases],['Исполнительные производства',profile.externalFacts.enforcements]] as const).map(([title,rows])=>rows.length>0&&<details key={title}><summary>{title}</summary>{rows.map((r,i)=><p key={r.receiptId+i}>{[r.date,r.reference,r.title].filter(Boolean).join(' · ')}</p>)}</details>)}
 {profile.externalFacts.procurement.items.length>0&&<details><summary>Государственные контракты</summary>{profile.externalFacts.procurement.items.map(r=><p key={r.law+r.number}>{[r.law,r.number,r.signedAt,r.subject,r.amount==null?null:numeric(r.amount,'KNOWN','RUB')].filter(Boolean).join(' · ')}</p>)}</details>}</>}
 </section>;
}
export function CompanySources({view,id,bankInn,openBank,onCompany}:{view:string;id:string;bankInn?:string;openBank:()=>void;onCompany:(inn:string)=>void}){
 const router=useRouter();
 const [inn,setInn]=useState(bankInn??''),[companies,setCompanies]=useState<Company[]>([]),[profile,setProfile]=useState<Profile|null>(null),[preview,setPreview]=useState<PublicProfile|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[selectedYear,setYear]=useState('');
 useEffect(()=>{const ctrl=new AbortController();(async()=>{
   const list=await read<{companies:Company[]}>('/api/dossier',{signal:ctrl.signal});setCompanies(list.companies);
   const matched=id||list.companies.find(c=>c.inn===bankInn)?.id;
   if(matched){const current=await read<Profile>('/api/dossier?id='+encodeURIComponent(matched),{signal:ctrl.signal});if(!ctrl.signal.aborted){setProfile(current);onCompany(current.company.inn);}}
 })().catch(e=>{if(!ctrl.signal.aborted)setError(e.message)});return()=>ctrl.abort();},[id,bankInn,revision,onCompany]);
 const company=profile?.company;
 async function submit(action:'preview'|'save'){
  setBusy(true);setError('');setNotice('');
  try{
    const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,inn,attachPublic:!!preview})};
    if(action==='preview'){
      const result=await read<{profile:PublicProfile|null;status:string}>('/api/dossier',options);setPreview(result.profile);
      if(!result.profile)setNotice(({NOT_CONFIGURED:'Checko не настроен.',RETRY_LATER:'Повторите запрос позже.',FAILED:'Checko не вернул данные.'} as Record<string,string>)[result.status]??'Публичные сведения пока недоступны.');
    } else {const result=await read<{company:Company}>('/api/dossier',options);location.assign(dossierHref(result.company.id,view));}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=event.currentTarget,data=new FormData(form);if(company)data.set('id',company.id);
  setBusy(true);setError('');setNotice('');
  try{const result=await read<{duplicate:boolean;dossierId:string}>('/api/dossier',{method:'POST',body:data});if(!company){location.assign(dossierHref(result.dossierId,view));return;}setNotice(result.duplicate?'Этот документ уже учтён.':view==='bfo'?'Отчётность сохранена. Если документ требует OCR, ниже появится проверка полей.':'Документ сохранён.');form.reset();setRevision(n=>n+1);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const years=profile?.financial?.history??[],period=years.find(p=>p.id===selectedYear)??years.at(-1);
 const periodSourceId=profile?.lines.find(s=>s.id===period?.id)?.sourceId;
 const periodSource=profile?.sources.find(s=>s.id===periodSourceId);
 const relevantClaims=profile?.claims.filter(c=>view==='home'||view==='analysis'||view==='actions'||view==='financing'&&c.stage==='product'||c.sources.some(s=>view==='bfo'?['BFO','QUARTERLY'].includes(s.type):view==='obligations'?s.type==='BKI'||profile.sources.some(r=>c.sourceIds.includes(r.id)&&r.kind==='CREDIT_DOCUMENT'):false))??[];
 const [side,setSide]=useState<'buyers'|'suppliers'|'all'>('all');
 const currentLedger=profile?.ledger.filter(l=>l.kind===(view==='obligations'?'DEBT_LEDGER':'COUNTERPARTIES')&&(view!=='counterparties'||side==='all'||(side==='buyers'?l.account.startsWith('62'):l.account.startsWith('60'))))??[];

 const bfoClaims=profile?.claims.filter(c=>c.sources.some(s=>['BFO','QUARTERLY','CHECKO'].includes(s.type)))??[];
 if(view==='bfo'){
  const metrics=period?.groups.flatMap(g=>g.metrics)??[];
  const keys=['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','RECEIVABLES','PAYABLES','TOTAL_BORROWINGS','currentRatio'];
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
    let found:PublicProfile|null=null;
    let checkoMessage='';
    try{
     const result=await read<{profile:PublicProfile|null;status:string}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',inn})});
     found=result.profile;
     if(!found)checkoMessage='Данные Checko сейчас недоступны; компания будет сохранена без вымышленных показателей.';
    }catch{checkoMessage='Checko не ответил. Компания будет сохранена без внешних показателей.';}
    const result=await read<{company:Company}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',inn,attachPublic:!!found})});
    if(checkoMessage)setNotice(checkoMessage);
    location.assign(dossierHref(result.company.id,'bfo'));
   }catch(e){setError((e as Error).message);}
   finally{setBusy(false);}
  }
  const selectedReview=profile?.reviews.filter(r=>profile.sources.some(s=>s.id===r.id&&s.kind==='BFO_REVIEW'))??[];
  return <div className="ws pc-company-sources pc-bfo" aria-label="Финансовый профиль БФО">
   <div className="pc-bfo-intro"><span>ФИНАНСОВАЯ АНАЛИТИКА PRESCORE</span><h2>Бухгалтерская отчётность</h2><p>Финансовые показатели, динамика и выводы по подтверждённым источникам. Начните с ИНН или загрузите отчётность.</p></div>
   <div className="pc-bfo-start">
    <section className="pc-bfo-input">
     <h3>Найти компанию по ИНН</h3><p>Проверим доступные сведения через Checko и откроем финансовый профиль.</p>
     <form onSubmit={e=>{e.preventDefault();void lookup()}}>
      <label htmlFor="bfo-company-inn">ИНН компании</label>
      <div className="pc-bfo-inline"><input id="bfo-company-inn" required inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" value={inn} onChange={e=>setInn(e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="10 или 12 цифр" disabled={busy}/><button type="submit" disabled={busy}>Получить данные</button></div>
     </form>
     {companies.length>0&&<label className="pc-bfo-existing">Мои компании <select value={company?.id??''} onChange={e=>{if(e.target.value)location.assign(dossierHref(e.target.value,'bfo'))}}><option value="">Выберите компанию</option>{companies.map(c=><option key={c.id} value={c.id}>{c.inn}</option>)}</select></label>}
    </section>
    <section className="pc-bfo-input">
     <h3>Загрузить баланс и Ф2</h3><p>Годовую или промежуточную отчётность — одним способом. Период определяет существующий парсер.</p>
     <form onSubmit={upload}>
      <input type="hidden" name="kind" value="AUTO_BFO"/>
      <label htmlFor="bfo-upload-file">Файл отчётности (PDF, Excel, CSV)</label>
      <input id="bfo-upload-file" type="file" name="file" accept=".pdf,.xls,.xlsx,.csv" required disabled={busy}/>
      <button type="submit" disabled={busy}>Загрузить и проанализировать</button>
     </form>
    </section>
   </div>
   {profile&&<section className="pc-bfo-dashboard" aria-label="Дашборд бухгалтерской отчётности">
    <div className="pc-bfo-identity"><div><span>ФИНАНСОВЫЙ ПРОФИЛЬ</span><h2>{profile.publicProfile?.company.name||'Компания · ИНН '+company?.inn}</h2><p>ИНН {company?.inn}{profile.publicProfile?.company.region?' · '+profile.publicProfile.company.region:''}{profile.publicProfile?.company.status?' · '+profile.publicProfile.company.status:''}</p></div>
     {company&&(period||profile.publicProfile)&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const report=await read<{snapshot:string}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'issue-report',id:company.id})});router.push('/dashboard/report-v2?'+new URLSearchParams({dossierId:company.id,snapshotId:report.snapshot,print:'1'}));}catch(e){setError((e as Error).message);setBusy(false);}}}>Отчёт PDF</button>}
    </div>
    {period&&<div className="pc-bfo-period"><label htmlFor="bfo-reporting-period">Отчётный период</label><select id="bfo-reporting-period" value={period.id} onChange={e=>setYear(e.target.value)}>{years.map(p=><option key={p.id} value={p.id}>{p.period.from||'Дата не указана'} — {p.period.to||p.period.asOf||'Дата не указана'}</option>)}</select><span>{period.source==='BFO'?'Годовая отчётность':'Промежуточная отчётность'}</span></div>}
    {period?<><div className="pc-bfo-kpis">{kpis.map(m=><article key={m.key} className="pc-bfo-kpi"><h3>{m.label}</h3><strong>{numeric(m.value,m.status,m.unit).replace(/[\u00a0\u202f]/g,' ')}</strong><span>{m.periodFrom&&m.periodTo?m.periodFrom+' — '+m.periodTo:m.asOf??period.period.asOf}</span><small>{label(m.origin)} · {label(m.confidence)}</small></article>)}</div>
     <div className="pc-bfo-charts"><FinancialDynamics history={years}/></div>
     <div className="pc-bfo-balance"><h3>Контроль отчётности</h3><p>{period.quality.balanceReconciled===true?'Баланс сходится: активы согласованы с капиталом и обязательствами.':period.quality.balanceReconciled===false?'Обнаружено расхождение баланса. Проверьте строки и единицы измерения.':'Сверка баланса требует дополнительных подтверждённых строк.'}</p>{periodSource&&<small>Источник: {periodSource.name}</small>}</div>
     <details className="pc-bfo-detail"><summary>Все финансовые коэффициенты и строки Ф1 / Ф2</summary>{period.groups.map(g=><section key={g.key}><h3>{g.title}</h3><dl>{g.metrics.filter(m=>m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></section>)}</details>
    </>:<div className="pc-bfo-no-finances"><h3>Компания добавлена в финансовый профиль</h3><p>{profile.publicProfile?'Данные Checko доступны в пределах текущего тарифа. Загрузите БФО, чтобы получить показатели и динамику в этом разделе.':'Загрузите БФО либо получите доступные сведения Checko по ИНН. Финансовые цифры без источников не создаются.'}</p></div>}
   </section>}
   {profile&&<section className="pc-bfo-insights" aria-label="Экспертные выводы по БФО"><header><h2>Экспертность и следующие действия</h2><p>Все выводы видны сразу. Содержание зависит от подтверждённых данных компании.</p></header><div className="pc-bfo-insight-grid">{stages.map((stage,i)=>{const items=bfoClaims.filter(c=>c.stage===stage.key);const balanceText=stage.key==='expert'&&period?(period.quality.balanceReconciled===true?'БФО: баланс сходится':period.quality.balanceReconciled===false?'БФО: баланс требует сверки':'БФО: сверка баланса не подтверждена'):null;return <article className="pc-bfo-insight" key={stage.key}><span>{i+1} / 5</span><h3>{stage.title}</h3>{balanceText&&<p className="pc-bfo-main-fact">{balanceText}</p>}{items.length>0?<ul>{items.map(c=><li key={c.id}><strong>{c.horizon?({'DAY_7':'7 дней','DAY_30':'30 дней','DAY_60':'60 дней'}[c.horizon])+' · ':''}{c.title}</strong><p>{c.text}</p>{c.sources.length>0&&<small>Основание: {c.sources.map(s=>s.type+' · '+s.date).join('; ')}</small>}</li>)}</ul>:!balanceText&&<p>{stage.empty}</p>}</article>})}</div></section>}
   {selectedReview.map(review=><SourceReview key={review.id} review={review} recognize={async(layout)=>{if(!company)return;await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recognize',id:company.id,sourceId:review.id,layout})});setRevision(v=>v+1);}} save={async(field,value)=>{if(!company)return;await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify-field',id:company.id,sourceId:review.id,field,value,previous:review.verified[field]})});setRevision(v=>v+1);}}/>)}
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </div>;
 }

 return <div className="ws pc-company-sources" aria-label="Источники компании">
 {(!company||view==='home')&&<Panel title="Компания по ИНН">
 {companies.length>0&&<label>Мои досье <select value={company?.id??''} onChange={e=>{if(e.target.value)location.assign(dossierHref(e.target.value,view))}}><option value="">Выберите компанию</option>{companies.map(c=><option key={c.id} value={c.id}>{c.inn}</option>)}</select></label>}
 <form onSubmit={e=>{e.preventDefault();void submit(view==='home'?'preview':'save')}}><label>ИНН компании <input required inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" value={inn} disabled={busy} onChange={e=>{setInn(e.target.value);setPreview(null);setNotice('')}}/></label>{view==='home'&&<button type="submit" disabled={busy}>Проверить ИНН</button>} <button type="button" disabled={busy||!inn} onClick={()=>void submit('save')}>Сохранить компанию в досье</button></form>
 {preview&&<PublicFacts profile={preview}/>}
 </Panel>}
 {company&&<><p>Досье компании · ИНН {company.inn}</p>
 {['home','bfo','analysis','documents'].includes(view)&&(profile.financial||profile.obligations.length>0||profile.publicProfile)&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const report=await read<{snapshot:string}>('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'issue-report',id:company.id})});router.push('/dashboard/report-v2?'+new URLSearchParams({dossierId:company.id,snapshotId:report.snapshot,print:'1'}));}catch(e){setError((e as Error).message);setBusy(false);}}}>Версия отчёта для PDF</button>}
 {view==='bfo'&&profile.financial?.history.length&&profile.versions.length>0?<Panel title="Сверка с выписками">{profile.versions.map(v=><p key={v.id}><a href={'/dashboard?'+new URLSearchParams({analysisId:v.id,view:'banking'})}>Сверка X02/X03 · {v.start} — {v.end}</a></p>)}</Panel>:null}
 {view==='home'&&<>{profile.publicProfile&&<PublicFacts profile={profile.publicProfile}/>}<button onClick={openBank}>Загрузить банковскую выписку</button></>}
 {(view==='home'||view==='analysis'||view==='documents')&&profile.versions.length>0&&<Panel title="Сохранённые банковские анализы">{profile.versions.map(v=><p key={v.id}><a href={'/dashboard?'+new URLSearchParams({analysisId:v.id,view:view==='documents'?'documents':'analysis'})}>{v.name} · {v.start} — {v.end}</a></p>)}</Panel>}

 {(view==='bfo'||view==='home')&&period&&<Panel title="Финансовый профиль БФО"><label>Отчётный период <select value={period.id} onChange={e=>setYear(e.target.value)}>{years.map(p=><option value={p.id} key={p.id}>{p.period.from} — {p.period.to}</option>)}</select></label>
 <dl className="pc-source-kpis">{period.groups.flatMap(g=>g.metrics).filter(m=>['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','RECEIVABLES','PAYABLES','TOTAL_BORROWINGS','currentRatio'].includes(m.key)&&m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit).replace(/[\u00a0\u202f]/g,' ')}</dd><small>{m.periodFrom&&m.periodTo?m.periodFrom+' — '+m.periodTo:m.asOf??period.period.asOf}</small><details><summary>Основание</summary><p>{label(m.origin)} · {label(m.confidence)}</p>{periodSource?.documentId?<a href={'/api/documents?download='+encodeURIComponent(periodSource.documentId)}>{periodSource.name}</a>:<p>{periodSource?.name??labels[period.source]??'Бухгалтерская отчётность'}</p>}<Warnings items={m.warnings}/></details>{profile.financial?.trends.filter(t=>t.currentId===period.id&&t.absolute.key===m.key&&t.comparability.startsWith('COMPARABLE')&&t.absolute.value!==null).map(t=><small key={t.previousId}>Изменение · {numeric(t.absolute.value,t.absolute.status,t.absolute.unit)}</small>)}</div>)}</dl>
 <FinancialDynamics history={years}/><p><a href={dossierHref(company.id,'counterparties')}>Открыть расчёты с контрагентами</a></p><p>Сверка баланса · {period.quality.balanceReconciled===true?'сходится':period.quality.balanceReconciled===false?'есть расхождение':'недостаточно строк'}</p><Warnings items={period.quality.warnings}/>
 {period.groups.flatMap(g=>g.metrics).some(m=>['INVENTORIES','RECEIVABLES','PAYABLES','netWorkingCapital'].includes(m.key)&&m.value!==null)&&<section><h3>Оборотный капитал</h3><dl className="pc-definition">{period.groups.flatMap(g=>g.metrics).filter(m=>['INVENTORIES','RECEIVABLES','PAYABLES','netWorkingCapital'].includes(m.key)&&m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></section>}
 {profile.lines.filter(s=>s.id===period.id&&s.rows.length).map(s=><details key={s.id}><summary>Подробная отчётность Ф1/Ф2</summary><dl>{s.rows.map(v=><div key={v.code}><dt>Строка {v.code}</dt><dd>{v.raw.toLocaleString('ru-RU')} {v.scale===1000?'тыс. ₽':v.scale===1000000?'млн ₽':v.scale===1?'₽':'(единица не подтверждена)'}</dd></div>)}</dl></details>)}
 {period.groups.map(g=><details key={g.key}><summary>{g.title}</summary><dl>{g.metrics.filter(m=>m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></details>)}</Panel>}
 {(['expert','stop','recommendation','product','plan'] as const).map(stage=>{const items=relevantClaims.filter(c=>c.stage===stage);if(!items.length)return null;return <Panel key={stage} title={{expert:'Экспертные выводы',stop:'Подтверждённые стоп-факторы',recommendation:'Рекомендации',product:'Подходящие виды финансирования',plan:'План 7/30/60'}[stage]}>{items.map(c=><details key={c.id}><summary>{c.horizon&&({'DAY_7':'7 дней','DAY_30':'30 дней','DAY_60':'60 дней'}[c.horizon])} {c.title}</summary><p>{c.text}</p><p>{c.sources.map((s,i)=>(profile.sources.find(r=>r.id===c.sourceIds[i])?.name??labels[s.type]??'Источник')+' · '+(s.periods[0]?.from&&s.periods[0]?.to?s.periods[0].from+' — '+s.periods[0].to:s.date)).join(', ')}</p></details>)}</Panel>})}
 {view==='billing'&&<Panel title="Подписка компании"><p>Текущий доступ · {profile.entitlement}</p><p>{PLAN.name} · {(PLAN.amountMinor/100).toLocaleString('ru-RU')} ₽</p></Panel>}
 {view==='financing'&&<Panel title="Финансирование">{profile.versions.length?<a href={'/dashboard?'+new URLSearchParams({analysisId:profile.versions[0].id,view:'financing'})}>Открыть подбор и заявки по сохранённому анализу</a>:<p>Предложения появятся при подтверждённом соответствии условиям продукта.</p>}</Panel>}
 {view==='calendar'&&profile.schedule.length>0&&<Panel title="Даты по обязательствам">{profile.schedule.map(e=><p key={e.id}>{e.date} · {e.creditor} · {e.contract} · {e.amount==null?'Сумма не указана':numeric(e.amount,'KNOWN','RUB')}</p>)}</Panel>}
 {view==='calendar'&&<CalendarEntries items={profile.calendar} save={async(entry,key)=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'calendar',id:company.id,entry,key})});setRevision(v=>v+1);}}/>}
 {profile.reviews.filter(review=>view==='documents'||kinds[view]?.includes(profile.sources.find(s=>s.id===review.id)?.kind??'')).map(review=><SourceReview key={review.id} review={review} recognize={async(layout)=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recognize',id:company.id,sourceId:review.id,layout})});setRevision(v=>v+1);}} save={async(field,value)=>{await read('/api/dossier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify-field',id:company.id,sourceId:review.id,field,value,previous:review.verified[field]})});setRevision(v=>v+1);}}/>)}

 {view==='documents'&&profile.sources.some(s=>s.documentId&&/\.pdf$/i.test(s.name))&&<DocumentOcrPreview documents={profile.sources.flatMap(s=>s.documentId&&/\.pdf$/i.test(s.name)?[{id:s.documentId,fileName:s.name,category:labels[s.kind]??s.kind}]:[])}/>}
 {view==='obligations'&&profile.obligations.length>0&&<Panel title="Подтверждённые обязательства"><p>Данные на {profile.portfolioAsOf}</p>{profile.obligations.map(o=><p key={o.id}>{o.creditor} · {o.contract??'Номер договора не указан'} · {o.principal==null?'Остаток не указан':numeric(o.principal,'KNOWN','RUB')} · {o.maturity??'Срок не указан'}{o.limit!==null&&' · Лимит '+numeric(o.limit,'KNOWN','RUB')}{o.original!==null&&' · Сумма договора '+numeric(o.original,'KNOWN','RUB')}{o.rate!==null&&' · Ставка '+o.rate+'%'}</p>)}</Panel>}
 {['counterparties','obligations'].includes(view)&&<details><summary>Формат импорта ОСВ</summary><p>Одна строка на счёт, контрагента, договор и дату. Заголовки колонок: ИНН организации, Дата остатка, Счёт, Контрагент, Договор, Дебет, руб., Кредит, руб. Дата в формате ГГГГ-ММ-ДД. CSV с разделителем «точка с запятой» либо книга XLS/XLSX. Дополнительно: ИНН контрагента, Вид задолженности, Дата платежа по договору. Для основного долга укажите «Основной долг» и номер договора.</p></details>}
 {view==='counterparties'&&profile.ledger.length>0&&<div role="group" aria-label="Сторона расчётов">{([['all','Все счета'],['buyers','Покупатели'],['suppliers','Поставщики']] as const).map(([key,title])=><button key={key} onClick={()=>setSide(key)} aria-pressed={side===key}>{title}</button>)}</div>}
 {currentLedger.length>0&&<Panel title="Остатки по документам ОСВ"><div className="pc-table-scroll"><table><thead><tr>{['Счёт','Контрагент','Договор','Дата','Дебет, ₽','Кредит, ₽','Источник'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{currentLedger.map(l=><tr key={l.sourceId+':'+l.row}><td>{l.account}</td><td>{l.party}{l.partyInn&&<small>ИНН {l.partyInn}</small>}</td><td>{l.contract??'—'}{l.due&&<small>Платёж по договору · {l.due}</small>}</td><td>{l.asOf}</td><td>{l.debit??'—'}</td><td>{l.credit??'—'}</td><td>{profile.sources.find(s=>s.id===l.sourceId)?.name}, строка {l.row}</td></tr>)}</tbody></table></div></Panel>}
 {(view==='documents'||view==='home'||view==='bfo')&&profile.sources.length>0&&<Panel title="Источники досье">{profile.sources.map(s=><p key={s.id}>{s.documentId?<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>{s.name}</a>:s.name} · {labels[s.kind]??'Документ'} · {s.received.slice(0,10)}</p>)}</Panel>}
 </>}
 {(kinds[view]??[]).length>0&&<section className="pc-panel pc-source-intake"><h2>Добавить источник</h2>{(kinds[view]??[]).filter(kind=>company||!['BFO_REVIEW','CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT'].includes(kind)).map(kind=><form onSubmit={upload} key={kind}><input name="kind" type="hidden" value={kind}/><label>{labels[kind]} <input aria-label={labels[kind]} name="file" required type="file" accept={['CREDIT_DOCUMENT','COMMERCIAL_DOCUMENT'].includes(kind)?'.pdf,.docx':['BKI','BFO_REVIEW'].includes(kind)?'.pdf':kind.endsWith('LEDGER')||kind==='COUNTERPARTIES'?'.csv,.xls,.xlsx':'.pdf,.xls,.xlsx,.csv'}/></label> <button disabled={busy}>Добавить документ</button></form>)}</section>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
