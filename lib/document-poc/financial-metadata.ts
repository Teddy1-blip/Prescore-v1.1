import { annualPeriod, parseFinancialPeriod } from '../credit-engine/financial-analysis/periods.ts';
import { date, field, issue, type Field, type Input, type Line } from './fields.ts';
const months = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
type Span = {
  start: string;
  end: string;
};
function monthNumber(s: string) {
  return months.findIndex(m => s.toLowerCase().startsWith(m)) + 1;
}
function calendarDay(s: string) {
  const plain = date(s.trim());
  if (plain) return plain;
  const m = s.trim().match(/^(\d{1,2})\s+([а-яё]+)\s+((?:19|20)\d\d)(?:\s*г\.?)?$/i);
  return m ? date(m[3] + '-' + String(monthNumber(m[2])).padStart(2, '0') + '-' + m[1].padStart(2, '0')) : null;
}
function reportingSpan(text: string): Span | null {
  const raw = text.replace(/[–—]/g, '-').trim();
  const range = raw.match(/(?:^|за\s+)(\d\d\.\d\d\.\d{4})\s*-\s*([а-яё]+)\s+(\d{4})/i);
  if (range) {
    const start = date(range[1]),
      month = monthNumber(range[2]);
    if (!start || !month) return null;
    const end = new Date(Date.UTC(Number(range[3]), month, 0)).toISOString().slice(0, 10);
    return start <= end ? {
      start,
      end
    } : null;
  }
  const parsed = parseFinancialPeriod(raw);
  if (parsed.from && parsed.to) return {
    start: parsed.from,
    end: parsed.to
  };
  const y = raw.match(/^(?:за\s+)?((?:19|20)\d{2})(?:\s*(?:г\.?|год))?$/i);
  if (!y) return null;
  const a = annualPeriod(Number(y[1]));
  return {
    start: a.from!,
    end: a.to!
  };
}
type Observation = {
  line: Line;
  value: string | null;
};
function choose(input: Input, observed: Observation[], conflict: string): Field<string> {
  if (!observed.length) return field(input.id);
  const first = observed[0];
  if (observed.some(x => x.value === null || x.line.confidence === 'LOW' || x.value !== first.value)) {
    issue(input, 'REVIEW', conflict, first.line.page);
    return field(input.id, {
      ...first.line,
      confidence: 'LOW'
    });
  }
  return field(input.id, first.line, first.value);
}
function readUnit(s: string) {
  const words = s.match(/(?:тыс(?:яч[аи]?)?\.?\s*(?:руб(?:лей|ля|ль)?\.?|₽)|млн\.?\s*(?:руб(?:лей|ля|ль)?\.?|₽)|руб(?:лей|ля|ль)?\.?|₽)/gi) ?? [];
  const units = new Set(words.map(word => /тыс/i.test(word) ? 'тыс. ₽' : /млн/i.test(word) ? 'млн ₽' : '₽'));
  if (units.size > 1) return null;
  const okei = s.match(/(?:ОКЕИ\W*|^\s*)(3\s*8\s*[345])(?:\s|$)/i)?.[1]?.replace(/\s/g, '');
  const byWord = [...units][0] ?? null;
  const byCode = okei ? ({
    '383': '₽',
    '384': 'тыс. ₽',
    '385': 'млн ₽'
  } as Record<string, string>)[okei] : null;
  return byWord && byCode && byWord !== byCode ? null : byWord ?? byCode;
}
export function financialMetadata(input: Input) {
  const dates: Observation[] = [],
    periods: Observation[] = [],
    starts: Observation[] = [],
    ends: Observation[] = [],
    priors: Observation[] = [],
    units: Observation[] = [];
  const forms = new Map<string, Line>();
  function addSpan(line: Line, raw: string) {
    const span = reportingSpan(raw);
    periods.push({
      line,
      value: span ? span.start + '/' + span.end : null
    });
    starts.push({
      line,
      value: span?.start ?? null
    });
    ends.push({
      line,
      value: span?.end ?? null
    });
  }
  for (const line of input.lines) {
    const t = line.text.trim();
    const title = t.match(/^(бухгалтерский баланс|отч[её]т о финансовых результатах|balance sheet|income statement)(?=\s|$)/i);
    const okud = t.match(/форма по ОКУД\s*[:|]?\s*(071000[12])\b/i);
    if (okud) forms.set(okud[1] === '0710001' ? 'Бухгалтерский баланс' : 'Отчёт о финансовых результатах', line);
    if (title) forms.set(/баланс|balance/i.test(title[1]) ? 'Бухгалтерский баланс' : 'Отчёт о финансовых результатах', line);
    const unit = t.match(/^(?:единица измерения|ед\.?\s*изм\.?|unit)\s*[:|]?\s*(.*)$/i);
    if (unit) units.push({
      line,
      value: readUnit(unit[1])
    });
    const label = t.match(/^(?:отч[её]тная дата|на дату|reporting date)\s*[:|]\s*(.+)$/i);
    const heading = t.split(/\s+коды\s*$/i)[0].trim();
    const on = heading.match(/^на\s+(.+)$/i);
    if (label) dates.push({
      line,
      value: calendarDay(label[1])
    });else if (on && (calendarDay(on[1]) || /^\d{1,2}\s+[а-яё]+\s+\d{4}(?:\s*г\.?)?$/i.test(on[1]))) dates.push({
      line,
      value: calendarDay(on[1])
    });
    const explicit = t.match(/^(?:отч[её]тный период|reporting period)\s*[:|]\s*(.+)$/i);
    if (explicit) addSpan(line, explicit[1]);else if (/^за\s/i.test(heading) && !/(?:\sза\s|\sна\s)/i.test(heading) && reportingSpan(heading)) addSpan(line, heading);
    const prior = t.match(/^(?:предыдущая дата|предыдущий период|previous date)\s*[:|]\s*(.+)$/i);
    if (prior) priors.push({
      line,
      value: calendarDay(prior[1])
    });
    // Annual FNS cover sheet: require both the full-year period code and its printed year.
    const fns = t.match(/отч[её]тный период\s*\(код\)\*?\s+3\s*4\s+отч[её]тный год\s+((?:\d\s*){4})$/i);
    if (fns) {
      const year = fns[1].replace(/\s/g, '');
      addSpan(line, year);
      dates.push({
        line,
        value: date(year + '-12-31')
      });
    }
  }
  const formLines = [...forms.values()];
  const form = field(input.id, formLines[0], [...forms.keys()].join(' / ') || null);
  if (!dates.length && forms.size === 1 && forms.has('Отчёт о финансовых результатах')) dates.push(...ends);
  const asOf = choose(input, dates, 'REPORTING_DATE_AMBIGUOUS'),
    period = choose(input, periods, 'REPORTING_PERIOD_AMBIGUOUS');
  const start = choose(input, starts, 'REPORTING_PERIOD_AMBIGUOUS'),
    end = choose(input, ends, 'REPORTING_PERIOD_AMBIGUOUS');
  const unit = choose(input, units, 'UNIT_AMBIGUOUS');
  if (!form.value) issue(input, 'REVIEW', 'FORM_UNKNOWN');
  if (!asOf.value) issue(input, 'REVIEW', 'REPORTING_DATE_MISSING');
  if (!unit.value) issue(input, 'REVIEW', 'UNIT_UNKNOWN');
  if (!period.value && (!asOf.value || forms.has('Отчёт о финансовых результатах'))) issue(input, 'REVIEW', 'REPORTING_PERIOD_MISSING');
  if (asOf.value && end.value && asOf.value !== end.value) issue(input, 'INVALID', 'REPORTING_PERIOD_CONFLICT');
  return {
    form,
    forms: [...forms].map(([name, line]) => field(input.id, line, name)),
    reporting_date: asOf,
    reporting_period: periods.length ? period : asOf,
    period_start: start,
    period_end: ends.length ? end : asOf,
    previous_period: choose(input, priors, 'COMPARATIVE_DATE_AMBIGUOUS'),
    unit,
    raw_unit: field(input.id, units[0]?.line, unit.value ? units[0]?.line.text.replace(/^.*?[:|]\s*/, '') : null)
  };
}
export function columnPeriod(header: string, asOf: string | null) {
  const explicit = calendarDay(header.replace(/^(?:на|current|previous)\s+/i, ''));
  if (explicit) return {
    start: null,
    end: explicit
  };
  const span = reportingSpan(header.replace(/^на\s+(?=\d{4})/i, 'за '));
  if (span) return span;
  if (!asOf) return null;
  if (/отч[её]тную дату/i.test(header)) return {
    start: null,
    end: asOf
  };
  if (/предыдущего года/i.test(header) && /31 декабря/i.test(header)) return {
    start: null,
    end: Number(asOf.slice(0, 4)) - 1 + '-12-31'
  };
  if (/^за (?:отч[её]тный|предыдущий) год/i.test(header)) {
    const y = Number(asOf.slice(0, 4)) - (header.toLowerCase().includes('предыдущий') ? 1 : 0);
    return {
      start: y + '-01-01',
      end: y + '-12-31'
    };
  }
  return null;
}
