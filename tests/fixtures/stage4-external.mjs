// Synthetic Checko v2 shapes. The two law filters are separate provider receipts.
export const corporation = '7707083893',
  entrepreneur = '500100732259';
export function checkoDouble({ fail = ['inspections'], change = {}, partialContracts = true } = {}) {
  const calls = [];
  async function fetcher(input, options) {
    const url = new URL(input),
      q = JSON.parse(options.body),
      path = url.pathname.split('/').at(-1),
      method = path === 'contracts' ? 'contracts:' + q.law : path,
      inn = q.inn;
    if (url.origin !== 'https://api.checko.ru' || url.search || options.redirect !== 'error')
      throw Error('invalid test transport');
    calls.push(method);
    await new Promise((r) => setTimeout(r, 4));
    const subject = { ИНН: inn },
      counterparty = { ИНН: '9900000111', НаимСокр: 'Тестовый заказчик' };
    const rows = (Записи, more = 0) => ({
      Записи,
      ЗапВсего: Записи.length + more,
      СтрВсего: more ? 2 : 1,
      СтрТекущ: 1,
    });
    const bodies = {
      company: {
        ИНН: inn,
        НаимСокр: 'Синтетический поставщик',
        НаимПолн: 'ООО Синтетический поставщик',
        ОГРН: '9999999999999',
        КПП: '999999999',
        ДатаРег: '2018-02-01',
        ДатаСвед: '2026-08-01',
        Статус: { Наим: 'Действует' },
        ОКВЭД: { Код: '62.01', Наим: 'Разработка' },
        Регион: { Наим: 'Тестовый регион' },
        ЮрАдрес: { АдресРФ: 'Синтетическая улица', Недост: false },
        МСП: { Категория: 'Малое предприятие' },
        Учред: { ФЛ: [{}] },
        УстКап: { Сумма: 50000 },
      },
      entrepreneur: {
        ИНН: inn,
        ФИО: 'Тест Предприниматель',
        ОГРНИП: '999999999999999',
        ДатаРег: '2019-01-02',
        Статус: 'Действующий',
        ЭконДеят: { Код: '62.01' },
      },
      finances: {
        2025: { 1600: 900000, 1700: 900000, 1300: 300000, 1200: 120000, 1500: 60000, 2110: 810000, 2400: 81000 },
      },
      enforcements: rows([
        {
          ИспПрНомер: 'ИП-СИН-1',
          ИспПрДата: '2026-07-01',
          Статус: 'На исполнении',
          СумДолг: 8500,
          ОстЗадолж: 6500,
          ПредмИсп: 'Исполнительный лист',
        },
        { ИспПрНомер: 'ИП-СИН-2', ИспПрДата: '2026-07-02', Статус: 'Окончено', ОстЗадолж: 50000 },
      ]),
      'legal-cases': rows([
        {
          Номер: 'А-СИН-001',
          Дата: '2026-06-01',
          СуммИск: 52000,
          Ответ: [subject],
          Суд: 'Синтетический арбитраж',
          СтрКАД: 'https://kad.arbitr.ru/Card/synthetic',
        },
      ]),
      inspections: rows([
        { Номер: 'П-СИН-1', ТипПров: 'Плановая', ДатаНач: '2026-06-05', ОргКонтр: { Наим: 'Тестовый орган' } },
      ]),
      fedresurs: rows([
        {
          GUID: 'СООБ-СИН-1',
          Тип: 'CreditorIntentionGoToCourt',
          ТипНаим: 'Намерение обратиться в суд',
          Дата: '2026-05-04',
        },
      ]),
      'bankruptcy-messages': rows([]),
      timeline: [{ Дата: '2026-03-01', Событие: 'Смена руководителя' }],
      'contracts:44': rows(
        [
          {
            РегНомер: 'СИН-44-1',
            Дата: '2026-07-01',
            ДатаИсп: '2027-09-01',
            Статус: 'На исполнении',
            Цена: 120000,
            Заказ: counterparty,
            Постав: [subject],
            Предмет: 'Поставка материалов',
          },
          {
            РегНомер: 'СИН-44-2',
            Дата: '2026-04-01',
            Статус: 'Исполнение завершено',
            Цена: 40000,
            Заказ: { ИНН: '9900000222', Наим: 'Второй заказчик' },
            Постав: [subject],
          },
        ],
        partialContracts ? 8 : 0,
      ),
      'contracts:223': rows([
        {
          РегНомер: 'СИН-223-1',
          Дата: '2026-02-01',
          Цена: 0,
          Заказ: counterparty,
          Предмет: 'Открытая часть договора',
        },
      ]),
    };
    if (fail.includes(method))
      return Response.json({ meta: { status: 'error', message: 'PRIVATE_PROVIDER_ERROR_META' } });
    const body = {
      ...(inn.length === 12 ? { entrepreneur: subject } : { company: subject }),
      data: bodies[method],
      meta: { status: 'ok', balance: 876543210 },
    };
    return Response.json(change[method] ? change[method](body) : body);
  }
  return { fetcher, calls };
}
const ext = 'http://zakupki.gov.ru/oos/export/1',
  types = 'http://zakupki.gov.ru/oos/types/1',
  ko = 'http://zakupki.gov.ru/oos/KOTypes/1';
export const eisXml = (body) =>
  new TextEncoder().encode('<e:export xmlns:e="' + ext + '" xmlns="' + types + '">' + body + '</e:export>');
export const eisContract = (inn = corporation) =>
  eisXml(
    '<e:contract><regNum>TEST-44</regNum><customer><INN>9900000111</INN><fullName>Синтетический заказчик</fullName></customer><suppliersInfo><supplierInfo><legalEntityRF><EGRULInfo><INN>' +
      inn +
      '</INN></EGRULInfo></legalEntityRF></supplierInfo></suppliersInfo><priceInfo><price>25000</price><currency><code>RUB</code></currency></priceInfo><signDate>2026-07-09</signDate><contractSubject>Тестовая поставка</contractSubject></e:contract>',
  );
export function eisInclusion(n, inn = corporation, end = '2027-07-01') {
  return eisXml(
    '<e:unfairSupplier2022 xmlns="' +
      ko +
      '"><uuid>sample-' +
      n +
      '</uuid><commonInfo><regNumber>' +
      n +
      '</regNumber><versionNumber>1</versionNumber><publishDT>2026-07-01T12:00:00Z</publishDT></commonInfo><createReasonInfo><createReason>WINNER_DEVIATION</createReason></createReasonInfo><unfairSupplierInfo><legalEntityRFInfo><INN>' +
      inn +
      '</INN></legalEntityRFInfo></unfairSupplierInfo>' +
      (end ? '<autoExDateInfo><autoExDate>' + end + '</autoExDate></autoExDateInfo>' : '') +
      '</e:unfairSupplier2022>',
  );
}
export const eisExclusion = (n) =>
  eisXml(
    '<e:unfairSupplier2022Exclude xmlns="' +
      ko +
      '"><unfairSupplier2022ForExcludeInfo><uuid>sample-' +
      n +
      '</uuid><regNumber>' +
      n +
      '</regNumber><versionNumber>1</versionNumber></unfairSupplier2022ForExcludeInfo><commonInfo><excludeDT>2026-07-16T12:00:00Z</excludeDT></commonInfo></e:unfairSupplier2022Exclude>',
  );
