"use client";

import { CheckCircle2, Download, FileArchive, FileText, LoaderCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type DocumentMeta = { id: string; companyInn: string; analysisId: string; applicationId: string; category: string; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: string; status: string; createdAt: string };

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

export default function DocumentsHub({ companyInn, companyName, analysisId }: { companyInn: string; companyName: string; analysisId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories[0]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!companyInn) return;
    const response = await fetch(`/api/documents?inn=${encodeURIComponent(companyInn)}`);
    const body = await response.json() as { documents?: DocumentMeta[]; error?: string };
    if (!response.ok) throw new Error(body.error || "Документы не загружены");
    setDocuments(body.documents ?? []);
  }

  useEffect(() => {
    let active = true;
    if (!companyInn) return () => { active = false; };
    fetch(`/api/documents?inn=${encodeURIComponent(companyInn)}`).then(async (response) => {
      const body = await response.json() as { documents?: DocumentMeta[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Документы не загружены");
      return body.documents ?? [];
    }).then((items) => { if (active) setDocuments(items); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Документы не загружены"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyInn]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setError("");
    try {
      for (const file of files) {
        if (file.size > 1_250_000) throw new Error(`${file.name}: для пилотного хранилища размер должен быть до 1 250 КБ`);
        const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyInn, analysisId, category, fileName: file.name, mimeType: file.type, sizeBytes: file.size, contentBase64: await fileBase64(file), uploadedBy: "Клиент" }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error || `${file.name}: загрузка не выполнена`);
      }
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Документы не загружены"); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  }

  return <>
    <div className="ps-heading"><div><span>ЕДИНОЕ ДОСЬЕ</span><h1>Документы клиента</h1><p>{companyName} · ИНН {companyInn || "не определён"}. Загружайте типовой комплект один раз и прикрепляйте документы к конкретным заявкам через чат.</p></div></div>
    <div className="ps-documents-layout"><section className="ps-card ps-doc-upload"><div><FileArchive /><span><small>ПИЛОТНОЕ ХРАНИЛИЩЕ</small><h2>Добавить в досье</h2><p>Файл привязывается к ИНН и категории. Допустимы PDF, Excel, CSV, TXT, DOC и DOCX до 1 250 КБ.</p></span></div><label>Тип документа<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><input ref={input} hidden multiple type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx" onChange={(event) => void upload(event)} /><button disabled={uploading || !companyInn} onClick={() => input.current?.click()}>{uploading ? <><LoaderCircle className="spin" /> Сохраняем…</> : <><UploadCloud /> Выбрать документы</>}</button>{error && <p className="ps-chat-error">{error}</p>}<small className="ps-storage-note"><ShieldCheck /> Метаданные и содержимое доступны только внутри текущего защищённого контура. Архитектура готова к переносу файлов в отдельное объектное хранилище.</small></section>
      <aside className="ps-card ps-doc-checklist"><span><small>ТИПОВОЙ КОМПЛЕКТ</small><h2>Готовность документов</h2></span>{categories.slice(0, -1).map((item) => { const count = documents.filter((document) => document.category === item).length; return <div className={count ? "ready" : ""} key={item}>{count ? <CheckCircle2 /> : <i /> }<span><b>{item}</b><small>{count ? `${count} файл(а) загружено` : "Нужно при соответствующем продукте"}</small></span></div>; })}</aside>
    </div>
    <section className="ps-card ps-doc-list"><div className="ps-card-title"><span><b>Файлы в досье</b><small>{documents.length} документов · сортировка по дате загрузки</small></span></div>{loading ? <div className="ps-chat-loading"><LoaderCircle className="spin" /> Загружаем список…</div> : documents.length ? <div className="ps-table-scroll"><table><thead><tr><th>Документ</th><th>Категория</th><th>К заявке</th><th>Загрузил</th><th>Дата</th><th></th></tr></thead><tbody>{documents.map((item) => <tr key={item.id}><td><b>{item.fileName}</b><small>{Math.ceil(item.sizeBytes / 1024)} КБ · {item.status}</small></td><td>{item.category}</td><td>{item.applicationId ? "Да" : "Общее досье"}</td><td>{item.uploadedBy}</td><td>{new Intl.DateTimeFormat("ru-RU").format(new Date(item.createdAt))}</td><td><a href={`/api/documents?download=${encodeURIComponent(item.id)}`}><Download /> Скачать</a></td></tr>)}</tbody></table></div> : <div className="ps-chat-empty"><FileText /><b>Досье пока пустое</b><span>Начните с учредительных документов и актуальной отчётности.</span></div>}</section>
  </>;
}
