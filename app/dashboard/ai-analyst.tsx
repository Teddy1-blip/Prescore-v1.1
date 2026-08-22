"use client";

import { AlertTriangle, LoaderCircle, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

const quickQuestions = [
  "Почему у меня такой рейтинг?",
  "Что мешает больше всего?",
  "Что сделать первым?",
  "Стоит ли подаваться сейчас?",
  "Что хорошего в моём профиле?",
  "Объяснить кредитную нагрузку",
  "Объяснить план 7/30/60",
  "Почему рекомендован этот продукт?",
];

export default function AiAnalyst({ analysisId }: { analysisId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ai-analyst?analysisId=${encodeURIComponent(analysisId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { available?: boolean; messages?: Message[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Аналитик временно недоступен");
        setAvailable(Boolean(body.available)); setMessages(body.messages ?? []);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Аналитик временно недоступен");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [analysisId]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const value = question.trim();
    if (!value || sending || !available) return;
    const local: Message = { id: `local-${Date.now()}`, role: "user", content: value, createdAt: new Date().toISOString() };
    setMessages((items) => [...items, local]); setQuestion(""); setSending(true); setError("");
    try {
      const response = await fetch("/api/ai-analyst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId, question: value }) });
      const body = await response.json() as { message?: Message; error?: string };
      if (!response.ok || !body.message) throw new Error(body.error || "Аналитик не ответил");
      setMessages((items) => [...items, body.message!]);
    } catch (caught) {
      setMessages((items) => items.filter((item) => item.id !== local.id));
      setQuestion(value);
      setError(caught instanceof Error ? caught.message : "Кредитный аналитик временно недоступен. Сам анализ сохранён.");
    } finally { setSending(false); }
  }

  return <>
    <div className="ps-heading"><div><span>ОБЪЯСНЕНИЕ ГОТОВОГО РЕЗУЛЬТАТА</span><h1>Кредитный аналитик Prescore</h1><p>Задайте вопрос по результатам вашего анализа. Аналитик объясняет уже рассчитанный Risk Context, но не меняет score, стоп‑факторы и расчётный диапазон.</p></div></div>
    <section className="ps-ai-shell ps-card">
      <header><MessageSquareText /><span><b>Персональный разбор</b><small>Сырые выписки, БКИ, реквизиты и внутренняя методика не передаются AI‑провайдеру.</small></span><i className={available ? "ready" : "offline"}>{available ? "Доступен" : "Не подключён"}</i></header>
      <div className="ps-ai-messages">
        {loading && <div className="ps-ai-state"><LoaderCircle className="spin" /><b>Загружаем диалог…</b></div>}
        {!loading && !messages.length && <div className="ps-ai-empty"><MessageSquareText /><h2>Что хотите понять в анализе?</h2><p>Выберите быстрый вопрос или сформулируйте свой. Ответ будет опираться только на ваши рассчитанные показатели и доказательства.</p></div>}
        {messages.map((message) => <article key={message.id} className={message.role}><small>{message.role === "user" ? "Вы" : "Аналитик Prescore"}</small><p>{message.content}</p></article>)}
        {sending && <article className="assistant pending"><small>Аналитик Prescore</small><p><LoaderCircle className="spin" /> Проверяю выводы и источники…</p></article>}
        <div ref={end} />
      </div>
      {error && <div className="ps-ai-error"><AlertTriangle />{error}</div>}
      <div className="ps-ai-chips">{quickQuestions.map((item) => <button key={item} disabled={!available || sending} onClick={() => setQuestion(item)}>{item}</button>)}</div>
      <form onSubmit={ask}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} placeholder={available ? "Например: что сейчас сильнее всего ограничивает финансирование?" : "AI‑аналитик будет доступен после подключения провайдера"} disabled={!available || sending} /><button disabled={!available || sending || question.trim().length < 3}><Send /> Отправить</button></form>
      <footer><ShieldCheck /> Ответы основаны на аналитике Prescore и не являются решением или гарантией конкретного кредитора.</footer>
    </section>
  </>;
}
