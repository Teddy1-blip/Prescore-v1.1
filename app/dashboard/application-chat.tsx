"use client";

import { Download, FileUp, LoaderCircle, MessageSquareText, Paperclip, Send, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import "./dashboard.css";

type Message = { id: string; applicationId: string; authorRole: string; authorName: string; message: string; documentId: string; createdAt: string };
type DocumentMeta = { id: string; fileName: string; category: string; sizeBytes: number };

async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export default function ApplicationChat({ applicationId, title, companyInn, analysisId, role, close }: { applicationId: string; title: string; companyInn: string; analysisId: string; role: "client" | "broker"; close: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const attachment = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { previous?.focus(); };
  }, []);

  async function load() {
    const [messagesResponse, documentsResponse] = await Promise.all([
      fetch(`/api/communications?applicationId=${encodeURIComponent(applicationId)}`),
      fetch(`/api/documents?applicationId=${encodeURIComponent(applicationId)}`),
    ]);
    if (!messagesResponse.ok) throw new Error("Не удалось загрузить чат");
    const messagesBody = await messagesResponse.json() as { messages?: Message[] };
    const documentsBody = documentsResponse.ok ? await documentsResponse.json() as { documents?: DocumentMeta[] } : {};
    setMessages(messagesBody.messages ?? []);
    setDocuments(documentsBody.documents ?? []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/communications?applicationId=${encodeURIComponent(applicationId)}`),
      fetch(`/api/documents?applicationId=${encodeURIComponent(applicationId)}`),
    ]).then(async ([messagesResponse, documentsResponse]) => {
      if (!messagesResponse.ok) throw new Error("Не удалось загрузить чат");
      const messagesBody = await messagesResponse.json() as { messages?: Message[] };
      const documentsBody = documentsResponse.ok ? await documentsResponse.json() as { documents?: DocumentMeta[] } : {};
      return { messages: messagesBody.messages ?? [], documents: documentsBody.documents ?? [] };
    }).then((payload) => { if (active) { setMessages(payload.messages); setDocuments(payload.documents); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Ошибка чата"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applicationId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/communications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, authorRole: role, authorName: role === "broker" ? "Брокер Прескор" : "Клиент", message: value }) });
      if (!response.ok) throw new Error("Сообщение не отправлено");
      setValue(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Сообщение не отправлено"); }
    finally { setSending(false); }
  }

  async function attachFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSending(true); setError("");
    try {
      if (file.size > 1_250_000) throw new Error("Для пилотного хранилища файл должен быть до 1 250 КБ");
      const upload = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyInn, analysisId, applicationId, category: "Документы по заявке", fileName: file.name, mimeType: file.type, sizeBytes: file.size, contentBase64: await fileBase64(file), uploadedBy: role === "broker" ? "Брокер" : "Клиент" }) });
      const uploadBody = await upload.json() as { document?: DocumentMeta; error?: string };
      if (!upload.ok || !uploadBody.document) throw new Error(uploadBody.error || "Документ не загружен");
      await fetch("/api/communications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, authorRole: role, authorName: role === "broker" ? "Брокер Прескор" : "Клиент", message: `Прикреплён документ: ${file.name}`, documentId: uploadBody.document.id }) });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Документ не загружен"); }
    finally { setSending(false); if (attachment.current) attachment.current.value = ""; }
  }

  const documentById = new Map(documents.map((item) => [item.id, item]));
  return <div ref={dialog} className="ps-chat-overlay" role="dialog" aria-label={title} aria-modal="true" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([hidden]):not(:disabled), a[href]') ?? []).filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}><section className="ps-chat-panel">
    <header><span><small>ЧАТ ПО ЗАЯВКЕ</small><h2>{title}</h2><p>Клиент и брокер видят одну историю и одни вложения.</p></span><button onClick={close} aria-label="Закрыть чат"><X /></button></header>
    <div className="ps-chat-body">{loading ? <div className="ps-chat-loading"><LoaderCircle className="spin" /> Загружаем сообщения…</div> : messages.length ? messages.map((item) => { const document = documentById.get(item.documentId); return <article key={item.id} className={item.authorRole === role ? "mine" : "theirs"}><span><b>{item.authorName}</b><time>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></span>{item.message && <p>{item.message}</p>}{document && <a href={`/api/documents?download=${encodeURIComponent(document.id)}`}><Download /> {document.fileName}</a>}</article>; }) : <div className="ps-chat-empty"><MessageSquareText /><b>Начните обсуждение заявки</b><span>Здесь удобно запросить документ, уточнить сумму или зафиксировать решение банка.</span></div>}</div>
    {error && <p className="ps-chat-error">{error}</p>}
    <form onSubmit={send}><input ref={attachment} hidden type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx" onChange={(event) => void attachFile(event)} /><button type="button" title="Прикрепить документ" onClick={() => attachment.current?.click()} disabled={sending}><Paperclip /></button><input aria-label="Сообщение" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Сообщение брокеру…" /><button aria-label="Отправить сообщение" disabled={sending || !value.trim()}>{sending ? <LoaderCircle className="spin" /> : <Send />}</button></form>
    <footer><FileUp /> Вложения сохраняются в досье и привязываются к этой заявке.</footer>
  </section></div>;
}
