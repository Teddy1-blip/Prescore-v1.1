'use client';
import { useEffect, useRef, useState } from 'react';
import type { WorkspaceModelV1 } from '../../../lib/workspace/model';
import type { ExternalFacts, ExternalRow, Receipt, RnpRecord } from '../../../lib/external/records';
import styles from './external-sources.module.css';

type View = {
  providerStatus?: string;
  providerConfigured?: boolean;
  fetchedAt?: string;
  stale?: boolean;
  freeView?: boolean;
  legacyReceipts?: boolean;
  externalFacts?: ExternalFacts;
  company?: { name?: string; ogrn?: string; status?: string };
  contracts?: { totalCount: number | null };
  registryComparison?: {
    status: string;
    fns: { lifecycle: string | null; date: string | null; retrievedAt: string } | null;
  };
  error?: string;
};
const states: Record<string, string> = {
  READY: 'Получено',
  EMPTY: 'Источник вернул пустой результат',
  FAILED: 'Ошибка получения',
  STALE: 'Срок кэша истёк',
  NOT_REQUESTED: 'Не запрашивался',
  NOT_CONFIGURED: 'Не настроен',
  RETRY_LATER: 'Повтор временно ограничен',
  ACTIVE: 'Действует',
  CLOSED: 'Окончено',
  COMPLETED: 'Исполнен',
  TERMINATED: 'Прекращён',
  UNKNOWN: 'Не определено',
  HISTORICAL: 'Историческая запись',
  SUPPLIER: 'Поставщик',
  CUSTOMER: 'Заказчик',
  OTHER: 'Другая роль',
  DEFENDANT: 'Ответчик',
  PLAINTIFF: 'Истец',
  LIQUIDATION: 'В процессе ликвидации',
};
const authorities: Record<string, string> = {
  FNS: 'ФНС',
  FSSP: 'ФССП',
  KAD: 'Картотека арбитражных дел',
  INSPECTIONS: 'Реестр проверок',
  FEDRESURS: 'Федресурс',
  EIS: 'ЕИС',
  FAS: 'ФАС',
  UNKNOWN: 'первоисточник не подтверждён',
};
const methods: Record<string, string> = {
  company: 'Компания',
  entrepreneur: 'ИП',
  finances: 'Бухгалтерская отчётность',
  enforcements: 'Исполнительные производства',
  'legal-cases': 'Арбитраж',
  inspections: 'Проверки',
  fedresurs: 'Сообщения Федресурса',
  'bankruptcy-messages': 'Сообщения ЕФРСБ',
  timeline: 'История изменений',
  'contracts:44': 'Контракты 44-ФЗ',
  'contracts:223': 'Договоры 223-ФЗ',
  rnp: 'Детальные записи РНП',
  bank: 'Банки по БИК',
};
const label = (s: string | undefined | null) => (s ? (states[s] ?? s) : 'Не определено');
const dt = (s: string | null | undefined) =>
  s ? s.slice(0, 10).split('-').reverse().join('.') : 'дата неизвестна';
const rub = (n: number | null | undefined) =>
  n == null ? 'Не определено' : n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
function source(r: Receipt | undefined) {
  return r
    ? 'Checko · ' +
        authorities[r.authority] +
        ' · ' +
        (r.retrievedAt ? 'получено ' + dt(r.retrievedAt) : 'нет даты получения') +
        (r.freshness === 'STALE' ? ' · срок кэша истёк' : '')
    : 'Источник не определён';
}
export function RnpSection({ rows, receipts = [] }: { rows: RnpRecord[]; receipts?: Receipt[] }) {
  return (
    <section>
      <h3>Реестр недобросовестных поставщиков</h3>
      {!rows.length ? (
        <p>Текущий статус неизвестен. Прямой ЕИС не настроен, детальные записи РНП от Checko не получены.</p>
      ) : (
        ['ACTIVE', 'HISTORICAL', 'UNKNOWN'].map((k) => (
          <div key={k}>
            <h4>{label(k)}</h4>
            {rows
              .filter((x) => x.state === k)
              .map((r) => (
                <p key={r.number}>
                  {r.number} · {r.law} · {r.basis} · публикация {dt(r.published)}, включение {dt(r.included)},
                  исключение {dt(r.ended)}
                  {r.plannedEnd && ' · плановое окончание ' + dt(r.plannedEnd)}
                  {r.related && ' · закупка ' + r.related} · ЕИС · получено{' '}
                  {dt(receipts.find((s) => s.id === r.receiptId)?.retrievedAt)}
                </p>
              ))}
          </div>
        ))
      )}
    </section>
  );
}
function Facts({ data }: { data: View }) {
  const f = data.externalFacts!,
    i = f.identity,
    p = f.procurement,
    lookup = (id: string) => f.receipts.find((r) => r.id === id);
  const rows = (title: string, records: ExternalRow[], method: string) => {
    const r = f.receipts.find((v) => v.method === method);
    return (
      <details>
        <summary>
          {title} · {records.length ? 'показано ' + records.length : label(r?.status)}
        </summary>
        <small>{source(r)}</small>
        {!records.length && (
          <p>{r?.status === 'EMPTY' ? 'В ответе провайдера записей нет.' : 'Подтверждённые записи недоступны.'}</p>
        )}
        {records.map((x, n) => (
          <article key={x.receiptId + n}>
            <b>{x.reference ?? x.title ?? title}</b>
            <p>
              {x.title} {x.authority} {x.status} {x.role && label(x.role)}
            </p>
            {'amount' in x && (
              <p>
                {method === 'legal-cases' ? 'Сумма требования' : 'Сумма производства'} · {rub(x.amount)}
              </p>
            )}
            {'remaining' in x && (
              <p>
                Остаток · {rub(x.remaining)} · {label(x.state)}
              </p>
            )}
            {'violations' in x && <p>Нарушения · {x.violations ?? 'сведения не приведены'}</p>}
            <small>
              {dt(x.date)} · {source(lookup(x.receiptId))}
            </small>
            {x.url && (
              <p>
                <a href={x.url} rel="noreferrer">
                  Запись источника
                </a>
              </p>
            )}
          </article>
        ))}
      </details>
    );
  };
  return (
    <>
      <section>
        <h3>Компания и реестр</h3>
        <b>{i.name ?? 'Наименование не подтверждено'}</b>
        <p>
          ИНН {f.inn} · ОГРН {i.ogrn ?? 'не указан'} {i.kpp && '· КПП ' + i.kpp}
        </p>
        <p>
          {i.status ?? 'Статус неизвестен'} · регистрация {dt(i.registered)} · {i.region ?? 'Регион не указан'}
        </p>
        <p>
          ОКВЭД · {i.okved ?? 'нет данных'}
          <br />
          Адрес · {i.address ?? 'нет данных'}
          {i.unreliable === true && ' · отметка о недостоверности'}
        </p>
        <p>
          Уставный капитал · {rub(i.capital)}. МСП · {i.sme ?? 'нет данных'}. Учредителей ·{' '}
          {i.founders ?? 'не определено'}.
        </p>
        {!!i.managerNames.length && <p>Руководство · {i.managerNames.join(', ')}</p>}
        <small>
          {source(f.receipts.find((r) => r.method === 'company' || r.method === 'entrepreneur'))} · дата сведений{' '}
          {dt(i.informationDate)}
        </small>
        {data.registryComparison?.fns && (
          <p>
            Прямая выписка ФНС · {label(data.registryComparison.fns.lifecycle)} на{' '}
            {dt(data.registryComparison.fns.date)}.{' '}
            {data.registryComparison.status === 'CONFLICT'
              ? 'Расхождение на одну дату. Требуется сверка.'
              : data.registryComparison.status === 'AGREES'
                ? 'Статусы совпадают.'
                : 'Сопоставимая дата статуса Checko не подтверждена.'}
          </p>
        )}
        {rows('Изменения реестра', f.changes, 'timeline')}
      </section>
      <section>
        <h3>Суды и реестры</h3>
        <p>Видимый остаток по подтверждённо активным производствам · {rub(f.activeEnforcementRub)}</p>
        {rows('Исполнительные производства', f.enforcements, 'enforcements')}
        {rows('Арбитражные дела', f.cases, 'legal-cases')}
        {rows('Проверки', f.inspections, 'inspections')}
        {rows(
          'Сообщения Федресурса',
          f.messages.filter((x) => lookup(x.receiptId)?.method === 'fedresurs'),
          'fedresurs',
        )}
        {rows(
          'Сообщения ЕФРСБ',
          f.messages.filter((x) => lookup(x.receiptId)?.method === 'bankruptcy-messages'),
          'bankruptcy-messages',
        )}
      </section>
      <section>
        <h3>Госзакупки</h3>
        <small>Провайдер Checko · первоисточник ЕИС · {dt(f.fetchedAt)}</small>
        <p>
          Всего по ответам · {p.totalCount ?? 'не определено'}. Показано · {p.visibleCount}.{' '}
          {p.complete ? 'Выборка полная.' : 'Покрытие неполное или неизвестно.'}
        </p>
        <div className={styles.metrics}>
          {[
            ['Сумма контрактов', rub(p.totalAmount)],
            ['Действуют', p.activeCount],
            ['Исполнены', p.completedCount],
            ['Действующие, ₽', rub(p.activeAmount)],
            ['За 365 дней', p.recentCount],
            [
              'Доля крупнейшего заказчика',
              p.topCustomerShare == null
                ? null
                : p.topCustomerShare.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + '%',
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <small>{k}</small>
              <b>{v ?? 'Не определено'}</b>
            </div>
          ))}
        </div>
        <p>{p.lawSplit.map((v) => v.law + ' · ' + (v.total ?? 'нет подтверждённого числа')).join(' / ')}</p>
        <details>
          <summary>Записи контрактов · {p.visibleCount}</summary>
          {p.items.map((r, n) => (
            <article key={r.receiptId + n}>
              <b>
                {r.number} · {r.law}
              </b>
              <p>{r.subject ?? 'Предмет не указан'}</p>
              <p>
                {rub(r.amount)} · {label(r.state)} · роль компании {label(r.role)}
              </p>
              <p>
                Заказчик · {r.customer.name ?? r.customer.inn ?? 'не указан'}
                <br />
                Поставщики ·{' '}
                {r.suppliers
                  .map((s) => s.name ?? s.inn)
                  .filter(Boolean)
                  .join(', ') || 'не раскрыты'}
              </p>
              <small>
                Подписан {dt(r.signedAt)} · исполнение {dt(r.executionAt)} · {source(lookup(r.receiptId))}
              </small>
              {r.url && (
                <p>
                  <a href={r.url} rel="noreferrer">
                    Карточка ЕИС
                  </a>
                </p>
              )}
            </article>
          ))}
        </details>
      </section>
      <RnpSection rows={f.rnp} receipts={f.receipts} />
      {f.reportedRnp != null && (
        <p>
          Отметка РНП в карточке Checko · {f.reportedRnp ? 'есть' : 'отсутствует'}. Дата и период действия записи
          требуют подтверждения.
        </p>
      )}
      <details>
        <summary>Состояние методов Checko</summary>
        {f.receipts.map((r) => (
          <article key={r.id}>
            <b>
              {methods[r.method] ?? r.method} · {label(r.status)}
            </b>
            <small>
              {source(r)}
              {r.warnings.includes('PARTIAL_COVERAGE') ? ' · выборка неполная' : ''}
              {r.status === 'FAILED' ? ' · ' + (r.warnings[0] ?? 'Ошибка провайдера') : ''}
            </small>
          </article>
        ))}
      </details>
    </>
  );
}
export function ExternalSourceCards({ model, saved, readOnly=false }: { readOnly?:boolean; model: WorkspaceModelV1; saved?: () => Promise<void> }) {
  const url =
    '/api/checko?analysisId=' +
    encodeURIComponent(model.analysisId) +
    '&inn=' +
    encodeURIComponent(model.basic.analysis.company.inn);
  const [data, setData] = useState<View>(),
    [busy, setBusy] = useState(false);
  const live = useRef(0);
  const scope = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    const sequence = ++live.current;
    fetch(url + '&cacheOnly=1', { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json())
      .then((v) => {
        if (sequence === live.current) setData(v);
      })
      .catch(() => {
        if (!controller.signal.aborted && sequence === live.current) setData({ providerStatus: 'FAILED' });
      });
    return () => {
      controller.abort();
    };
  }, [url]);
  async function refresh() {
    const seq = ++live.current;
    const signal = scope.current?.signal;
    setBusy(true);
    try {
      const r = await fetch(url + '&refresh=1', { cache: 'no-store', signal }),
        v = await r.json();
      if (signal?.aborted || seq !== live.current) return;
      setData(v);
      if (r.ok && v.fetchedAt) await saved?.();
    } catch {
      if (!signal?.aborted && seq === live.current) setData({ providerStatus: 'FAILED' });
    } finally {
      if (!signal?.aborted && seq === live.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Внешние источники" className={['pc-panel', styles.panel].filter(Boolean).join(' ')}>
      <h2>Внешние источники</h2>
      <p>
        Checko · {data ? label(data.providerStatus) : 'загружаем состояние'}
        {data?.fetchedAt &&
          ' · получено ' + dt(data.fetchedAt) + ' · ' + (data.stale ? 'срок кэша истёк' : 'кэш до 24 часов')}
      </p>
      <p>Прямой ЕИС · не настроен</p>
      {data?.error && <p>{data.error}</p>}
      {data?.externalFacts ? (
        <Facts data={data} />
      ) : (
        data?.company && (
          <p>
            {data.company.name} · {data.company.status}. Госзакупки по доступным данным ·{' '}
            {data.contracts?.totalCount ?? 'не определено'}.
          </p>
        )
      )}
      {data?.legacyReceipts && (
        <p>Сохранён профиль прежней версии. Детальная проверка происхождения появится после обновления.</p>
      )}
      {!readOnly && !model.access.readOnly && data?.providerConfigured && (
        <button type="button" disabled={busy} onClick={refresh}>
          {busy ? 'Получаем сведения…' : 'Обновить сведения Checko'}
        </button>
      )}
    </section>
  );
}
