"use client";

import { CheckCircle2, Download, FileArchive, FileText, LoaderCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";

export type DocumentMeta = { id: string; companyInn: string; analysisId: string; applicationId: string; category: string; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: string; status: string; createdAt: string };

export function documentContext(item:Pick<DocumentMeta,'companyInn'|'analysisId'|'applicationId'>,selectedId:string){
 return {company:'Компания · ИНН '+item.companyInn,analysis:item.analysisId?(item.analysisId===selectedId?'Выбранный анализ':'Другой анализ'):'Без привязки к анализу',application:item.applicationId?'Вложение заявки · '+item.applicationId:'Без привязки к заявке'};
}

const categories = [
  "Анкета клиента",
  "Устав и регистрационные документы",
  "Решение или протокол о полномочиях",
  "Документ руководителя или бенефициара",
  "БФО и квартальная отчётность",
  "Расшифровка дебиторской и кредиторской задолженности",
  "Контракты, УПД и акты",
  "Кредитные договоры и графики",
  "Залог и лизинговые документы",
  "Прочее",
];

async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

type DocumentsProps = { companyInn: string; companyName: string; analysisId: string; readOnly?: boolean; showHeading?: boolean };
export default function DocumentsHub(props:DocumentsProps){return <DocumentsContext key={props.companyInn+":"+props.analysisId} {...props}/>;}
function DocumentsContext({ companyInn, companyName, analysisId, readOnly = false, showHeading = true }: DocumentsProps) {
  const input = useRef<HTMLInputElement>(null),pending=useRef(false),requestId=useRef(0);
  const [category, setCategory] = useState(categories[0]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [scope,setScope]=useState('company'),[message,setMessage]=useState('');

  async function load(){
    const request=++requestId.current;setLoading(true);
    try{const response=await fetch(`/api/documents?inn=${encodeURIComponent(companyInn)}`,{cache:'no-store'});const body=await response.json();if(!response.ok)throw Error(body.error||'Документы не загружены');if(request===requestId.current){setDocuments(body.documents??[]);setError('');}}
    catch(e){if(request===requestId.current)setError(e instanceof Error?e.message:'Документы не загружены');}
    finally{if(request===requestId.current)setLoading(false);}
  }
  useEffect(()=>{let active=true;
    if(companyInn)fetch(`/api/documents?inn=${encodeURIComponent(companyInn)}`,{cache:'no-store'}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||'Документы не загружены');return body;}).then(body=>{if(active)setDocuments(body.documents??[]);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Документы не загружены');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[companyInn]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    if (readOnly||pending.current) return;
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    pending.current=true;setUploading(true);setError("");setMessage("");let saved=0;let failure="";
    try {
      for (const file of files) {
        if (file.size > 1_250_000) throw new Error(`${file.name}: для пилотного хранилища размер должен быть до 1 250 КБ`);
        const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyInn, analysisId, category, fileName: file.name, mimeType: file.type, sizeBytes: file.size, contentBase64: await fileBase64(file), uploadedBy: "Клиент" }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error || `${file.name}: загрузка не выполнена`);
        saved++;
      }
    } catch (caught) { failure=caught instanceof Error?caught.message:"Документы не загружены"; }
    finally { if(saved){await load();setMessage(`Сохранено файлов: ${saved}. Они не включаются в расчёт автоматически.`);}if(failure)setError(failure);pending.current=false;setUploading(false); if (input.current) input.current.value = ""; }
  }

  const shown=scope==='analysis'?documents.filter(d=>d.analysisId===analysisId):documents;
  return <>
    {showHeading&&<div className="ps-heading"><div><span>ЕДИНОЕ ДОСЬЕ</span><h1>Документы клиента</h1><p>{companyName} · ИНН {companyInn || "не определён"}. Это досье компании. Документы других анализов могут входить в общее досье; связь каждого файла показана отдельно.</p></div></div>}
    <p className="ws-document-warning">Загрузка в Documents Hub не включает файл в кредитный расчёт автоматически. Банковские выписки, БКИ и квартальную отчётность передавайте через соответствующие разделы анализа.</p>
    {error&&<p role="alert" className="ps-chat-error">{error} <button disabled={loading||uploading} onClick={()=>void load()}>Обновить список</button></p>}{message&&<p role="status">{message}</p>}
    <div className="ps-documents-layout">{!readOnly && <section className="ps-card ps-doc-upload"><div><FileArchive /><span><small>ДОКУМЕНТЫ КОМПАНИИ</small><h2>Добавить в досье</h2><p>Файл привязывается к компании и выбранному анализу. Вложения заявки добавляются через её чат. Допустимы PDF, Excel, CSV, TXT, DOC и DOCX до 1 250 КБ.</p></span></div><label>Тип документа<select disabled={uploading} value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><input ref={input} hidden multiple disabled={uploading} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx" onChange={(event) => void upload(event)} /><button disabled={uploading || !companyInn} onClick={() => input.current?.click()}>{uploading ? <><LoaderCircle className="spin" /> Сохраняем…</> : <><UploadCloud /> Выбрать документы</>}</button><small className="ps-storage-note"><ShieldCheck /> Документы доступны владельцу и уполномоченным участникам работы с компанией.</small></section>}
      <aside className="ps-card ps-doc-checklist"><span><small>ТИПОВОЙ КОМПЛЕКТ</small><h2>Готовность документов</h2></span>{categories.slice(0, -1).map((item) => { const count = documents.filter((document) => document.category === item).length; return <div className={count ? "ready" : ""} key={item}>{count ? <CheckCircle2 /> : <i /> }<span><b>{item}</b><small>{count ? `${count} файл(а) загружено` : "Нужно при соответствующем продукте"}</small></span></div>; })}</aside>
    </div>
    <section className="ps-card ps-doc-list"><div className="ps-card-title"><span><b>Файлы в досье компании</b><small>{documents.length} документов · сортировка по дате загрузки</small></span><label>Показать документы<select value={scope} onChange={e=>setScope(e.target.value)}><option value="company">Всё досье компании</option><option value="analysis">Выбранный анализ</option></select></label></div>{loading ? <div className="ps-chat-loading"><LoaderCircle className="spin" /> Загружаем список…</div> : shown.length ? <div className="ps-table-scroll"><table><thead><tr><th>Документ</th><th>Категория</th><th>Контекст</th><th>Загрузил</th><th>Дата</th><th></th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><b>{item.fileName}</b><small>{Math.ceil(item.sizeBytes / 1024)} КБ · {item.status}</small></td><td>{item.category}</td><td><div className="ws-document-context"><small>{documentContext(item,analysisId).company}</small><b>{documentContext(item,analysisId).analysis}</b>{item.analysisId&&item.analysisId!==analysisId&&<small>Версия: {item.analysisId}</small>}<small>{documentContext(item,analysisId).application}</small></div></td><td>{item.uploadedBy}</td><td>{new Intl.DateTimeFormat("ru-RU").format(new Date(item.createdAt))}</td><td><a href={`/api/documents?download=${encodeURIComponent(item.id)}`}><Download /> Скачать</a></td></tr>)}</tbody></table></div> : <div className="ps-chat-empty"><FileText /><b>В выбранном контексте документов нет</b><span>Начните с учредительных документов и актуальной отчётности.</span></div>}</section>
  </>;
}
