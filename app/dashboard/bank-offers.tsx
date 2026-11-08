"use client";

import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CircleDollarSign, FileSearch, Landmark, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalysisResult } from "../../lib/prescore";
import type { FinancialAssessment } from "../../lib/company-profile";
import type { BankRoute, BankRouteStatus } from "../../lib/bank-offers";
import { financingNeedLabels, fundingKindLabels, type FinancingNeed, type FundingKind } from "../../lib/financing-types";

type StoredAnalysis = Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] };
const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
type OfferResult = { routes: BankRoute[]; assessment: FinancialAssessment | null; inferredNeeds: FinancingNeed[]; contractDetected: boolean; servicingBanks: string[]; excludedCount: number; fullRouteCount: number; blocked: boolean; blockedBy: string[]; termsDate: string; riskCode: string; readOnly?: boolean };

export default function BankOffers({ analysis, onSubmitApplications }: { analysis: StoredAnalysis | null; onSubmitApplications: (items: Array<{ bank: string; product: string; amount: number }>) => Promise<void> }) {
  const [loading, setLoading] = useState(Boolean(analysis?.companyInn));
  const [result, setResult] = useState<OfferResult | null>(null);
  const [filter, setFilter] = useState<"all" | BankRouteStatus>("all");
  const [kindFilter, setKindFilter] = useState<"all" | FundingKind>("all");
  const [need, setNeed] = useState<FinancingNeed>("auto");
  const [error, setError] = useState("");
  const [selectedRoutes, setSelectedRoutes] = useState<Record<string, string>>({});
  const [applicationConsent, setApplicationConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!analysis?.id) return;
    const controller = new AbortController();
    fetch(`/api/offers?analysisId=${encodeURIComponent(analysis.id)}&need=${encodeURIComponent(need)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as OfferResult & { error?: string };
        if (!response.ok) throw new Error(body.error || "Не удалось подобрать маршруты");
        return body;
      })
      .then(setResult)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Не удалось подобрать маршруты");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [analysis?.id, need]);
  if (!analysis) return <div className="ps-checko-empty"><Landmark /><h1>Сначала проведите анализ компании</h1><p>После объединения выписок и БФО Прескор покажет предварительный маршрут по банкам.</p></div>;
  if (loading && !result) return <div className="ps-checko-loading"><LoaderCircle className="spin" /><b>Сопоставляем выписки, БФО, БКИ и требования партнёров…</b><span>Проверяем единый Risk Context, стаж, регион, цель и долговую ёмкость.</span></div>;
  if (!result) return null;

  const counts = {
    go: result.routes.filter((item) => item.status === "go").length,
    conditional: result.routes.filter((item) => item.status === "conditional").length,
    stop: result.routes.filter((item) => item.status === "stop").length,
  };
  const activeKindFilter = kindFilter === "all" || result.routes.some((route) => route.kind === kindFilter) ? kindFilter : "all";
  const shown = result.routes.filter((item) => (filter === "all" || item.status === filter) && (activeKindFilter === "all" || item.kind === activeKindFilter));
  const kindCounts = result.routes.reduce<Partial<Record<FundingKind, number>>>((total, route) => ({ ...total, [route.kind]: (total[route.kind] ?? 0) + 1 }), {});
  const selectedItems = result.routes.filter((route) => selectedRoutes[route.id]).map((route) => ({ bank: route.bank, product: selectedRoutes[route.id], amount: route.amount }));

  function toggleRoute(id: string, product: string) {
    setSelectedRoutes((current) => {
      if (current[id]) { const next = { ...current }; delete next[id]; return next; }
      return { ...current, [id]: product };
    });
  }

  async function submitApplications() {
    if (!selectedItems.length || !applicationConsent) return;
    setSubmitting(true); setError("");
    try { await onSubmitApplications(selectedItems); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось создать заявки"); }
    finally { setSubmitting(false); }
  }

  return <>
    <div className="ps-heading"><div><span>АДРЕСНЫЙ ПОДБОР ФИНАНСИРОВАНИЯ</span><h1>Куда можно обращаться</h1><p>Показаны только маршруты, которые соответствуют выявленной потребности и не отсечены параметрами компании. Специальные продукты появляются лишь при подтверждённом сигнале из выписок, БФО, БКИ или официальных реестров.</p></div></div>
    {error && <div className="ps-warning"><AlertTriangle />Маршруты не сформированы: {error}</div>}
    {result.blocked && <div className="ps-critical-banner"><AlertTriangle /><span><b>Положительные предложения скрыты: в едином заключении действует глобальный стоп.</b><small>{result.blockedBy.join(" · ")}. Сначала проверьте источники и выполните план подготовки.</small></span></div>}
    <div className="ps-route-summary">
      <article className="go"><CheckCircle2 /><span><small>МОЖНО РАССМАТРИВАТЬ</small><strong>{counts.go}</strong><em>формальные фильтры предварительно пройдены</em></span></article>
      <article className="conditional"><FileSearch /><span><small>ПОСЛЕ ПРОВЕРКИ</small><strong>{counts.conditional}</strong><em>нужны документы, пояснение или уточнение</em></span></article>
      <article className="stop"><AlertTriangle /><span><small>ОТСЕЯНО ПО ПАРАМЕТРАМ</small><strong>{result.excludedCount}</strong><em>не показываются среди предложений</em></span></article>
      <article><CircleDollarSign /><span><small>РАСЧЁТНАЯ ПОТРЕБНОСТЬ</small><strong>{money(analysis.creditPortfolioComparison?.adjustedLimitMax ?? analysis.metrics.estimatedLimitMax)}</strong><em>не является лимитом партнёра</em></span></article>
    </div>

    <section className="ps-card ps-route-context">
      <div><ShieldCheck /><span><small>ПРОФИЛЬ ДЛЯ СОПОСТАВЛЕНИЯ</small><b>{analysis.companyName}</b><em>ИНН {analysis.companyInn} · B‑Score {analysis.score} · F‑Score {result.assessment?.fScore ?? "недостаточно данных"}</em></span></div>
      <div className="ps-route-filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Рекомендовано {result.routes.length}</button>
        <button className={filter === "go" ? "active" : ""} onClick={() => setFilter("go")}>Можно {counts.go}</button>
        <button className={filter === "conditional" ? "active" : ""} onClick={() => setFilter("conditional")}>Условно {counts.conditional}</button>
      </div>
    </section>

    <section className="ps-card ps-need-matrix">
      <div><small>ЗАДАЧА КЛИЕНТА</small><h2>Выбор подходящего продукта</h2><p>Автоподбор использует факты из данных. Цель можно уточнить вручную — условия и стопы пересчитаются, но неподтверждённые специальные продукты не появятся.</p></div>
      <div>{(Object.entries(financingNeedLabels) as Array<[FinancingNeed, string]>).map(([id, label]) => <button key={id} className={need === id ? "active" : ""} onClick={() => setNeed(id)}>{label}</button>)}</div>
      <aside><span className="detected"><b>Обнаружено:</b>{result.inferredNeeds.filter((item) => item !== "working-capital" && item !== "staged-limit").map((item) => <em key={item}>{financingNeedLabels[item]}</em>)}</span><span><b>Источники:</b><em>выписки</em><em>БФО</em><em>БКИ</em>{result.contractDetected && <em>реестр госконтрактов</em>}</span></aside>
    </section>

    <section className="ps-card ps-provider-filters">
      <button className={activeKindFilter === "all" ? "active" : ""} onClick={() => setKindFilter("all")}>Все <i>{result.routes.length}</i></button>
      {(Object.entries(fundingKindLabels) as Array<[FundingKind, string]>).filter(([id]) => (kindCounts[id] ?? 0) > 0).map(([id, label]) => <button key={id} className={activeKindFilter === id ? "active" : ""} onClick={() => setKindFilter(id)}>{label} <i>{kindCounts[id] ?? 0}</i></button>)}
    </section>

    <div className="ps-servicing-banks"><Landmark /><span><b>Обслуживающие банки по загруженным выпискам</b><p>{result.servicingBanks.length ? result.servicingBanks.join(" · ") : "Банк не распознан — проверьте заголовок TXT или имя исходного файла."}</p><small>Внешние реестры используются для БФО, правового контура и госконтрактов, но не раскрывают счета конкретной компании. Поэтому обслуживающие банки определяются только по предоставленным выпискам.</small></span></div>

    <div className="ps-bank-routes">{shown.map((route) => <article className={`ps-card ${route.status} ${route.needMatch ? "need-match" : ""} ${selectedRoutes[route.id] ? "selected" : ""}`} key={route.id}>
      <header>{!result.readOnly && <label className="ps-route-select"><input type="checkbox" checked={Boolean(selectedRoutes[route.id])} onChange={() => toggleRoute(route.id, route.recommendedProduct)} /><span>{selectedRoutes[route.id] ? "Выбрано" : "Выбрать"}</span></label>}<div className="ps-bank-logo"><Building2 /></div><span><small>{route.kindLabel} · {route.statusLabel}</small><h2>{route.bank}</h2><em>{route.geography}</em>{route.existingRelationship && <i className="ps-existing-bank"><CheckCircle2 /> Уже есть выписка этого банка</i>}</span><b>{route.amount ? `ориентир до ${money(route.amount)}` : route.limitLabel}</b></header>
      <div className="ps-smart-product"><span><small>РЕКОМЕНДОВАННЫЙ СЦЕНАРИЙ</small><b>{route.recommendedProduct}</b><em>{route.activityReason}</em></span>{selectedRoutes[route.id] && <label>Продукт<select value={selectedRoutes[route.id]} onChange={(event) => setSelectedRoutes((current) => ({ ...current, [route.id]: event.target.value }))}>{[...new Set([route.recommendedProduct, ...route.products])].map((product) => <option key={product}>{product}</option>)}</select></label>}</div>
      <div className="ps-bank-product-list">{route.products.map((product) => <span key={product}>{product}</span>)}</div>
      <div className="ps-bank-terms"><span><small>Срок</small><b>{route.term}</b></span><span><small>Ориентир ставки</small><b>{route.rate}</b></span><span><small>Диапазон программы</small><b>{route.limitLabel}</b></span></div>
      <p className="ps-route-comment">{route.comment}</p>
      <div className="ps-bank-reasons"><b>Почему такой статус</b>{route.reasons.map((reason) => <p key={reason}><i />{reason}</p>)}</div>
      {route.actions.length > 0 && <div className="ps-bank-actions"><b>Что сделать</b>{route.actions.map((action) => <p key={action}><ArrowRight />{action}</p>)}</div>}
    </article>)}</div>

    {!result.readOnly && <section className={`ps-application-tray ps-card ${selectedItems.length ? "active" : ""}`}>
      <div><Send /><span><small>ПАКЕТНАЯ ПОДАЧА</small><h2>{selectedItems.length ? `Выбрано маршрутов: ${selectedItems.length}` : "Выберите банки в карточках выше"}</h2><p>{selectedItems.length ? selectedItems.map((item) => `${item.bank} — ${item.product}`).join(" · ") : "Банк, продукт и расчётная сумма попадут в раздел «Заявки в банки» и одновременно в кабинет агента."}</p></span></div>
      <label className="ps-application-consent"><input type="checkbox" checked={applicationConsent} onChange={(event) => setApplicationConsent(event.target.checked)} /><span><b>Подтверждаю создание заявок выбранным получателям</b><small>Я вправе действовать по данным компании и согласен(на) на подготовку передачи выбранным банкам/партнёрам. Фактическую отправку документов брокер выполняет после проверки комплекта и полномочий.</small></span></label>
      <button disabled={!selectedItems.length || !applicationConsent || submitting} onClick={() => void submitApplications()}>{submitting ? <><LoaderCircle className="spin" /> Создаём…</> : <><Send /> Подать выбранные заявки</>}</button>
    </section>}

    <div className="ps-analytic-note"><ShieldCheck /><span><b>Правовой статус маршрутов</b><small>Сведения носят исключительно информационно-аналитический характер. Это не индивидуальное предложение банка, МФО, фактора или лизинговой компании, не заявка, не одобрение, не публичная оферта и не гарантия выдачи финансирования. Расчёт выполнен по данным выписок, БФО, БКИ, официальных реестров и условиям партнёров от {result.termsDate}. Решение, лимит, ставка, срок, полная стоимость и обеспечение определяются партнёром после собственной проверки; условия перепроверяются перед обращением. Передача данных возможна только после отдельного согласия клиента.</small></span></div>
  </>;
}
