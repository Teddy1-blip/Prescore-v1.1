"use client";

import type {WorkspaceModelV1} from "../../../lib/workspace/model";
import {BankingSnapshot} from "./banking-ledger";
import {concentrationPercent, factValue} from "./data-panel";
import {CashTrend, ExecutiveOverview, Panel} from "./client-insights";
import {ClientDecisionRoute} from "./client-decision-route";
import {date, money} from "./presentation";
import {sourceState} from "./credit-depth";

type Props = {
  model: WorkspaceModelV1;
  choose: (view: string) => void;
  retry: () => void;
};

type Signal = {
  title: string;
  text: string;
};

function basicSignals(model: WorkspaceModelV1): {positive: Signal; risk: Signal} {
  const bank = model.basic.bankingFacts;
  const netCashFlow = factValue(bank.netCashFlow);
  const monthlyOperating = factValue(bank.observedMonthlyOperatingAverage);
  const taxes = factValue(bank.taxPayments);
  const lowLiquidityDays = factValue(bank.lowLiquidityDays);
  const topCustomerShare = concentrationPercent(bank.directCustomerTop1);

  const positive: Signal = netCashFlow !== null && netCashFlow > 0
    ? {
        title: "Положительный денежный поток",
        text: `За период внешние поступления превысили списания на ${money(netCashFlow)}.`,
      }
    : monthlyOperating !== null && monthlyOperating > 0
      ? {
          title: "Операционные поступления подтверждены",
          text: `Средние операционные поступления за наблюдаемый период — ${money(monthlyOperating)} в месяц.`,
        }
      : taxes !== null && taxes > 0
        ? {
            title: "Налоговые платежи наблюдаются",
            text: `По выпискам подтверждены налоговые платежи на ${money(taxes)}.`,
          }
        : {
            title: "Выписка обработана",
            text: "Prescore сохранил подтверждённые банковские факты и не заменяет неизвестные значения нулями.",
          };

  const risk: Signal = netCashFlow !== null && netCashFlow < 0
    ? {
        title: "Отрицательный денежный поток",
        text: `За период внешние списания превысили поступления на ${money(Math.abs(netCashFlow))}.`,
      }
    : lowLiquidityDays !== null && lowLiquidityDays > 0
      ? {
          title: "Дни низкой ликвидности",
          text: `В выписках обнаружено ${new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 0}).format(lowLiquidityDays)} дней с низким денежным запасом.`,
        }
      : topCustomerShare !== null && topCustomerShare >= 50
        ? {
            title: "Концентрация на крупнейшем покупателе",
            text: `Крупнейший прямой покупатель формирует ${new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 1}).format(topCustomerShare)}% операционных поступлений.`,
          }
        : {
            title: "Оценка пока ограничена банковскими данными",
            text: "Без бухгалтерской отчётности и кредитной истории нельзя надёжно подтвердить капитал, прибыль, полный долг и долговую ёмкость.",
          };

  return {positive, risk};
}

function FreeOverview({model, retry}: Pick<Props, "model" | "retry">) {
  const {positive, risk} = basicSignals(model);
  const sources = model.basic.sources;
  const completeness = sources.completeness === null
    ? "не определена"
    : `${new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 0}).format(sources.completeness)}%`;
  const checkout = `/checkout?analysisId=${encodeURIComponent(model.analysisId)}`;

  return <>
    <div className="pc-page-title">
      <div>
        <h1>Обзор компании</h1>
        <p>Бесплатная банковская картина по загруженным выпискам</p>
      </div>
      <small>Расчёт: {date(model.basic.analysis.createdAt)}</small>
    </div>

    <section className="pc-verdict" data-client-overview="basic">
      <span>БЕСПЛАТНЫЙ АНАЛИЗ ПО ВЫПИСКЕ</span>
      <h2>Банковский профиль компании рассчитан</h2>
      <p>Prescore подтвердил движение денег, остатки, наблюдаемые обязательные платежи и концентрацию покупателей. Это уже полезная картина по счетам, но ещё не полное кредитное заключение.</p>
    </section>

    <BankingSnapshot model={model}/>

    <div className="pc-columns">
      <Panel title="Что работает в вашу пользу">
        <article className="pc-factor tone-positive">
          <div>
            <small>Подтверждённый факт</small>
            <h3>{positive.title}</h3>
            <p>{positive.text}</p>
          </div>
        </article>
      </Panel>
      <Panel title="Главное ограничение сейчас">
        <article className="pc-factor tone-attention">
          <div>
            <small>Требует внимания</small>
            <h3>{risk.title}</h3>
            <p>{risk.text}</p>
          </div>
        </article>
      </Panel>
    </div>

    <div className="pc-columns pc-wide-left">
      <Panel title="Денежный поток">
        <CashTrend model={model} compact/>
      </Panel>
      <Panel title="Качество исходных данных">
        <p>Выписки: <b>{sourceState(sources.statements.status)}</b></p>
        <p>Период: <b>{date(sources.statements.periodFrom)} — {date(sources.statements.periodTo)}</b></p>
        <p>Банков: <b>{sources.statements.bankNames?.join(" · ") || "не определено"}</b></p>
        <p>Счетов: <b>{sources.statements.accountCount ?? "не подтверждено"}</b></p>
        <p>Заполненность банковских данных: <b>{completeness}</b></p>
        <p className="pc-muted">Заполненность относится к полям и покрытию выписок, а не к полноте кредитной оценки.</p>
      </Panel>
    </div>

    {model.fullAvailability === "UNAVAILABLE" || model.entitlement === "FULL"
      ? <section className="ws-unavailable" role="status">
          <h2>Полный расчёт временно недоступен</h2>
          <p>Банковские факты сохранены. Повторная оплата не требуется, если доступ уже был открыт.</p>
          <button onClick={retry}>Повторить загрузку полного расчёта</button>
        </section>
      : <section className="ws-upgrade" data-client-paywall>
          <span className="ws-eyebrow">ПОЛНЫЙ АНАЛИЗ PRESCORE</span>
          <h2>Узнайте не только цифры, но и их значение для финансирования</h2>
          <p>Полный доступ открывает кредитное заключение, все риски и сильные стороны, Prescore Index и готовность к финансированию, долговую ёмкость при достаточных данных, сопоставление источников, подбор продуктов, план 7/30/60, PDF, AI-объяснение и повторные пересчёты.</p>
          <a className="ws-primary" href={checkout}>Открыть полный анализ — 6 500 ₽ / 30 дней</a>
          <small>Оплата открывает текущий анализ и его обновления при добавлении БФО, кредитной истории и квартальной отчётности.</small>
        </section>}
  </>;
}

export function ClientOverview(props: Props) {
  if (!props.model.full) return <FreeOverview model={props.model} retry={props.retry}/>;
  return <>
    <ExecutiveOverview {...props}>
      <ClientDecisionRoute model={props.model} choose={props.choose}/>
    </ExecutiveOverview>
  </>;
}
