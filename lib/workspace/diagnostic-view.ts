/** Browser-safe presentation of the existing canonical diagnostics. No calculation or raw errors. */
const stageLabels: Record<string, string> = {
  SAVED_INPUT: 'чтение сохранённого анализа', SAVED_IDENTITY: 'проверка принадлежности анализа',
  ENTITLEMENT_READ: 'проверка доступа', BASIC_PROJECTION: 'подготовка банковских показателей',
  PROFILE_READ: 'чтение сведений о компании', SOURCES: 'проверка источников', SOURCE_DATES: 'проверка периодов',
  BANK_METRICS_REQUIRED: 'проверка банковского расчёта', FINANCIAL_ANALYSIS: 'финансовая отчётность',
  CREDIT_PORTFOLIO: 'кредитный портфель', RECONCILIATION: 'сопоставление источников', RISK: 'оценка рисков',
  CONTEXT: 'контекст компании', INDEX: 'индекс', READINESS: 'готовность к финансированию',
  ASSESSMENT: 'кредитная оценка', CAPACITY: 'долговая ёмкость', PRODUCTS: 'подбор продуктов',
  RECOMMENDATIONS: 'рекомендации', ACTION_PLAN: 'план действий', EXPLAINABILITY: 'объяснения',
  CLIENT_REPORT: 'подготовка отчёта', PUBLIC_MODEL: 'подготовка данных кабинета',
};
const safeReasons = new Set([
  'UNEXPECTED_FAILURE', 'INVALID_SAVED_JSON', 'INVALID_SAVED_SHAPE', 'SAVED_IDENTITY_MISMATCH',
  'BANK_METRICS_MISSING', 'INVALID_SOURCE_DATES', 'SOURCE_IDENTITY_MISMATCH',
  'BANK_VERSION_OR_SHAPE', 'BANK_PERIOD_ORDER', 'MONTH_SHAPE', 'FUTURE_BANK_MONTH',
  'MONTH_OUTSIDE_BANK_PERIOD', 'FULL_MONTH_OUTSIDE_BANK_PERIOD', 'NEGATIVE_OR_MISSING_MONTH_AMOUNT',
  'BANK_MONTH_COUNTS', 'BANK_METRIC_STATE', 'BANK_METRIC_CONCEPT', 'CANONICAL_AVERAGE_MONTH_LINEAGE',
  'BANK_QUALITY', 'FUTURE_OR_INVALID_AVAILABILITY', 'PORTFOLIO_IDENTITY',
  'FINANCIAL_COMPANY_MISMATCH', 'DUPLICATE_FINANCIAL_SNAPSHOT', 'DUPLICATE_ID_CONFLICT',
  'INVALID_RISK_SUBJECT_OR_DATE', 'INVALID_RISK_FACT', 'RISK_FACT_ID_CONFLICT',
  'CONTEXT_RISK_INPUT_UNAVAILABLE', 'CONTEXT_INPUT_MISMATCH',
]);

export function workspaceDiagnosticMessage(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const d = value as Record<string, unknown>;
  if (!['PRESCORE-CANONICAL-DIAGNOSTICS-1.0.1', 'PRESCORE-CANONICAL-DIAGNOSTICS-1.0.2'].includes(String(d.version))
      || typeof d.stage !== 'string' || !Object.hasOwn(stageLabels, d.stage)
      || typeof d.reason !== 'string' || !safeReasons.has(d.reason)
      || typeof d.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.id)) return '';
  let message = 'Не удалось подготовить результат анализа. Это ошибка обработки, а не вывод о финансовом состоянии компании.';
  if (d.stage === 'ENTITLEMENT_READ') message = 'Не удалось проверить доступ к полному анализу. Это не подтверждает отсутствие подписки; повторная оплата не требуется для проверки.';
  else if (d.reason === 'BANK_METRICS_MISSING') message = 'В сохранённом анализе отсутствуют необходимые банковские метрики. Это не означает нулевые обороты. Для восстановления нужна обработка полных исходных выписок; добавление БФО само по себе это не исправит.';
  else if (['INVALID_SAVED_JSON', 'INVALID_SAVED_SHAPE'].includes(d.reason)) message = 'Сохранённый анализ имеет несовместимую структуру. Это не отсутствие документов. Нужна проверка сохранённых данных без их удаления.';
  else if (['SAVED_IDENTITY_MISMATCH', 'SOURCE_IDENTITY_MISMATCH', 'FINANCIAL_COMPANY_MISMATCH', 'PORTFOLIO_IDENTITY'].includes(d.reason)) message = 'Принадлежность анализа или источников не согласована. Сведения разных компаний не объединены; проверьте выбранную компанию и исходные документы.';
  else if (['INVALID_SOURCE_DATES', 'BANK_PERIOD_ORDER', 'FUTURE_BANK_MONTH', 'MONTH_OUTSIDE_BANK_PERIOD', 'FULL_MONTH_OUTSIDE_BANK_PERIOD'].includes(d.reason)) message = 'Периоды сохранённых данных не согласованы. Требуется проверка полного исходника; исправление одной даты на экране не восстановит расчёт.';
  else if (d.stage === 'PROFILE_READ') message = 'Не удалось прочитать сохранённые сведения о компании. Это ошибка получения данных, а не подтверждение отсутствия отчётности или рисков.';
  return `${message} Этап: ${stageLabels[d.stage]}. Код: ${d.reason}. Номер диагностики: ${d.id}.`;
}
