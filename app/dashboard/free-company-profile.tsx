"use client";

import { AlertTriangle, Building2, CheckCircle2, Landmark, LoaderCircle, LockKeyhole, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type PublicProfile = {
  company: { name: string; ogrn: string; status: string; registrationDate: string; okvedCode: string; okved: string; region: string; managers?: Array<{ name?: string; position?: string }>; smb?: string };
  publicRisks: { criticalStatus: boolean; enforcementDetected: boolean; legalEventsDetected: boolean; bankruptcyEventsDetected: boolean; attentionCount: number };
  contracts: { totalCount: number; activeCount: number; activeAmount: number; items: Array<{ number?: string; subject?: string; customer?: string; law?: string; amount?: number; status?: string }> };
  error?: string;
};

const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
const age = (value: string) => value && !Number.isNaN(new Date(value).getTime()) ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 31_556_952_000)) : null;

export default function FreeCompanyProfile({ analysisId, inn, companyName, createGuarantee }: { analysisId: string; inn: string; companyName: string; createGuarantee: (contract: PublicProfile["contracts"]["items"][number] | undefined) => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/checko?inn=${encodeURIComponent(inn)}&analysisId=${encodeURIComponent(analysisId)}${refresh ? "&refresh=1" : ""}`);
      const body = await response.json() as PublicProfile;
      if (!response.ok) throw new Error(body.error || "Не удалось получить открытые сведения");
      setProfile(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Источник временно недоступен"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/checko?inn=${encodeURIComponent(inn)}&analysisId=${encodeURIComponent(analysisId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as PublicProfile;
        if (!response.ok) throw new Error(body.error || "Не удалось получить открытые сведения");
        return body;
      })
      .then(setProfile)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Источник временно недоступен");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [analysisId, inn]);

  return <>
    <div className="ps-heading"><div><span>БАЗОВАЯ ОТКРЫТАЯ ПРОВЕРКА · FREE</span><h1>Компания и очевидные публичные признаки</h1><p>FREE показывает основные регистрационные сведения и факт наличия событий. Глубокая правовая и кредитная интерпретация остаётся в FULL.</p></div><button className="ps-outline-button" onClick={() => void load(true)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Обновить</button></div>
    {loading && !profile && <div className="ps-loading"><LoaderCircle className="spin" /><b>Получаем открытые данные по ИНН…</b></div>}
    {error && <div className="ps-warning"><AlertTriangle />{error}</div>}
    {profile && <>
      <section className="ps-card ps-checko-company"><div className="ps-checko-logo"><Building2 /></div><div><span>ИНН {inn} · ОГРН {profile.company.ogrn || "—"}</span><h2>{profile.company.name || companyName}</h2><p>{profile.company.okvedCode ? `${profile.company.okvedCode} · ` : ""}{profile.company.okved || "Основной вид деятельности не указан"}</p></div><aside><small>СТАТУС</small><b className={/действ/i.test(profile.company.status) ? "good" : "warn"}>{profile.company.status || "Не указан"}</b><span>Регистрация: {profile.company.registrationDate || "—"}</span></aside></section>
      <section className="ps-card"><div className="ps-finance-table"><span><small>Возраст бизнеса</small><b>{age(profile.company.registrationDate) == null ? "Нет данных" : `${age(profile.company.registrationDate)} лет`}</b></span><span><small>Регион</small><b>{profile.company.region || "Нет данных"}</b></span><span><small>Руководитель</small><b>{profile.company.managers?.[0]?.name || "Нет данных"}</b></span><span><small>Реестр МСП</small><b>{profile.company.smb || "Сведения не найдены"}</b></span></div></section>
      <section className="ps-card"><div className="ps-card-title"><span><b>Базовые публичные признаки</b><small>Показывается факт наличия события без глубокой квалификации</small></span></div><div className="ps-signal-list">{([
        ["Критический регистрационный статус", profile.publicRisks.criticalStatus],
        ["Исполнительные производства", profile.publicRisks.enforcementDetected],
        ["Судебные события", profile.publicRisks.legalEventsDetected],
        ["Банкротные сообщения", profile.publicRisks.bankruptcyEventsDetected],
      ] as Array<[string, boolean]>).map(([label, detected]) => <div key={label} className={detected ? "warning" : "info"}>{detected ? <AlertTriangle /> : <CheckCircle2 />}<span><b>{label}</b><small>{detected ? "Обнаружены факторы, требующие дополнительной оценки" : "Существенные очевидные признаки не обнаружены"}</small></span></div>)}</div></section>
      {profile.contracts.activeCount > 0 && <section className="ps-card ps-critical-banner"><Landmark /><span><b>Вы победили в закупке или исполняете контракт</b><small>{profile.contracts.activeCount} активных записей · {money(profile.contracts.activeAmount)}. Можно бесплатно создать предзаявку на банковскую гарантию.</small></span><button onClick={() => window.confirm("Создать бесплатную предзаявку на банковскую гарантию по найденному контракту?") && createGuarantee(profile.contracts.items[0])}>Подать заявку на БГ</button><div className="ps-history">{profile.contracts.items.map((item, index) => <span key={`${item.number}-${index}`}><b>{item.number || "Закупка"}</b><small>{item.customer || "Заказчик"} · {item.subject || "предмет не указан"} · {money(item.amount || 0)} · {item.status || "активна"}</small></span>)}</div></section>}
      <section className="ps-card ps-next-action"><span><LockKeyhole /> PRESCORE FULL</span><h2>{profile.publicRisks.attentionCount} факторов требуют экспертной оценки</h2><p>FULL раскроет суммы, роли, актуальность событий, влияние на финансирование, полный правовой профиль и действия до подачи.</p><a href={`/checkout?analysisId=${encodeURIComponent(analysisId)}`}>Открыть полный кредитный анализ</a></section>
    </>}
  </>;
}
