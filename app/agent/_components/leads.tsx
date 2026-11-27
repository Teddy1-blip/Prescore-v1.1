"use client";

import Link from "next/link";
import {applicationUrl} from "../../../lib/agent/workflow";
import { ArrowLeft, BriefcaseBusiness, Check, FileSpreadsheet, Filter, LoaderCircle, Phone, Search, ShieldCheck, Upload, X } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { parseGold44Workbook, type Gold44Record } from "../../../lib/gold44";
import {Pager,useAgentRead} from './data';
import "../prospects/prospects.css";
import "../prospects/prospects-polish.css";
import "../../prescore-ui-v1.css";

type ProspectResponse = {
  records: Gold44Record[];
  summary: Record<string, number>;
  regions: Array<{ region: string; count: number }>;
  error?: string;
};

const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
const statusLabels: Record<string, string> = { new: "Новый", matched: "ИНН совпал", contacted: "Связались", added: "В CRM", rejected: "Отклонён" };

export default function AgentProspectsPage() {
  const [page,setPage]=useState(1),[saving,setSaving]=useState(false);
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("all"); const [region, setRegion] = useState("");
  const [minGuarantee, setMinGuarantee] = useState(0); const [contactsOnly, setContactsOnly] = useState(false);
  const [importing, setImporting] = useState(false); const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");

  const pageSize=50;
  const params=new URLSearchParams({q:query,status,region,minGuarantee:String(minGuarantee),
    hasContacts:contactsOnly?'1':'0',limit:String(pageSize+1),offset:String((page-1)*pageSize)});
  const queryState=useAgentRead<ProspectResponse>('/api/agent/prospects?'+params);
  const data=queryState.data??{records:[],summary:{},regions:[]};
  const loading=!queryState.data&&!queryState.error;
  const noticeError=error||queryState.error;
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setImporting(true); setError(""); setMessage("Читаю структуру Excel…"); setProgress(2);
    try {
      const parsed = parseGold44Workbook(new Uint8Array(await file.arrayBuffer()), file.name);
      for (let index = 0; index < parsed.records.length; index += 60) {
        const response = await fetch("/api/agent/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "import", records: parsed.records.slice(index, index + 60) }) });
        const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Импорт остановлен");
        setProgress(Math.round(((index + 60) / parsed.records.length) * 94)); setMessage(`Сохраняю строки: ${Math.min(index + 60, parsed.records.length)} из ${parsed.records.length}`);
      }
      let matched = 0;
      for (let pass = 0; pass < 30; pass += 1) {
        const response = await fetch("/api/agent/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "match" }) });
        const body = await response.json() as { matched?: number; error?: string }; if (!response.ok) throw new Error(body.error || "Не удалось сверить ИНН");
        matched += body.matched || 0; if (!body.matched || body.matched < 200) break;
      }
      setProgress(100); setMessage(`Загружено ${parsed.validRows.toLocaleString("ru-RU")} строк. По ИНН автоматически создано заявок БГ: ${matched}.`); queryState.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось прочитать файл"); }
    finally { setImporting(false); }
  }

  async function decide(record: Gold44Record, decision: "crm" | "reject") {
    if(saving)return;
    const reason=decision==='reject'?window.prompt('Причина отклонения','Не соответствует текущему профилю прозвона'):'';
    if(reason===null)return;
    setSaving(true);setError('');
    try{
      const response=await fetch('/api/agent/prospects',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type:'decision',id:record.id,decision,reason})});
      const body=await response.json();
      if(!response.ok)throw Error(body.error||'Действие не выполнено');
      setMessage(decision==='crm'?'Клиент добавлен в CRM, черновик БГ создан.':'Карточка исключена из прозвона.');
      queryState.reload();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить действие.');}
    finally{setSaving(false);}

  }

  const total = Object.values(data.summary).reduce((sum, value) => sum + Number(value || 0), 0);
  return <div className="gp-shell">
    <header><Link href="/agent"><ArrowLeft /> Кабинет агента</Link><div><small>БАЗА ЗАКУПОК · ЭТАП ДО CRM</small><h1>Лиды и база для прозвона</h1><p>Импортируйте Excel, выберите перспективные контракты и добавьте компанию в CRM. Точное совпадение ИНН с текущим клиентом автоматически создаёт черновик заявки на банковскую гарантию.</p></div><label className={importing ? "disabled" : ""}><Upload /> {importing ? "Импорт…" : "Загрузить Gold44"}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={upload} disabled={importing} /></label></header>

    {(message || noticeError) && <section role={noticeError?"alert":"status"} className={noticeError ? "gp-notice error" : "gp-notice"}>{importing ? <LoaderCircle /> : noticeError ? <X /> : <Check />}<div><b>{noticeError || message}</b>{queryState.error&&<button onClick={queryState.reload}>Повторить</button>}{importing && <span><i style={{ width: `${progress}%` }} /></span>}</div></section>}

    {queryState.data&&<section className="gp-kpis"><article><small>ВСЕГО В БАЗЕ</small><b>{total.toLocaleString("ru-RU")}</b><p>структурированных строк</p></article><article><small>ДЛЯ ПРОЗВОНА</small><b>{Number(data.summary.new || 0).toLocaleString("ru-RU")}</b><p>без решения агента</p></article><article className="good"><small>СОВПАДЕНИЕ ИНН</small><b>{Number(data.summary.matched || 0).toLocaleString("ru-RU")}</b><p>черновики БГ созданы</p></article><article><small>ДОБАВЛЕНО В CRM</small><b>{Number(data.summary.added || 0).toLocaleString("ru-RU")}</b><p>для дальнейшей работы</p></article><article><small>ОТКЛОНЕНО</small><b>{Number(data.summary.rejected || 0).toLocaleString("ru-RU")}</b><p>исключено из прозвона</p></article></section>}

    <section className="gp-filters"><label><Search /><input maxLength={120} value={query} onChange={(event) => {setPage(1);setQuery(event.target.value);}} placeholder="Компания, ИНН, извещение, заказчик" /></label><label><Filter /><select value={status} onChange={(event) => {setPage(1);setStatus(event.target.value);}}><option value="all">Все статусы</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><select value={region} onChange={(event) => {setPage(1);setRegion(event.target.value);}}><option value="">Все регионы</option>{data.regions.map((item) => <option value={item.region} key={item.region}>{item.region} · {item.count}</option>)}</select><select value={minGuarantee} onChange={(event) => {setPage(1);setMinGuarantee(Number(event.target.value));}}><option value={0}>Любое обеспечение</option><option value={500000}>от 500 тыс. ₽</option><option value={1000000}>от 1 млн ₽</option><option value={5000000}>от 5 млн ₽</option><option value={10000000}>от 10 млн ₽</option></select><label className="gp-check"><input type="checkbox" checked={contactsOnly} onChange={(event) => {setPage(1);setContactsOnly(event.target.checked);}} /> Есть телефон / email</label></section>

    {!queryState.error&&<section className="gp-list">{loading ? <div className="gp-empty"><LoaderCircle /> Загружаю карточки…</div> : data.records.length ? data.records.slice(0,pageSize).map((record) => <article key={record.id}>
      <header><span><i className={`priority ${record.callPriority === "Высокий" ? "high" : record.callPriority === "Средний" ? "medium" : ""}`}>{record.callScore}</i><span><small>{record.callPriority.toUpperCase()} ПРИОРИТЕТ</small><h2>{record.companyName}</h2><p>ИНН {record.inn}{record.region&&' · '+record.region}</p></span></span><em className={`status ${record.status}`}>{statusLabels[record.status || "new"] || record.status}</em></header>
      <div className="gp-contract"><dl><dt>Извещение</dt><dd>{record.noticeNumber}</dd>{record.tenderSubject&&<><dt>Предмет</dt><dd>{record.tenderSubject}</dd></>}{record.customer&&<><dt>Заказчик</dt><dd>{record.customer}</dd></>}{record.sourceFile&&<><dt>Источник</dt><dd>{record.sourceFile}</dd></>}{record.rejectReason&&<><dt>Результат обработки</dt><dd>{record.rejectReason}</dd></>}</dl><div><span><small>ЦЕНА КОНТРАКТА</small><b>{money(record.contractPrice)}</b></span><span><small>ОБЕСПЕЧЕНИЕ</small><b>{money(record.guaranteeAmount)}</b></span><span><small>ПОБЕД</small><b>{record.winsCount}</b></span></div></div>
      <footer><div>{record.mobilePhone || record.phones?.[0] ? <a href={`tel:${record.mobilePhone || record.phones[0]}`}><Phone /> {record.mobilePhone || record.phones[0]}</a> : <span>Телефон не найден</span>}{record.emails?.[0] && <a href={`mailto:${record.emails[0]}`}>{record.emails[0]}</a>}<small>{record.director}</small></div>{record.status === "new" ? <div><button className="reject" disabled={saving} onClick={() => decide(record, "reject")}><X /> Отклонить</button><button disabled={saving} onClick={() => decide(record, "crm")}><BriefcaseBusiness /> В CRM + БГ</button></div> : record.applicationId ? <Link className="application" href={applicationUrl(record.applicationId)}>Открыть заявку БГ</Link> : null}</footer>
    </article>) : <div className="gp-empty"><FileSpreadsheet /><b>По фильтрам ничего не найдено</b><p>Загрузите Gold44 или измените параметры выборки.</p></div>}</section>}
    <Pager page={page} change={setPage} next={data.records.length>pageSize}/>
    <p className="ag-empty">Журнал звонков и напоминания · Позже</p><aside className="gp-legal"><ShieldCheck /><p><b>Контроль согласия.</b> Публичные деловые контакты сохраняются для подготовки прозвона. Добавление в CRM не означает согласие на передачу документов банку: перед отправкой заявки агент обязан получить отдельное согласие клиента и подтвердить актуальность сведений.</p></aside>
  </div>;
}
