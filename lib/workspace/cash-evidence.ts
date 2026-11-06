import type {AnalysisResult} from '../prescore.ts';
import {cashSeriesRows, classifyTransactions} from '../credit-engine/metrics/engine.ts';
import {CASH_PAGE_SIZE, cashValue, type CashSeries, type CashEvidencePage} from './cash-series.ts';


const confidenceLabels = {HIGH:'Высокая', MEDIUM:'Средняя', LOW:'Низкая', UNKNOWN:'Не определена'} as const;
const categories: Record<import('../credit-engine/contracts/classification.ts').EconomicCategory, string> = {
  SALE_PROCEEDS:'Оплата покупателей', CUSTOMER_ADVANCE:'Авансы покупателей', ACQUIRING_SETTLEMENT:'Эквайринг',
  MARKETPLACE_SETTLEMENT:'Расчёты с маркетплейсом', SUPPLIER_PAYMENT:'Оплата поставщикам', RENT_PAYMENT:'Аренда',
  INDIVIDUAL_BUSINESS_PAYMENT:'Деловой платёж физлицу', BANK_LOAN_RECEIVED:'Кредит банка', OTHER_LOAN_RECEIVED:'Полученный заём',
  OWNER_LOAN_RECEIVED:'Заём собственника', FACTORING_PROCEEDS:'Факторинг', LOAN_REPAYMENT_RECEIVED:'Возврат выданного займа',
  LOAN_PRINCIPAL_PAYMENT:'Погашение основного долга', INTEREST_PAYMENT:'Проценты', DEBT_SERVICE_UNSPLIT:'Платёж по долгу без разбивки',
  LEASING_PAYMENT:'Лизинговый платёж', FACTORING_FEE:'Комиссия за факторинг', LOAN_ISSUED:'Выдача займа',
  OWNER_CONTRIBUTION:'Вклад собственника', OWNER_FUNDING_UNSPECIFIED:'Финансирование собственником', OWNER_WITHDRAWAL:'Изъятие средств',
  DIVIDEND:'Дивиденды', TAX_PAYMENT:'Налоговый платёж', SOCIAL_CONTRIBUTION:'Страховые взносы', TAX_REFUND:'Возврат налога',
  PAYROLL:'Заработная плата', EMPLOYEE_REIMBURSEMENT:'Возмещение сотруднику', BANK_FEE:'Банковская комиссия',
  ACQUIRING_FEE:'Комиссия эквайринга', ASSET_PURCHASE:'Покупка актива', ASSET_SALE_PROCEEDS:'Продажа актива',
  REFUND_RECEIVED:'Полученный возврат', CUSTOMER_REFUND:'Возврат покупателю', INTERNAL_TRANSFER:'Между своими счетами',
  SUBSIDY_GRANT:'Субсидия или грант', INSURANCE_PAYOUT:'Страховая выплата', OTHER_INFLOW:'Прочее поступление',
  OTHER_OUTFLOW:'Прочее списание', UNKNOWN_INFLOW:'Поступление не классифицировано', UNKNOWN_OUTFLOW:'Списание не классифицировано',
  UNKNOWN_DIRECTION:'Направление не определено', CASH_WITHDRAWAL:'Снятие наличных', INDIVIDUAL_UNCLEAR_PAYMENT:'Платёж физлицу без подтверждённой цели',
};

export function cashEvidence(analysis: AnalysisResult, month: string, series: CashSeries, offset: number):
  {status: 200; body: CashEvidencePage} | {status: 409; body: {error: string}} {
  const unavailable = (error: string) => ({status: 409 as const, body: {error}});
  const observed = analysis.metricsV2?.monthly.find(row => row.month === month);
  const metrics=analysis.metricsV2;
  const periodTotals=metrics && {
    externalInflows:metrics.cashFlow.grossExternalCashInflow,externalOutflows:metrics.cashFlow.grossExternalCashOutflow,
    netExternal:metrics.cashFlow.netExternalCashFlow,operatingReceipts:metrics.operating.operatingCashReceipts,
    principal:metrics.debtService.loanPrincipalPaid,interest:metrics.debtService.interestPaid,unsplit:metrics.debtService.unsplitDebtService,
    leasing:metrics.debtService.leasingPaid,taxOnly:metrics.tax.taxPaymentsAmount,social:metrics.tax.socialContributionsAmount,
    individualBusiness:metrics.individualAndCash.individualBusinessAmount,
  };
  const total=periodTotals && Object.hasOwn(periodTotals,series) ? periodTotals[series as keyof typeof periodTotals] : undefined;
  const expected=month==="all" ? total?.value : observed && cashValue(observed,series);
  if (expected == null) return unavailable('Для этого показателя или месяца нет подтверждённой суммы.');
  const tx = analysis.transactions;
  if (!Array.isArray(tx) || analysis.transactionsTruncated ||
      (analysis.originalTransactionCount ?? analysis.normalization?.retainedCount ?? analysis.metrics?.transactions) !== tx.length ||
      (analysis.storedTransactionCount != null && analysis.storedTransactionCount !== tx.length)) {
    return unavailable('Полный список операций для этой версии не сохранён.');
  }
  const rows = cashSeriesRows(classifyTransactions(tx).filter(t => month==='all' || t.date?.slice(0,7) === month), series);
  const cents = rows.reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
  if (!Number.isSafeInteger(cents) || cents !== Math.round(expected * 100)) {
    return unavailable('Сохранённые операции не сходятся с итогом. Расшифровка недоступна.');
  }
  return {status: 200, body: {
    analysisId: analysis.id, month, series, total: cents / 100, count: rows.length, offset,
    nextOffset: offset + CASH_PAGE_SIZE < rows.length ? offset + CASH_PAGE_SIZE : null,
    rows: rows.slice(offset, offset + CASH_PAGE_SIZE).map(t => ({
      id: t.canonicalTransactionId || t.id, date: t.date, amount: t.amount, postedAmount:t.postedAmount, counterparty: t.counterparty,
      purpose: t.purpose, category: categories[t.economicCategory], confidence: confidenceLabels[t.economicConfidence],
      hashOf: t.fileHash ? "file" : "text", parser: t.parserVersion ?? null, hash: /^sha256:[0-9a-f]{64}$/i.test(t.rawReference ?? "") ? t.rawReference!.slice(7) : null,
      source: t.sourceFileName ?? null, row: t.sourceRow ?? null, documentNumber: t.bankDocumentId ?? null,
    })),
  }};
}
