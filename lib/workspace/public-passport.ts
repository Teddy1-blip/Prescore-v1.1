/** Presentation only: Checko public data is not a bank eligibility decision. */
export type PassportPublicProfile = {
  inn?: string;
  fetchedAt?: string;
  stale?: boolean;
  company: {
    name: string;
    ogrn?: string | null;
    status?: string | null;
    region?: string | null;
    registrationDate?: string | null;
    okved?: string | null;
  };
  publicRisks?: {
    enforcementDetected?: boolean | null;
    legalEventsDetected?: boolean | null;
    attentionCount?: number;
  };
  legal?: {legalCases?: number | null; enforcements?: number | null};
  contracts?: {totalCount?: number | null};
  externalFacts?: {
    cases?: Array<{reference?: string | null; title?: string | null; date?: string | null; receiptId?: string}>;
    enforcements?: Array<{reference?: string | null; title?: string | null; date?: string | null; receiptId?: string}>;
    procurement?: {items?: Array<{number: string; law: string; subject?: string | null; amount?: number | null; signedAt?: string | null}>};
  };
};
export type PassportAction = {title: string; detail: string; evidence: string};
export type PassportAttention = {title: string; detail: string; evidence: string};

export function publicPassport(profile: PassportPublicProfile | null, inn: string, hasStatements: boolean, hasAnnual: boolean) {
  const identity = profile?.company;
  const checkoDate = typeof profile?.fetchedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(profile.fetchedAt)
    ? profile.fetchedAt.slice(0, 10) : null;
  const source = checkoDate ? 'Checko · ' + checkoDate : 'Публичный источник пока не подключён';
  const fact = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const company = {
    title: fact(identity?.name) ?? 'Компания по ИНН ' + inn,
    inn,
    ogrn: fact(identity?.ogrn),
    region: fact(identity?.region),
    status: fact(identity?.status),
    registrationDate: fact(identity?.registrationDate),
    okved: fact(identity?.okved),
  };
  // Absence of a public event in one response is not proof of the absence of risk.
  const events = profile?.publicRisks?.legalEventsDetected === true || (profile?.legal?.legalCases ?? 0) > 0;
  const enforcement = profile?.publicRisks?.enforcementDetected === true || (profile?.legal?.enforcements ?? 0) > 0;
  const attention: PassportAttention[] = [];
  if (enforcement) attention.push({
    title: 'Исполнительные производства: проверить актуальность',
    detail: 'Публичный источник содержит сведения об исполнительных производствах. Нужна проверка статуса, суммы и применимости к компании.',
    evidence: source,
  });
  if (events) attention.push({
    title: 'Судебные события: изучить содержание',
    detail: 'Найдены сведения о судебных событиях. Само наличие записи не означает невозможность привлечения финансирования.',
    evidence: source,
  });
  const actions: PassportAction[] = [];
  if (attention.length) actions.push({
    title: 'Уточнить публичные события',
    detail: 'Проверить даты, предмет и актуальное состояние опубликованных событий перед финансовым решением.',
    evidence: source,
  });
  if (!hasStatements) actions.push({
    title: 'Добавить банковские выписки',
    detail: 'Обороты, долговые платежи и ликвидность будут рассчитаны только по подтверждённым операциям компании.',
    evidence: 'Ожидается банковская выписка',
  });
  if (!hasAnnual) actions.push({
    title: 'Дополнить бухгалтерский профиль',
    detail: 'Для оценки капитала, прибыли и структуры обязательств нужна годовая БФО или иной подтверждённый источник.',
    evidence: 'Ожидается годовая отчётность',
  });
  if (!actions.length) actions.push({
    title: 'Сверить периоды и источники',
    detail: 'Проверьте, что сведения Checko, банковские обороты и БФО актуальны и относятся к одной организации.',
    evidence: source,
  });
  const count = profile?.contracts?.totalCount;
  return {
    company,
    checkoDate,
    source,
    stale: profile?.stale === true,
    contracts: typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null,
    attention,
    actions: actions.slice(0, 2),
    publicExpertise: attention.length
      ? 'Публичные события требуют предметной проверки. Без банковских и бухгалтерских данных они не определяют кредитоспособность.'
      : profile
        ? 'Паспорт компании сформирован по доступным публичным сведениям. Финансовые выводы углубляются по мере добавления документов.'
        : 'Добавьте компанию по ИНН и получите доступные публичные сведения. Финансовый анализ строится только на подтверждённых документах.',
  };
}
