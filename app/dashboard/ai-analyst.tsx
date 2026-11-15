"use client";

import { AlertTriangle, LoaderCircle, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string; evidence?: {title:string;text:string;metrics:string[];evidence:{source:string;periodFrom:string|null;periodTo:string|null;asOf:string|null}[]}[] };

const sourceNames:Record<string,string>={BANK_STATEMENT:"Банковская выписка",FINANCIAL_STATEMENT:"Бухгалтерская отчётность",CREDIT_HISTORY:"Отчёт БКИ",LEGAL_SOURCE:"Юридические сведения",CREDIT_PORTFOLIO:"Кредитный портфель",CLIENT_DECLARATION:"Сведения клиента",RECONCILIATION:"Сверка источников",DERIVED_ANALYTICS:"Расчёт Prescore",OTHER:"Другой источник"};
const quickQuestions = [
  "Почему такая оценка Prescore?",
  "Что мешает финансированию?",
  "Как рассчитана долговая ёмкость?",
  "Что изменится после добавления БКИ?",
  "Какой продукт подходит компании?",
  "Что нужно исправить перед заявкой?",
  "Какие источники противоречат друг другу?",
];

export default function AiAnalyst({ analysisId }: { analysisId: string }) {
  return <AnalystConversation key={analysisId} analysisId={analysisId} />;
}

function AnalystConversation({ analysisId }: { analysisId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState("rules");
  const alive = useRef(true);
  const pending = useRef<AbortController|null>(null);
  const version = useRef<string | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    alive.current = true;
    fetch(`/api/ai-analyst?analysisId=${encodeURIComponent(analysisId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { available?: boolean; messages?: Message[]; version?:string; mode?: string; error?: string };
        if (!response.ok) throw new Error(body.error || "Аналитик временно недоступен");
        if (controller.signal.aborted) return;
        version.current=body.version;
        setMode(body.mode ?? "rules");
        setAvailable(Boolean(body.available)); setMessages(body.messages ?? []);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Аналитик временно недоступен");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { alive.current = false; controller.abort();pending.current?.abort(); };
  }, [analysisId,reload]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const value = question.trim();
    if (value.length < 3 || pending.current || !available) return;
    const controller=new AbortController();
    pending.current=controller;
    const local: Message = { id: `local-${Date.now()}`, role: "user", content: value, createdAt: new Date().toISOString() };
    setMessages((items) => [...items, local]); setQuestion(""); setSending(true); setError("");
    try {
      const response = await fetch("/api/ai-analyst", { method: "POST", signal:controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId, question: value, version: version.current }) });
      const body = await response.json() as { message?: Message; mode?: string; error?: string };
      controller.signal.throwIfAborted();
      if(response.status===409 && alive.current){setMessages([]);setQuestion(value);setLoading(true);setReload(n=>n+1);return;}
      if (!response.ok || !body.message) throw new Error(body.error || "Аналитик не ответил");
      if (!alive.current) return;
      setMode(body.mode ?? "rules");
      setMessages((items) => [...items, body.message!]);
    } catch (caught) {
      if (!alive.current) return;
      setMessages((items) => items.filter((item) => item.id !== local.id));
      setQuestion(value);
      setError(controller.signal.aborted ? "Запрос отменён." : caught instanceof Error ? caught.message : "Кредитный аналитик временно недоступен. Сам анализ сохранён.");
    } finally { pending.current = null; if (alive.current) setSending(false); }
  }

  return <>
    <div className="ps-heading"><div><span>ОБЪЯСНЕНИЕ ГОТОВОГО РЕЗУЛЬТАТА</span><h1>Кредитный аналитик Prescore</h1><p>Задайте вопрос по результатам вашего анализа. Аналитик объясняет готовый результат Prescore, факторы, ограничения, кредитную ёмкость и рекомендации. Сам расчёт он не изменяет.</p></div></div>
    <section className="ps-ai-shell ps-card">
      <header><MessageSquareText /><span><b>Персональный разбор</b><small>Аналитик получает только подготовленный контекст Prescore. Сырые выписки, БКИ, реквизиты и внутренняя методика не передаются AI‑провайдеру.</small></span><i className={available ? "ready" : "offline"}>{loading ? "Загрузка" : available ? mode === "rules" ? "Локальный разбор" : "Доступен" : "Недоступен"}</i></header>
      <div className={'ps-ai-messages'+((loading||!messages.length)&&!sending?' is-idle':'')}>
        {loading && <div className="ps-ai-state"><LoaderCircle className="spin" /><b>Загружаем диалог…</b></div>}
        {!loading && available && !messages.length && <div className="ps-ai-empty"><MessageSquareText /><h2>Что хотите понять в анализе?</h2><p>Выберите быстрый вопрос или сформулируйте свой. Ответ будет опираться только на ваши рассчитанные показатели и доказательства.</p></div>}
        {messages.map((message) => <article key={message.id} className={message.role}><small>{message.role === "user" ? "Вы" : "Аналитик Prescore"}</small><p style={{overflowWrap:"anywhere"}}>{message.content}</p>{!!message.evidence?.length && <details><summary>Почему Prescore так считает</summary>{message.evidence.map((e,i)=><div key={i}><strong>{e.title}</strong><dl><dt>Источник</dt><dd>{e.evidence.map(r=>[sourceNames[r.source]??r.source,r.periodFrom,r.periodTo,r.asOf].filter(Boolean).join(' · ')).join(' / ')}</dd>{e.metrics.length>0&&<><dt>Показатели</dt><dd>{e.metrics.join(' · ')}</dd></>}<dt>Вывод Prescore</dt><dd>{e.text}</dd></dl></div>)}</details>}</article>)}
        {sending && <article className="assistant pending"><small>Аналитик Prescore</small><p><LoaderCircle className="spin" /> Проверяю выводы и источники…</p><button type="button" onClick={()=>pending.current?.abort()}>Отменить запрос</button></article>}
        <div ref={end} />
      </div>
      {error && <div className="ps-ai-error"><AlertTriangle />{error}</div>}
      <div className="ps-ai-chips">{quickQuestions.map((item) => <button key={item} disabled={!available || sending} onClick={() => setQuestion(item)}>{item}</button>)}</div>
      <form onSubmit={ask}><textarea aria-label="Вопрос кредитному аналитику" style={{minWidth:0}} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} placeholder={available ? "Например: что сейчас сильнее всего ограничивает финансирование?" : "Для аналитика нужен доступный полный анализ"} disabled={!available || sending} /><button disabled={!available || sending || question.trim().length < 3}><Send /> Отправить</button></form>
      <footer><ShieldCheck /> Ответы основаны на аналитике Prescore и не являются решением или гарантией конкретного кредитора.</footer>
    </section>
  </>;
}
