import type { WorkspaceModelV1, WorkspaceFactV1 } from '../../../../lib/workspace/model';
import { cashValue } from '../../../../lib/workspace/cash-series';
import { colorList, money, type Amount, type ViewData, type Page } from './types';
import { sourceLabel, sourceState, label } from '../credit-depth';
import { date } from '../presentation';
import { numeric } from '../client-financials';
import { publicText } from '../../../../lib/credit-engine/client-report/copy';

const amount = (f?: WorkspaceFactV1): Amount =>
  f && ['KNOWN', 'PARTIAL'].includes(f.status) && typeof f.value === 'number' && Number.isFinite(f.value)
    ? f.value
    : null;
const number = (n: unknown): Amount => (typeof n === 'number' && Number.isFinite(n) ? n : null);
export function liveView(model: WorkspaceModelV1 | null, name: string, month: string): ViewData {
  const b = model?.basic.bankingFacts,
    report = model?.full?.report,
    range = model?.basic.analysis.period;
  const period = month || (range && date(range.from) + ' — ' + date(range.to)) || 'Период выписки';
  const monthly = b?.monthly ?? [],
    months = monthly
      .filter((r) => !month || r.month === month)
      .map((r) => ({
        id: r.month,
        label: r.month,
        coverage: r.coverage,
        operating: cashValue(r, 'operatingReceipts'),
        incoming: cashValue(r, 'externalInflows'),
        outgoing: cashValue(r, 'externalOutflows'),
        net: cashValue(r, 'netExternal'),
        debt: cashValue(r, 'debtService'),
        tax: cashValue(r, 'taxPayments'),
      }));
  const m = month ? months[0] : undefined;
  const incoming = month ? (m?.incoming ?? null) : amount(b?.grossInflow),
    outgoing = month ? (m?.outgoing ?? null) : amount(b?.grossOutflow);
  // Tax+social and debt service are disjoint primary economic categories in the monthly classifier.
  // Show the residual only when every month and the denominator reconcile to the selected external outflow.
  const complete =
    months.length > 0 &&
    months.every(
      (r) => r.tax !== null && r.debt !== null && r.outgoing !== null && r.debt + r.tax <= r.outgoing + 0.005,
    );
  const total = (k: 'tax' | 'debt' | 'outgoing') =>
    months.reduce((s, r) => s + Math.round(r[k]! * 100), 0) / 100;
  const showMix =
    complete &&
    outgoing !== null &&
    Math.abs(total('outgoing') - outgoing) < 0.005 &&
    total('tax') + total('debt') <= outgoing;
  const categories = showMix
    ? [
        { label: 'Налоги и взносы', value: total('tax'), color: colorList[2] },
        { label: 'Долг и лизинг', value: total('debt'), color: colorList[3] },
        {
          label: 'Остальные внешние списания',
          value: Math.round((outgoing! - total('tax') - total('debt')) * 100) / 100,
          color: colorList[0],
        },
      ]
    : [];
  const sheet = report?.financialAnalysis?.history.at(-1),
    portfolio = report?.analysisV3?.portfolio ?? [];
  const sources = (model?.basic.sources.availability ?? []).map((s) => ({
    label: sourceLabel(s.source),
    date: s.reportDate
      ? date(s.reportDate)
      : s.periodTo
        ? [s.periodFrom, s.periodTo].filter(Boolean).map(date).join(' — ')
        : 'Дата уточняется',
    status: sourceState(s.status),
    route: (s.source.includes('CREDIT')
      ? 'analysis'
      : s.source.includes('BANK') || s.source.includes('FINANCIAL') || s.source === 'QUARTERLY_REPORT'
        ? 'banking'
        : 'documents') as Page,
  }));
  const balance = b?.balanceCheck,
    principal = report?.analysisV3?.companyPrincipal;
  // Reuse canonical risk claims: never translate a Prescore risk into a bank's decision.
  // BASIC access has no risk summary, even if banking facts are available.
  const riskSummary = model?.full
    ? model.full.canonical.explainability.claims
        .filter(
          (claim) =>
            claim.riskFindingIds.length > 0 &&
            (claim.claimKind === 'FINDING' || claim.claimKind === 'DATA_LIMITATION') &&
            (claim.status === 'GLOBAL_STOP' || claim.status === 'CREDIT_RISK') &&
            !claim.claimCode.includes('SOURCE-MISSING'),
        )
        .map((claim) => ({
          id: claim.claimId,
          status: claim.status as 'GLOBAL_STOP' | 'CREDIT_RISK',
          title: publicText(claim.titleRu),
          detail: publicText(claim.textRu),
        }))
    : null;
  return {
    company: name,
    asOf: report?.meta.asOfDate ? date(report.meta.asOfDate) : '',
    period,
    plan: model?.entitlement ?? '',
    title: report?.hero.headline ?? (model ? 'Финансовая картина по выпискам' : 'Данные компании'),
    summary:
      report?.hero.summary ??
      (model
        ? 'Поступления, списания и остатки показаны по доступным банковским источникам.'
        : 'Добавьте источник, чтобы открыть финансовую картину.'),
    score: number(report?.index.value?.value),
    scoreStatus:
      report?.index.status ??
      (model?.entitlement === 'BASIC' ? 'Полный кредитный профиль доступен в FULL' : 'Ожидается расчёт'),
    components: (report?.index.components ?? []).flatMap((c) =>
      typeof c.score.value === 'number' && typeof c.maximum.value === 'number' && c.maximum.value > 0
        ? [{ label: c.label, score: c.score.value, max: c.maximum.value }]
        : [],
    ),
    capacity: report?.capacity.headline?.display ?? '',
    capacityText:
      report?.capacity.text ??
      'Для оценки дополнительного платежа нужны подтверждённые данные о долговых выплатах.',
    opening: !month && balance?.state === 'VERIFIED' ? balance.opening : null,
    closing: amount(b?.endingBalance),
    closingDate: b?.endingBalance.periodTo ? 'На ' + date(b.endingBalance.periodTo) : 'По данным выписок',
    operating: month ? (m?.operating ?? null) : amount(b?.operatingInflow),
    incoming,
    outgoing,
    net: month ? (m?.net ?? null) : amount(b?.netCashFlow),
    debt: number(principal?.value),
    debtDate: principal ? 'БКИ на ' + date(principal.asOf) : 'По договорам и датам БКИ',
    months,
    categories,
    tasks: (report?.actionPlan.horizons ?? []).flatMap((h) =>
      h.items.map((t) => ({
        id: h.id + '-' + t.id,
        title: t.title,
        detail: h.title + ' · ' + date(h.date) + ' · ' + t.summary,
        route: 'actions' as const,
      })),
    ),
    factors: (report?.primaryFactors ?? []).map((f) => ({ title: f.title, detail: f.text })),
    riskSummary,
    products: (report?.productFit.primary ?? []).map((p) => ({ title: p.title, detail: p.purpose })),
    fiscalDate: sheet?.period.asOf ? date(sheet.period.asOf) : '',
    bfo: (sheet?.groups ?? []).flatMap((g) =>
      g.metrics
        .filter((m) => m.value !== null && m.status !== 'UNKNOWN')
        .map((m) => [m.label, g.title, numeric(m.value, m.status, m.unit), date(m.asOf ?? m.periodTo)]),
    ),
    obligations: portfolio.map((o) => [
      String(o.creditor.value ?? label(o.type)),
      money(number(o.principal.value)),
      o.principal.asOf ? date(o.principal.asOf) : label(o.exposure),
    ]),
    sources,
    ar: null,
  };
}
