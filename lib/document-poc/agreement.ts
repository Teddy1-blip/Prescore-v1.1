import { capture, date, field, issue, numeric, plain, type Field, type Input, type Line } from './fields.ts';
export const COVENANT_REGISTRY_VERSION = 'PRESCORE-COVENANTS-0.1';
export const covenantRegistry = {
  NET_DEBT_EBITDA: /net debt\s*\/\s*ebitda|чистый долг\s*\/\s*ebitda/i,
  DEBT_EBITDA: /debt\s*\/\s*ebitda|долг\s*\/\s*ebitda/i,
  DSCR: /\bDSCR\b/i,
  LENDER_TURNOVER_SHARE: /дол[яю].*оборот|оборот.*через.*(?:банк|кредитор)/i,
  MIN_TURNOVER: /оборот/i,
  MIN_EQUITY: /собственн.*капитал|minimum equity/i,
  MIN_REVENUE: /выручк|minimum revenue/i,
  LOSS_RESTRICTION: /убыт|loss restriction/i,
  NEW_DEBT_CONSENT: /соглас.*(?:за[её]м|кредит|долг)|consent.*debt/i,
  ADDITIONAL_DEBT: /нов.*долг|дополн.*за[её]м|additional debt/i,
  DISTRIBUTION: /дивиденд|dividend/i,
  CHANGE_OF_CONTROL: /смен.*контрол|change of control/i,
  COLLATERAL_INSURANCE: /страх.*залог|collateral insurance/i,
  REPORTING: /предостав.*отч[её]т|reporting requirement/i,
  CROSS_DEFAULT: /кросс.?дефолт|cross.default/i
} as const;
function covenant(input: Input, line: Line) {
  const hit = Object.entries(covenantRegistry).find(([, pattern]) => pattern.test(line.text));
  const code = hit?.[0] ?? 'UNMAPPED_COVENANT';
  if (!hit) issue(input, 'REVIEW', 'UNMAPPED_COVENANT', line.page);
  const match = line.text.match(/(не менее|не более|не ниже|не выше|>=|<=|≥|≤|>|<|at least|at most)\s*([-\d][\d\s.,]*)(%|₽|руб\.?|раза?|x|times)?/i);
  const from = (s?: string) => s ? field(input.id, line, s.trim()) : field<string>(input.id);
  return {
    covenant_code: field(input.id, line, code),
    condition: field(input.id, line, line.text.slice(0, 220)),
    operator: from(match?.[1]),
    threshold: match ? field(input.id, line, numeric(match[2])) : field<number>(input.id),
    unit: from(match?.[3]),
    period: from(line.text.match(/за\s+(?:квартал|месяц|год)|per (?:quarter|month|year)/i)?.[0]),
    deadline_frequency: from(line.text.match(/(?:ежеквартально|ежемесячно|ежегодно|quarterly|annually|до \d{2}\.\d{2}\.\d{4})/i)?.[0])
  };
}
function amount(s: string) {
  return numeric(s.replace(/\s*(?:руб(?:лей|ля)?\.?|₽|RUB|USD|EUR)$/i, ''));
}
const booleanValue = (s: string) => /^(?:есть|имеется|предусмотрен[ао]?|да|yes)$/i.test(s) ? true : /^(?:нет|отсутствует|не предусмотрен[ао]?|no)$/i.test(s) ? false : null;
const isSchedule = (s: string) => /график (?:погашения|платежей)|payment schedule/i.test(s);
function getSchedule(input: Input) {
  const table: {
    date: Field<string>;
    principal: Field<number>;
    interest: Field<number>;
    fees: Field<number>;
    total: Field<number>;
  }[] = [];
  const pages = new Set<number>();
  const declared = capture(input, /(?:график (?:платежей|погашения)|payment schedule).*?(?:стр(?:аниц[ыа])?\.?|pages?)\s*([0-9]+(?:\s*[-–—]\s*[0-9]+)?)/i, s => {
    const [start, end = start] = s.split(/[-–—]/).map(Number);
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start > 0 && start <= end ? start + '–' + end : null;
  });
  let headerPage = 0;
  for (const line of input.lines) {
    if (/^(?:график (?:погашения|платежей)|payment schedule)\s*$/i.test(line.text)) pages.add(line.page);
    const cols = line.text.split(/\s*\|\s*|\t| {2,}/).map(x => x.trim());
    if (cols.length === 5 && /дата|date/i.test(cols[0]) && /основной долг|principal/i.test(cols[1]) && /процент|interest/i.test(cols[2]) && /комисси|fees/i.test(cols[3]) && /итого|total/i.test(cols[4])) {
      headerPage = line.page;
      pages.add(line.page);
      continue;
    }
    if (headerPage !== line.page || cols.length < 2 || !/^\d/.test(cols[0])) continue;
    if (cols.length !== 5 || !date(cols[0])) {
      issue(input, 'REVIEW', 'SCHEDULE_ROW_UNREADABLE', line.page);
      continue;
    }
    const amounts = cols.slice(1).map(s => field(input.id, line, numeric(s)));
    if (amounts.some(f => f.value == null)) issue(input, 'REVIEW', 'SCHEDULE_ROW_PARTIAL', line.page);else if (Math.abs(amounts[0].value! + amounts[1].value! + amounts[2].value! - amounts[3].value!) > 0.01) issue(input, 'REVIEW', 'SCHEDULE_TOTAL_MISMATCH', line.page);
    table.push({
      date: field(input.id, line, date(cols[0])),
      principal: amounts[0],
      interest: amounts[1],
      fees: amounts[2],
      total: amounts[3]
    });
  }
  if (pages.size && !table.length) issue(input, 'REVIEW', 'SCHEDULE_NOT_TRANSCRIBED');
  return {
    pages: [...pages],
    declared_page_range: declared,
    rows: table,
    state: 'PARTIAL_POC' as const
  };
}
export function creditAgreement(input: Input) {
  const find = <T,>(labels: string, parser: (s: string) => T | null) => capture(input, new RegExp('^(?:' + labels + ')\\s*[:|]\\s*(.+)$', 'i'), parser);
  const schedule = getSchedule(input);
  let schedulePresence = find('график платежей|payment schedule', booleanValue);
  if (schedule.declared_page_range.value && schedulePresence.value == null) {
    const line = input.lines.find(l => l.page === schedule.declared_page_range.source_page && l.text.startsWith(schedule.declared_page_range.source_text ?? '!'));
    if (line) schedulePresence = field(input.id, line, true);
  }
  if ((schedule.pages.length || schedule.declared_page_range.value) && schedulePresence.value === false) issue(input, 'INVALID', 'SCHEDULE_PRESENCE_CONFLICT');
  if (schedulePresence.status === 'MISSING' && schedule.pages.length) {
    const first = input.lines.find(l => l.page === schedule.pages[0] && (isSchedule(l.text) || /principal|основной долг/i.test(l.text)));
    schedulePresence = field(input.id, first, true);
  }
  const terms = {
    creditor: find('кредитор|банк-кредитор|lender|creditor', plain),
    borrower: find('за[её]мщик|borrower', plain),
    agreement_number: find('номер договора|договор №|agreement number', plain),
    agreement_date: find('дата договора|agreement date', date),
    product_type: find('вид кредита|вид продукта|product type', plain),
    currency: find('валюта|currency', s => /^(?:рубли|рубль|RUB|₽)$/i.test(s) ? 'RUB' : /^(USD|EUR|CNY)$/i.test(s) ? s.toUpperCase() : null),
    credit_amount: find('сумма кредита|сумма кредитования|credit amount|committed amount', amount),
    credit_limit: find('кредитный лимит|лимит кредитования|credit limit', amount),
    interest_rate: find('процентная ставка|interest rate', s => s.endsWith('%') ? numeric(s.slice(0, -1)) : null),
    rate_type: find('тип ставки|rate type', s => /^(фиксированная|fixed)$/i.test(s) ? 'FIXED' : /^(переменная|плавающая|variable)$/i.test(s) ? 'VARIABLE' : null),
    variable_rate_formula: find('формула ставки|variable.rate formula', plain),
    start_date: find('дата начала|start date', date),
    maturity_date: find('срок погашения|дата погашения|maturity date', date),
    fees: find('комиссия|комиссии|fees', plain),
    collateral: find('обеспечение|залог|collateral', plain),
    guarantor_presence: find('поручительство|поручитель|guarantor', booleanValue),
    schedule_presence: schedulePresence
  };
  if (!terms.agreement_number.value || !terms.borrower.value || !terms.creditor.value || !terms.agreement_date.value) issue(input, 'REVIEW', 'AGREEMENT_IDENTITY_INCOMPLETE');
  if (terms.credit_amount.value === null && terms.credit_limit.value === null) issue(input, 'REVIEW', 'AMOUNT_OR_LIMIT_MISSING');
  if (!terms.currency.value) issue(input, 'REVIEW', 'CURRENCY_MISSING');
  if (terms.start_date.value && terms.maturity_date.value && terms.start_date.value > terms.maturity_date.value) issue(input, 'INVALID', 'AGREEMENT_DATE_ORDER');
  const covenants = input.lines.filter(l => /ковенант\s*[:№]|covenant\s*[:#]|за[её]мщик обязуется/i.test(l.text) || /не менее|не более|запрещ|обязан|без согласия|maintain|shall|must|>=|<=|≥|≤/i.test(l.text) && Object.values(covenantRegistry).some(r => r.test(l.text))).map(l => covenant(input, l));
  return {
    type: 'CreditAgreementExtractionV1' as const,
    terms,
    covenants,
    covenant_registry_version: COVENANT_REGISTRY_VERSION,
    schedule
  };
}
export type CreditAgreementExtractionV1 = ReturnType<typeof creditAgreement>;
