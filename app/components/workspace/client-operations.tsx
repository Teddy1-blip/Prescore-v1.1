"use client";
import { ChangeEvent, DragEvent, ReactNode, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, Gauge, LockKeyhole, MessageSquareText, Plus, Search, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { type AnalysisResult, type StatementInput } from "../../../lib/prescore";
import type {StatementScreeningResult} from "../../../lib/credit-engine/contracts/sources";
import ApplicationChat from "../../dashboard/application-chat";
export type StoredAnalysis = { id: string; companyName: string; companyInn: string; createdAt?: string; periodFrom?: string; periodTo?: string; bankNames?: string[]; viewTier?: string; screeningResults?: StatementScreeningResult[] };
const rubles = (n: number) => new Intl.NumberFormat("ru-RU", {maximumFractionDigits:0}).format(n) + " ₽";
const formatDate = (s: string) => s ? s.split("-").reverse().join(".") : "Не указан";
export type Deal = {
  id: string; analysisId: string; companyName: string; product: string; amount: number;
  status: string; owner: string; nextAction: string; bank?: string; applicationGroupId?: string;
  consentAt?: string; createdAt?: string; updatedAt?: string;
  statusHistory?: Array<{ id: string; fromStatus: string; toStatus: string; actorRole: string; publicComment: string; createdAt: string }>;
};

function PageHeading({ kicker, title, body, action }: { kicker: string; title: string; body: string; action?: ReactNode }) {
  return <div className="ps-heading"><div><span>{kicker}</span><h1>{title}</h1><p>{body}</p></div>{action}</div>;
}

export type UploadReceipt={screeningResults?:StatementScreeningResult[];rejectedFiles?:string[]};
const screeningLabels:Record<string,string>={ACCEPTED:'Принят',DUPLICATE:'Дубликат',COMPANY_MISMATCH:'Другой ИНН',UNSUPPORTED:'Формат не поддерживается',UNRECOGNIZED:'Не распознан',INVALID:'Некорректный файл'};
export function ScreeningSummary({receipt,open=false}:{receipt:UploadReceipt;open?:boolean}){
 const rows=receipt.screeningResults??[],accepted=rows.filter(r=>r.status==='ACCEPTED'),rejected=rows.filter(r=>r.status!=='ACCEPTED');
 const fallback=(receipt.rejectedFiles??[]).filter(name=>!rows.some(r=>r.fileName===name));
 if(!rows.length&&!fallback.length)return null;
 const list=(items:StatementScreeningResult[])=>items.map((r,i)=><li key={i}><strong>{r.fileName}</strong><span>{screeningLabels[r.status]??'Статус не уточнён'}</span>{r.reason&&<p>{r.reason}</p>}{r.bankName&&<small>{r.bankName} · {formatDate(r.periodFrom??'')} — {formatDate(r.periodTo??'')}</small>}</li>);
 return <details className="ws-screening ws-section" open={open}><summary>Серверная проверка файлов</summary><p>В расчёт входят только файлы, принятые сервером.</p><div className="ws-screening-groups"><section data-screening="accepted"><h3>Приняты сервером: {accepted.length}</h3><ul>{list(accepted)}</ul></section><section data-screening="rejected"><h3>Исключены: {rejected.length+fallback.length}</h3><ul>{list(rejected)}{fallback.map((name,i)=><li key={i}>{name} — исключён сервером; подробная причина не опубликована.</li>)}</ul></section></div></details>;
}
export function AnalysisHistory({analyses,selectedId,select}:{analyses:StoredAnalysis[];selectedId:string;select:(id:string)=>void}){
 return <details className="ws-analysis-history ws-section"><summary>История анализов ({analyses.length})</summary><p>Сохранённые версии. Доступ и периоды указаны по данным сервера.</p>{analyses.map(a=><article key={a.id} aria-current={a.id===selectedId?'true':undefined}><div><strong>{a.companyName}</strong><p>ИНН {a.companyInn} · {formatDate(a.periodFrom??'')} — {formatDate(a.periodTo??'')}</p><small>Создан: {a.createdAt?new Date(a.createdAt).toLocaleString('ru-RU'):'Дата не указана'} · {a.viewTier==='FULL'?'FULL':a.viewTier==='FREE'||a.viewTier==='BASIC'?'BASIC':'Доступ не уточнён'}</small>{a.bankNames?.length?<p>{a.bankNames.join(' · ')}</p>:null}</div><button onClick={()=>select(a.id)} disabled={a.id===selectedId}>{a.id===selectedId?'Выбран':'Открыть'}</button></article>)}</details>;
}
export function Analyze({onResult}:{onResult:(result:AnalysisResult,receipt?:UploadReceipt)=>void|Promise<void>}){
 const input=useRef<HTMLInputElement>(null),pending=useRef(false),reading=useRef(false);
 const [statements,setStatements]=useState<StatementInput[]>([]),[processing,setProcessing]=useState(false),[adding,setAdding]=useState(false),[error,setError]=useState(''),[localRejected,setLocalRejected]=useState<Array<{fileName:string;reason:string}>>([]),[receipt,setReceipt]=useState<UploadReceipt>({});
 async function addFiles(files:File[]){
  if(pending.current||reading.current||!files.length)return;reading.current=true;setAdding(true);setError('');setReceipt({});
  const candidates:StatementInput[]=[],rejected:Array<{fileName:string;reason:string}>=[];
  try{for(const file of files){
   if(statements.length+candidates.length>=30){rejected.push({fileName:file.name,reason:'До 30 файлов в одном запросе.'});continue;}
   if(!/\.txt$/i.test(file.name)||file.size>15*1024*1024){rejected.push({fileName:file.name,reason:'Для банковского анализа нужен TXT до 15 МБ.'});continue;}
   try{const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('�'))text=new TextDecoder('windows-1251').decode(buffer);candidates.push({fileName:file.name,text});}catch{rejected.push({fileName:file.name,reason:'Не удалось прочитать файл. Выберите его повторно.'});}
  }setStatements(current=>[...current,...candidates]);setLocalRejected(rejected);}finally{reading.current=false;setAdding(false);if(input.current)input.current.value='';}
 }
 async function calculate(){
  if(pending.current||reading.current||!statements.length)return;pending.current=true;setProcessing(true);setError('');setReceipt({});
  try{const response=await fetch('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({statements})});const body=await response.json() as UploadReceipt&{analysis?:AnalysisResult;error?:string};setReceipt(body);
   if(!response.ok||!body.analysis)throw Error(body.error||'Серверный расчёт не выполнен');await onResult(body.analysis,body);
  }catch(e){setError(e instanceof TypeError?'Нет подтверждения сохранения. Проверьте историю анализов перед повторным запросом.':e instanceof Error?e.message:'Не удалось выполнить анализ');}
  finally{pending.current=false;setProcessing(false);}
 }
 return <><PageHeading kicker="БАНКОВСКИЕ ВЫПИСКИ" title="Соберите банковский поток компании" body="Каждый серверный расчёт сохраняется отдельным анализом. Проверку одного ИНН, формата и дубликатов выполняет сервер."/>
 <div className="ps-upload-layout"><section className="ps-card ps-upload-card"><div className="ps-dropzone" onDragOver={(e:DragEvent)=>e.preventDefault()} onDrop={(e:DragEvent)=>{e.preventDefault();void addFiles(Array.from(e.dataTransfer.files));}}>
 <input ref={input} multiple type="file" disabled={processing||adding} accept=".txt,text/plain" onChange={(e:ChangeEvent<HTMLInputElement>)=>void addFiles(Array.from(e.target.files??[]))}/>
 <UploadCloud/><h2>{processing?'Сервер проверяет и рассчитывает анализ…':adding?'Читаем файлы…':'Выберите банковские выписки'}</h2><p>TXT 1CClientBankExchange · UTF-8 / Windows-1251 · до 30 файлов, 15 МБ каждый. Банковский Excel/PDF в этом flow не поддерживается.</p><button disabled={processing||adding} onClick={()=>input.current?.click()}>Выбрать TXT-файлы</button></div>
 {statements.length>0&&<div className="ps-statement-list"><div className="ps-statement-list-head"><strong>Готовы к отправке: {statements.length}</strong><button disabled={processing||adding} onClick={()=>{setStatements([]);setReceipt({});setError('');}}>Очистить</button></div><p>Одинаковые имена и счета не исключаются заранее. Принятие каждого документа подтвердит сервер.</p>{statements.map((s,i)=><article key={i}><span><b>{s.fileName}</b><small>Ожидает серверной проверки</small></span><button disabled={processing||adding} aria-label={'Удалить '+s.fileName} onClick={()=>setStatements(current=>current.filter((_,n)=>n!==i))}><Trash2/></button></article>)}<button className="ps-analyze-files-button" disabled={processing||adding} onClick={()=>void calculate()}><Gauge/>{processing?'Проверяем и рассчитываем…':'Рассчитать по выбранным файлам'}</button></div>}
 {localRejected.length>0&&<section role="status"><h3>Не отправлены на сервер</h3>{localRejected.map((r,i)=><p key={i}><strong>{r.fileName}</strong>: {r.reason}</p>)}</section>}
 <ScreeningSummary receipt={receipt} open/>{error&&<div className="ps-upload-error" role="alert"><AlertTriangle/><span><b>Нет подтверждённого результата</b><p>{error}</p><p>Ранее сохранённые анализы доступны в истории. Выбранные файлы сохранены в форме для проверки и повторной попытки.</p></span></div>}</section>
 <aside className="ps-upload-side"><div className="ps-card"><LockKeyhole/><h3>Серверная обработка</h3><p>Расчёт выполняется по принятым файлам одного ИНН. Исключённые файлы будут показаны отдельно.</p></div><div className="ps-card"><h3>Другие документы</h3><p>БКИ и квартальная отчётность добавляются через отдельные разделы. Documents Hub хранит досье; загрузка туда не запускает банковский расчёт.</p></div></aside></div></>;
}

export function Crm({ deals, analyses, selected, addDeal, updateDeal }: { deals: Deal[]; analyses: StoredAnalysis[]; selected: StoredAnalysis | null; addDeal: (deal: Omit<Deal, "id">) => Promise<void>; updateDeal: (id: string, status: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatDeal, setChatDeal] = useState<Deal | null>(null);
  const shown = deals.filter((deal) => `${deal.companyName} ${deal.product} ${deal.bank??""}`.toLowerCase().includes(query.toLowerCase()));
  const pending=useRef(new Set<string>()),[pendingIds,setPendingIds]=useState<string[]>([]),[actionError,setActionError]=useState('');
  async function cancel(id:string){if(pending.current.has(id)||!window.confirm('Отменить заявку?'))return;pending.current.add(id);setPendingIds([...pending.current]);setActionError('');try{await updateDeal(id,'Отменена клиентом');}catch(e){setActionError(e instanceof Error?e.message:'Не удалось отменить заявку');}finally{pending.current.delete(id);setPendingIds([...pending.current]);}}
  const total = deals.reduce((sum, deal) => sum + deal.amount, 0);
  return <><div className="pc-section-intro"><div><span>ЗАЯВКИ В БАНКИ</span><h2>Обращения по выбранной версии анализа</h2><p>По каждому выбранному банку ведутся отдельный статус, история, комплект документов и чат с брокером.</p></div><button className="ps-primary-button" onClick={() => setOpen(true)}><Plus /> Новая заявка</button></div><div className="ps-crm-kpis"><span><small>ЗАЯВОК</small><b>{deals.length}</b></span><span><small>ЗАПРОШЕНО</small><b>{rubles(total)}</b></span><span><small>В БАНКАХ</small><b>{deals.filter((deal) => ["Отправлена в банк", "На рассмотрении у финансового партнёра", "Предварительное решение"].includes(deal.status)).length}</b></span><span><small>ОДОБРЕНО</small><b>{deals.filter((deal) => deal.status === "Одобрена").length}</b></span></div>{open && <DealForm analyses={analyses} selected={selected} close={() => setOpen(false)} submit={async(deal) => { await addDeal(deal); setOpen(false); }} />}{actionError&&<p role="alert">{actionError}</p>}<section className="ps-card ps-crm-table"><div className="ps-crm-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Банк, компания или продукт" /></label><span><ShieldCheck /> Статус меняет брокер; передача — только после согласия</span></div>{shown.length ? <div className="ps-table-scroll"><table><thead><tr><th>Заявка / клиент</th><th>Банк или партнёр</th><th>Сумма</th><th>Следующий шаг</th><th>Статус и история</th><th>Действия</th></tr></thead><tbody>{shown.map((deal) => <tr key={deal.id}><td><b>{deal.product}</b><small>{deal.companyName}</small></td><td><b>{deal.bank || "Выбирается"}</b><small>{deal.owner}</small></td><td><strong>{rubles(deal.amount)}</strong></td><td>{deal.nextAction}</td><td><span className="ps-application-status">{deal.status}</span><details className="ps-status-history"><summary>История · {deal.statusHistory?.length ?? 0}</summary>{deal.statusHistory?.map((item) => <p key={item.id}><b>{item.toStatus}</b><small>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))} · {item.publicComment}</small></p>)}</details></td><td><div className="ps-application-actions"><button className="ps-chat-open" onClick={() => setChatDeal(deal)}><MessageSquareText /> Чат</button>{!["Выдана", "Закрыта", "Отклонена", "Отменена клиентом"].includes(deal.status) && <button className="ps-cancel-application" disabled={pendingIds.includes(deal.id)} onClick={()=>void cancel(deal.id)}>Отменить</button>}</div></td></tr>)}</tbody></table></div> : <div className="ps-empty-crm"><BriefcaseBusiness /><h3>Заявок пока нет</h3><p>Создайте обращение из подходящего маршрута или добавьте его вручную.</p><button onClick={() => setOpen(true)}>Создать первую заявку</button></div>}</section>{chatDeal && <ApplicationChat key={chatDeal.id} applicationId={chatDeal.id} title={`${chatDeal.product} · ${chatDeal.bank || "выбор банка"}`} companyInn={selected?.companyInn || ""} analysisId={chatDeal.analysisId} role="client" close={() => setChatDeal(null)} />}</>;
}

export function DealForm({ analyses, selected, initialProduct, close, submit }: { analyses: StoredAnalysis[]; selected: StoredAnalysis | null; initialProduct?: string; close: () => void; submit: (deal: Omit<Deal, "id">) => Promise<void> }) {
  const [analysisId, setAnalysisId] = useState(selected?.id ?? analyses[0]?.id ?? "");
  const [product, setProduct] = useState(initialProduct || "Оборотная линия");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState(0);
  const [nextAction, setNextAction] = useState("Собрать документы и выбрать 3 партнёров");
  const pending=useRef(false),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  async function save(){if(pending.current||!company)return;pending.current=true;setSaving(true);setSaveError('');try{await submit({analysisId:company.id,companyName:company.companyName,product,bank,amount,status:'Черновик',owner:'Клиент',nextAction:nextAction||'Выбрать банк и проверить документы'});}catch(e){setSaveError(e instanceof Error?e.message:'Заявка не сохранена. Повторите попытку.');}finally{pending.current=false;setSaving(false);}}
  const company = analyses.find((item) => item.id === analysisId) ?? selected;
  return <div className="ps-deal-form ps-card"><div><span><small>НОВАЯ ЗАЯВКА В БАНК</small><h2>Подготовить обращение</h2></span><button disabled={saving} onClick={close} aria-label="Закрыть форму заявки"><X /></button></div><fieldset disabled={saving} className="ps-form-grid"><label>Компания<select value={analysisId} onChange={(event) => setAnalysisId(event.target.value)}>{analyses.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}</select></label><label>Банк или партнёр<input value={bank} onChange={(event) => setBank(event.target.value)} placeholder="Можно выбрать позже" /></label><label>Продукт<select value={product} onChange={(event) => setProduct(event.target.value)}><option>Оборотная линия</option><option>Контрактный кредит</option><option>Овердрафт</option><option>Факторинг</option><option>Рефинансирование</option><option>Лизинг</option><option>Банковская гарантия</option></select></label><label>Сумма, ₽<input type="number" min="0" step="10000" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>Следующее действие<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label></fieldset>{saveError&&<p role="alert">{saveError}</p>}<div className="ps-form-actions"><button disabled={saving} onClick={close}>Отмена</button><button disabled={!company||saving} onClick={()=>void save()}>{saving?"Сохраняем…":"Создать черновик"} <ArrowRight /></button></div><p className="ps-legal-line">Создание черновика не передаёт данные в банк. Перед отправкой потребуется отдельное согласие клиента.</p></div>;
}
