'use client';
import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import DocumentOcrPreview from '../../dashboard/document-ocr-preview';
import {FinancialDynamics} from './financial-dynamics';
import {numeric,Warnings} from './client-financials';
import {Panel} from './client-insights';

type Company={id:string;inn:string};
type PublicProfile={company:{name:string;status?:string;region?:string};fetchedAt:string;publicRisks?:{enforcementDetected:boolean|null;legalEventsDetected:boolean|null};contracts?:{totalCount:number|null};legal?:{legalCases:number|null;enforcements:number|null}};
type Profile=ReturnType<typeof sourceProjection>&{company:Company;versions:{id:string;name:string;start:string;end:string}[];publicProfile:PublicProfile|null;entitlement:string};
const labels:Record<string,string>={BFO:'Годовая бухгалтерская отчётность',QUARTERLY:'Промежуточная отчётность',BKI:'Корпоративный отчёт БКИ',COUNTERPARTIES:'ОСВ 60, 62 и 76',DEBT_LEDGER:'ОСВ 66 и 67',CHECKO:'Публичные сведения',BANK_STATEMENT:'Банковская выписка'};
const kinds:Record<string,string[]>={bfo:['BFO','QUARTERLY'],obligations:['BKI','DEBT_LEDGER'],counterparties:['COUNTERPARTIES'],documents:['BFO','QUARTERLY','BKI','COUNTERPARTIES','DEBT_LEDGER']};
const dossierHref=(id:string,view:string)=>'/dashboard?'+new URLSearchParams({dossierId:id,view});
async function read<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...options}),body=await response.json();
 if(!response.ok)throw Error(body.error??'Не удалось открыть досье.');
 return body;
}
function PublicFacts({profile}:{profile:PublicProfile}){
 return <section><h3>{profile.company.name}</h3><p>{[profile.company.status,profile.company.region].filter(Boolean).join(' · ')}</p><dl>
 {([['Судебные события',profile.legal?.legalCases??profile.publicRisks?.legalEventsDetected],['Исполнительные производства',profile.legal?.enforcements??profile.publicRisks?.enforcementDetected],['Контракты',profile.contracts?.totalCount]] as const).map(([label,value])=>value!=null&&<div key={label}><dt>{label}</dt><dd>{typeof value==='boolean'?(value?'Есть записи':'Записи не найдены'):value}</dd></div>)}</dl><small>Checko · {profile.fetchedAt.slice(0,10)}</small></section>;
}
export function CompanySources({view,id,bankInn,openBank}:{view:string;id:string;bankInn?:string;openBank:()=>void}){
 const [inn,setInn]=useState(bankInn??''),[companies,setCompanies]=useState<Company[]>([]),[profile,setProfile]=useState<Profile|null>(null),[preview,setPreview]=useState<PublicProfile|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[selectedYear,setYear]=useState('');
 useEffect(()=>{const ctrl=new AbortController();(async()=>{
   const list=await read<{companies:Company[]}>('/api/dossier',{signal:ctrl.signal});setCompanies(list.companies);
   const matched=id||list.companies.find(c=>c.inn===bankInn)?.id;
   if(matched)setProfile(await read<Profile>('/api/dossier?id='+encodeURIComponent(matched),{signal:ctrl.signal}));
 })().catch(e=>{if(!ctrl.signal.aborted)setError(e.message)});return()=>ctrl.abort();},[id,bankInn,revision]);
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
  event.preventDefault();if(!company)return;
  const form=event.currentTarget,data=new FormData(form);data.set('id',company.id);
  setBusy(true);setError('');setNotice('');
  try{const result=await read<{duplicate:boolean}>('/api/dossier',{method:'POST',body:data});setNotice(result.duplicate?'Этот документ уже учтён.':'Документ сохранён.');form.reset();setRevision(n=>n+1);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const years=profile?.financial?.history??[],period=years.find(p=>p.id===selectedYear)??years.at(-1);
 const currentLedger=profile?.ledger.filter(l=>l.kind===(view==='obligations'?'DEBT_LEDGER':'COUNTERPARTIES'))??[];
 return <div className="ws" aria-label="Источники компании">
 {(!company||view==='home')&&<Panel title="Компания по ИНН">
 {companies.length>0&&<label>Мои досье <select value={company?.id??''} onChange={e=>{if(e.target.value)location.assign(dossierHref(e.target.value,view))}}><option value="">Выберите компанию</option>{companies.map(c=><option key={c.id} value={c.id}>{c.inn}</option>)}</select></label>}
 <form onSubmit={e=>{e.preventDefault();void submit(view==='home'?'preview':'save')}}><label>ИНН компании <input required inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" value={inn} disabled={busy} onChange={e=>{setInn(e.target.value);setPreview(null);setNotice('')}}/></label>{view==='home'&&<button type="submit" disabled={busy}>Проверить ИНН</button>} <button type="button" disabled={busy||!inn} onClick={()=>void submit('save')}>Сохранить компанию в досье</button></form>
 {preview&&<PublicFacts profile={preview}/>}
 </Panel>}
 {company&&<><p>Досье компании · ИНН {company.inn}</p>
 {view==='home'&&<>{profile.publicProfile&&<PublicFacts profile={profile.publicProfile}/>}<button onClick={openBank}>Загрузить банковскую выписку</button></>}
 {(view==='home'||view==='analysis'||view==='documents')&&profile.versions.length>0&&<Panel title="Сохранённые банковские анализы">{profile.versions.map(v=><p key={v.id}><a href={'/dashboard?'+new URLSearchParams({analysisId:v.id,view:view==='documents'?'documents':'analysis'})}>{v.name} · {v.start} — {v.end}</a></p>)}</Panel>}
 {(kinds[view]??[]).map(kind=><form onSubmit={upload} key={kind}><input name="kind" type="hidden" value={kind}/><label>{labels[kind]} <input aria-label={labels[kind]} name="file" required type="file" accept={kind==='BKI'?'.pdf':kind.endsWith('LEDGER')||kind==='COUNTERPARTIES'?'.csv,.xlsx':'.pdf,.xlsx,.csv'}/></label> <button disabled={busy}>Добавить документ</button></form>)}
 {(view==='bfo'||view==='home')&&period&&<Panel title="Финансовый профиль БФО"><label>Отчётный период <select value={period.id} onChange={e=>setYear(e.target.value)}>{years.map(p=><option value={p.id} key={p.id}>{p.period.from} — {p.period.to}</option>)}</select></label>
 <dl className="pc-definition pc-bank-summary">{period.groups.flatMap(g=>g.metrics).filter(m=>['REVENUE','NET_PROFIT','ASSETS_TOTAL','EQUITY','CASH'].includes(m.key)&&m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl>
 <FinancialDynamics history={years}/><p>Сверка баланса · {period.quality.balanceReconciled===true?'сходится':period.quality.balanceReconciled===false?'есть расхождение':'недостаточно строк'}</p><Warnings items={period.quality.warnings}/>
 {period.groups.map(g=><details key={g.key}><summary>{g.title}</summary><dl>{g.metrics.filter(m=>m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{numeric(m.value,m.status,m.unit)}</dd></div>)}</dl></details>)}</Panel>}
 {view==='bfo'&&profile.findings.length>0&&<Panel title="Финансовые риски">{profile.findings.map(f=><section key={f.id}><h3>{f.title}</h3><p>{f.why}</p><small>{f.asOf} · {f.sourceIds.map(id=>profile.sources.find(s=>s.id===id)?.name).filter(Boolean).join(', ')}</small></section>)}</Panel>}
 {view==='documents'&&profile.sources.some(s=>s.documentId&&/\.pdf$/i.test(s.name))&&<DocumentOcrPreview documents={profile.sources.flatMap(s=>s.documentId&&/\.pdf$/i.test(s.name)?[{id:s.documentId,fileName:s.name,category:labels[s.kind]??s.kind}]:[])}/>}
 {view==='obligations'&&profile.obligations.length>0&&<Panel title="Обязательства по БКИ">{profile.obligations.map(o=><p key={o.id}>{o.creditor} · {o.contract??'Номер договора не указан'} · {o.principal==null?'Остаток не указан':numeric(o.principal,'KNOWN','RUB')} · {o.maturity??'Срок не указан'}</p>)}</Panel>}
 {['counterparties','obligations'].includes(view)&&<details><summary>Формат импорта ОСВ</summary><p>Одна строка на счёт, контрагента, договор и дату. Заголовки колонок: ИНН организации, Дата остатка, Счёт, Контрагент, Договор, Дебет, руб., Кредит, руб. Дата в формате ГГГГ-ММ-ДД. CSV с разделителем «точка с запятой» или XLSX.</p></details>}
 {currentLedger.length>0&&<Panel title="Остатки по документам ОСВ"><div className="pc-table-scroll"><table><thead><tr>{['Счёт','Контрагент','Договор','Дата','Дебет, ₽','Кредит, ₽','Источник'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{currentLedger.map(l=><tr key={l.sourceId+':'+l.row}><td>{l.account}</td><td>{l.party}</td><td>{l.contract??'—'}</td><td>{l.asOf}</td><td>{l.debit??'—'}</td><td>{l.credit??'—'}</td><td>{profile.sources.find(s=>s.id===l.sourceId)?.name}, строка {l.row}</td></tr>)}</tbody></table></div></Panel>}
 {(view==='documents'||view==='home'||view==='bfo')&&profile.sources.length>0&&<Panel title="Источники досье">{profile.sources.map(s=><p key={s.id}>{s.documentId?<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>{s.name}</a>:s.name} · {labels[s.kind]??s.kind} · {s.received.slice(0,10)}</p>)}</Panel>}
 </>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
