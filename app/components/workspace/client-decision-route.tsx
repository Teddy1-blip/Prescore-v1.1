"use client";

import type { WorkspaceModelV1 } from "../../../lib/workspace/model";
import type { PresentationActionV1, PresentationFactorV1 } from "../../../lib/credit-engine/contracts/client-report";
import { publicText as clientText } from "../../../lib/credit-engine/client-report/copy";
import {decisionRoute} from '../../../lib/credit-engine/client-report/route';
import { money } from "./presentation";
import { orderedNextSource } from "./source-operations";

export type ClientDecisionCode = "READY_FOR_FINANCING" | "NEEDS_PREPARATION" | "INSUFFICIENT_DATA";

type ClientDecisionTarget = "applications" | "analysis" | "documents" | "obligations";

type ClientDecisionCta = {
  label: string;
  view: ClientDecisionTarget;
  section?: "plan";
  anchor?: string;
};

export type ClientDecisionRouteV1 = {
  code: ClientDecisionCode;
  label: string;
  title: string;
  summary: string;
  tone: "positive" | "attention" | "critical" | "data";
  details: string[];
  tasks: PresentationActionV1[];
  cta: ClientDecisionCta;
};

function uniqueActions(model: WorkspaceModelV1): PresentationActionV1[] {
  const report = model.full?.report;
  if (!report) return [];
  const focusIds = new Set(report.actionPlan.focusIds);
  const focus = report.actionPlan.horizons.flatMap((horizon) => horizon.items).filter((item) => focusIds.has(item.id));
  const candidates = [...report.recommendations.primary, ...focus, ...report.recommendations.backlog];
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = item.canonicalId || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function uniqueFactorDetails(factors: PresentationFactorV1[]): string[] {
  const seen = new Set<string>();
  const details: string[] = [];
  for (const factor of factors) {
    const text = clientText(factor.title || factor.text).trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    details.push(text);
    if (details.length === 3) break;
  }
  return details;
}

function missingDataDecision(model: WorkspaceModelV1): ClientDecisionRouteV1 {
  const report = model.full?.report;
  const next = orderedNextSource(model);
  const cta: ClientDecisionCta = next.code === "ANALYSIS"
    ? { label: "Проверить ограничения данных", view: "analysis" }
    : { label: next.label, view: next.view, anchor: next.anchor };
  const details = report
    ? uniqueFactorDetails([...report.dataQuality, ...report.limitations, ...report.readiness.constraints])
    : [];
  if (!details.length) details.push("Для надёжного заключения не хватает подтверждённых финансовых или долговых данных.");
  return {
    code: "INSUFFICIENT_DATA",
    label: "НЕДОСТАТОЧНО ДАННЫХ",
    title: "Сначала дополните кредитное досье",
    summary: "Prescore сохранил подтверждённые факты, но пока не может надёжно завершить оценку готовности и долговой нагрузки.",
    tone: "data",
    details,
    tasks: [],
    cta,
  };
}

function preparationDecision(model: WorkspaceModelV1, globalStop: boolean): ClientDecisionRouteV1 {
  const report = model.full!.report;
  const risks = [...report.primaryFactors, ...report.readiness.constraints, ...report.limitations]
    .filter((factor) => ["critical", "attention", "data"].includes(factor.status.tone));
  const details = uniqueFactorDetails(risks);
  if (!details.length) details.push("Перед подачей заявки выполните приоритетные действия из плана Prescore.");
  return {
    code: "NEEDS_PREPARATION",
    label: "НУЖНА ПОДГОТОВКА",
    title: globalStop ? "Сначала устраните критичное ограничение" : "Перед подачей заявки нужна подготовка",
    summary: clientText(report.hero.summary),
    tone: globalStop ? "critical" : "attention",
    details,
    tasks: uniqueActions(model),
    cta: { label: "Открыть план улучшения", view: "analysis", section: "plan" },
  };
}

function readyDecision(model: WorkspaceModelV1): ClientDecisionRouteV1 {
  const full = model.full!;
  const report = full.report;
  const readiness = full.canonical.financingReadiness;
  const capacity = full.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential;
  const details: string[] = [];
  if (typeof capacity === "number" && Number.isFinite(capacity) && capacity > 0) {
    details.push(`Осторожная оценка дополнительного платежа: ${money(capacity)} в месяц.`);
  }
  const product = report.productFit.primary[0];
  if (product) details.push(`Основной подходящий механизм: ${clientText(product.title)}.`);
  const constraint = report.readiness.constraints.find((factor) => ["critical", "attention", "data"].includes(factor.status.tone));
  if (readiness.level === "MEDIUM" && constraint) details.push(`Ограничение для учёта: ${clientText(constraint.title)}.`);
  if (!details.length) details.push("Кредитный профиль позволяет перейти к подготовке заявки с учётом опубликованных ограничений.");
  return {
    code: "READY_FOR_FINANCING",
    label: "ГОТОВ К ФИНАНСИРОВАНИЮ",
    title: readiness.level === "HIGH" ? "Можно переходить к подготовке финансирования" : "Можно готовить заявку с учётом ограничений",
    summary: clientText(report.hero.summary),
    tone: "positive",
    details,
    tasks: [],
    cta: { label: "Создать заявку на финансирование", view: "applications" },
  };
}

export function resolveClientDecisionRoute(model: WorkspaceModelV1): ClientDecisionRouteV1 {
  const full = model.full;
  if (!full) return missingDataDecision(model);

  const report = full.report;
  const readiness = full.canonical.financingReadiness;
  const assessment = full.canonical.creditAssessment;
  const capacity = full.canonical.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential;
  const globalStop = report.hero.globalStop || assessment.globalStop.status === "PRESENT" || assessment.status === "NOT_RATABLE_GLOBAL_STOP";

  const code=report.hero.route ?? decisionRoute(report,readiness,assessment,capacity);
  if(code==='READY_FOR_FINANCING') return readyDecision(model);
  if(code==='INSUFFICIENT_DATA') return missingDataDecision(model);
  return preparationDecision(model,globalStop);
}

export function ClientDecisionRoute({ model, choose }: { model: WorkspaceModelV1; choose: (view: string) => void }) {
  const route = resolveClientDecisionRoute(model);
  const broker=model.access.role==='ASSIGNED_BROKER';

  function openRoute() {
    const url = new URL(window.location.href);
    if (route.cta.section) url.searchParams.set("section", route.cta.section);
    else url.searchParams.delete("section");
    url.hash = route.cta.anchor ? route.cta.anchor : "";
    window.history.replaceState(null, "", url);
    choose(route.cta.view);
    if (route.cta.anchor) {
      window.setTimeout(() => document.getElementById(route.cta.anchor!)?.scrollIntoView({ block: "start" }), 0);
    }
  }

  return <section className={`pc-panel pc-decision-route tone-${route.tone}`} data-client-route={route.code}>
    <header>
      <div>
        <small>ИТОГОВЫЙ МАРШРУТ PRESCORE</small>
        <h2>{route.title}</h2>
      </div>
      <span className="pc-status">{route.label}</span>
    </header>
    <p>{route.summary}</p>
    {route.details.length > 0 && <details className="pc-route-basis">
      <summary>Основания заключения</summary>
      <ul>{route.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
    </details>}
    <button className="pc-primary" data-client-route-cta={route.code} onClick={broker?()=>choose('analysis'):openRoute}>{broker?'Открыть заключение':route.cta.label}</button>
    <p className="pc-muted">Это маршрут подготовки, а не решение банка и не гарантия одобрения.</p>
  </section>;
}
