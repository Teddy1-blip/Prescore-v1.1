"use client";

import Link from "next/link";
import { ArrowRight, BadgeRussianRuble, Check, CheckCircle2, LockKeyhole, Network, ShieldCheck, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import "./agent-referral.css";
import "./agent-referral-polish.css";
import "../../prescore-ui-v1.css";

export default function AgentReferralPage() {
  const params = useParams<{ code: string }>();
  const curatorCode = String(params?.code || "AGENT-ANTON-001").toUpperCase();
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [agentCode, setAgentCode] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "subagent", agentCode: curatorCode, name: form.get("name"), agency: form.get("agency"), city: form.get("city"), phone: form.get("phone"), email: form.get("email"), consent: form.get("consent") === "on" }) });
    const body = await response.json() as { error?: string; agentCode?: string };
    if (!response.ok || !body.agentCode) { setError(body.error || "Не удалось зарегистрировать агента"); setSaving(false); return; }
    setAgentCode(body.agentCode); setSaving(false);
  }
  return <main className="ar-shell"><section className="ar-story"><Link href="/" className="ar-brand">Прескор</Link><div><span><Network /> ПРИГЛАШЕНИЕ В ПАРТНЁРСКУЮ СЕТЬ</span><h1>Ведите клиентов к финансированию в своём кабинете.</h1><p>Получайте 30% с каждого оплаченного FULL-анализа привлечённого клиента. Куратор помогает подключиться, но не получает доступа к вашим клиентам.</p><div className="ar-income"><article><BadgeRussianRuble /><small>ВАШ ДОХОД</small><b>1 950 ₽</b><p>30% от заказа 6 500 ₽ каждого вашего клиента</p></article><article><UsersRound /><small>КУРАТОРУ</small><b>650 ₽</b><p>10% второго уровня, без уменьшения ваших 30%</p></article></div><ul><li><Check /> Собственная CRM, заявки и банковская воронка</li><li><Check /> Полное аналитическое досье ваших клиентов</li><li><LockKeyhole /> Куратор видит только количество и финансовые агрегаты</li></ul></div><small>Код куратора: {curatorCode}</small></section><section className="ar-panel">{agentCode ? <div className="ar-success"><CheckCircle2 /><span>ЗАЯВКА НА ПОДКЛЮЧЕНИЕ СОХРАНЕНА</span><h2>Ваш код: {agentCode}</h2><p>Карточка появилась у куратора со статусом «На подключении». Войдите в существующую учётную запись с указанной почтой или подтвердите новую, затем подключите профиль агента. Повторная регистрация клиенту не нужна.</p><Link href={"/login?returnTo=" + encodeURIComponent("/agent?invitation=" + agentCode)}>Войти и подключить профиль <ArrowRight /></Link></div> : <form onSubmit={submit}><span>РЕГИСТРАЦИЯ АГЕНТА</span><h2>Присоединиться к Прескор</h2><p>Регистрация не требует передачи клиентской базы куратору.</p><label>Имя и фамилия<input name="name" required /></label><label>Компания или статус<input name="agency" placeholder="ООО, ИП или частный агент" /></label><label>Город<input name="city" /></label><div className="ar-grid"><label>Телефон<input name="phone" type="tel" /></label><label>Email<input name="email" type="email" /></label></div><label className="ar-consent"><input type="checkbox" name="consent" required /><span>Даю <Link href="/consent" target="_blank">согласие на обработку данных</Link>, принимаю условия <Link href="/offer" target="_blank">оферты</Link> и ознакомлен(а) с <Link href="/privacy" target="_blank">Политикой конфиденциальности</Link>. Понимаю, что выплаты рассчитываются только с фактически оплаченных заказов.</span></label>{error && <p className="ar-error">{error}</p>}<button disabled={saving}>{saving ? "Регистрирую…" : <>Стать агентом <ArrowRight /></>}</button><small><ShieldCheck /> Клиенты, документы и банковские заявки не раскрываются куратору.</small></form>}</section></main>;
}
