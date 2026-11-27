import { useState } from 'react';
import { Card, Table } from './primitives';
import { money, type ViewData, type Page, type Row } from './types';

const modes = ['Все потоки', 'Операционные', 'Долг и налоги'];
const labels = [
  ['Поступления', 'Списания'],
  ['Операционные поступления', 'Платежи поставщикам и персоналу'],
  ['Долг и лизинг', 'В бюджет'],
];
const incomingColors = ['#059669', '#3b82f6', '#94a3b8'];
const outgoingColors = [
  '#2563eb',
  '#60a5fa',
  '#d97706',
  '#6366f1',
  '#818cf8',
  '#94a3b8',
  '#cbd5e1',
  '#e2e8f0',
];
const partNames = [
  'Поставщики',
  'Персонал',
  'В бюджет',
  'Основной долг',
  'Проценты',
  'Лизинг',
  'Прочее',
  'Не определено',
];
function coverageLabel(coverage?: string) {
  if (coverage === 'FULL') return 'Полный месяц';
  if (coverage === 'PARTIAL') return 'Неполный месяц';
  if (coverage === 'MISSING') return 'Нет покрытия';
  if (coverage === 'OVERLAP') return 'Пересечение периодов';
  return null;
}
function bars(row: Row, mode: number) {
  const value = (n: number | null) => (n == null ? [] : [n]);
  if (mode === 0) return [row.receipts ?? value(row.incoming), row.parts ?? value(row.outgoing)];
  if (mode === 1) return [value(row.operating), row.parts?.slice(0, 2) ?? []];
  return [value(row.debt), value(row.tax)];
}
export function CashCards({ data: d, go }: { data: ViewData; go: (p: Page) => void }) {
  const [mode, setMode] = useState(0);
  const [selectedMonthId, setSelectedMonthId] = useState('');
  const rows = d.months;
  const activeMonth = rows.find((r) => r.id === selectedMonthId) ?? rows.at(-1) ?? null;
  const series = rows.map((r) => bars(r, mode));
  const max = Math.max(0, ...series.flatMap((groups) => groups.map((g) => g.reduce((a, b) => a + b, 0))));
  const ceiling =
    max > 0
      ? Math.ceil((max * 1.2) / (2 * 10 ** Math.floor(Math.log10(max) - 1))) *
        2 *
        10 ** Math.floor(Math.log10(max) - 1)
      : 0;
  const step = 592 / Math.max(1, rows.length),
    width = Math.min(23, step * 0.26);
  const categories = d.categories,
    total = categories.reduce((a, c) => a + c.value, 0);
  const circle = 2 * Math.PI * 74;

  const operatingOutflow =
    activeMonth &&
    activeMonth.outgoing !== null &&
    activeMonth.debt !== null &&
    activeMonth.tax !== null &&
    activeMonth.debt + activeMonth.tax <= activeMonth.outgoing + 0.005
      ? Math.max(0, Math.round((activeMonth.outgoing - activeMonth.debt - activeMonth.tax) * 100) / 100)
      : null;

  const hasReceiptBreakdown =
    activeMonth != null &&
    (activeMonth.operating !== null ||
      activeMonth.otherReceipts != null ||
      activeMonth.nonOperatingReceipts != null ||
      activeMonth.unknownInflows != null);
  const hasDebtBreakdown =
    activeMonth != null &&
    (activeMonth.principal != null ||
      activeMonth.interest != null ||
      activeMonth.leasing != null ||
      activeMonth.unsplit != null);
  const hasTaxBreakdown =
    activeMonth != null && (activeMonth.taxOnly != null || activeMonth.social != null);
  const activeCoverage = coverageLabel(activeMonth?.coverage);

  return (
    <div className="grid two">
      <Card
        title="Движение денег"
        sub={'млн ₽ · ' + d.period + ' · выберите месяц на графике'}
        action={
          <button className="text-link" onClick={() => go('banking')}>
            Подробнее ↗
          </button>
        }
      >
        <div className="segmented">
          {modes.map((v, i) => (
            <button
              key={v}
              className={mode === i ? 'active' : ''}
              aria-pressed={mode === i}
              onClick={() => setMode(i)}
            >
              {v}
            </button>
          ))}
        </div>
        {ceiling > 0 ? (
          <svg className="chart" viewBox="0 0 640 240" role="img" aria-label={modes[mode] + ' · ' + d.period}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line className="gridline" x1="38" y1={211 - i * 49} x2="630" y2={211 - i * 49} />
                <text x="29" y={214 - i * 49} textAnchor="end">
                  {new Intl.NumberFormat('ru', { maximumFractionDigits: 2 }).format((ceiling * i) / 4e6)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const isSelected = activeMonth?.id === r.id;
              return (
                <g
                  key={r.id}
                  className={'chart-bar-group' + (isSelected ? ' is-selected' : '')}
                  role="button"
                  tabIndex={0}
                  aria-label={'Показать расшифровку за ' + r.label}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMonthId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMonthId(r.id);
                    }
                  }}
                >
                  <rect
                    className="chart-hit"
                    x={38 + step * i + 2}
                    y="12"
                    width={Math.max(8, step - 4)}
                    height="224"
                    rx="6"
                    fill={isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}
                    stroke={isSelected ? '#3b82f6' : 'transparent'}
                    strokeWidth="1"
                  />
                  <text
                    x={38 + step * (i + 0.5)}
                    y="232"
                    textAnchor="middle"
                    fill={isSelected ? '#0f172a' : undefined}
                    fontWeight={isSelected ? 700 : undefined}
                  >
                    {rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0 || isSelected ? r.label : ''}
                  </text>
                  {series[i].map((group, j) =>
                    group.map((n, k) => {
                      const y = 211 - (group.slice(0, k + 1).reduce((a, b) => a + b, 0) / ceiling) * 196;
                      const color =
                        mode === 2
                          ? ['#6366f1', '#d97706'][j]
                          : j === 0
                            ? incomingColors[k]
                            : outgoingColors[k];
                      return (
                        <rect
                          key={j + '-' + k}
                          x={38 + step * (i + 0.5) + (j === 0 ? -width - 3 : 3)}
                          y={y}
                          width={width}
                          height={(n / ceiling) * 196}
                          fill={color}
                          opacity={activeMonth && !isSelected ? 0.65 : 1}
                          rx="2"
                        >
                          <title>
                            {r.label} · {j === 1 && group.length > 1 ? partNames[k] : labels[mode][j]} ·{' '}
                            {money(n)}
                          </title>
                        </rect>
                      );
                    }),
                  )}
                </g>
              );
            })}
          </svg>
        ) : (
          <p className="note">
            {series.some((gs) => gs.some((g) => g.length))
              ? 'По отражённым операциям сумма равна нулю.'
              : 'Для выбранного периода детализация не поступила.'}
          </p>
        )}
        {mode === 1 && rows.length > 0 && series.every((groups) => !groups[1].length) && (
          <p className="note">В источнике отдельно выделены только операционные поступления.</p>
        )}
        <div className="legend">
          {labels[mode].map((s, i) => (
            <span key={s}>
              <i
                className="dot"
                style={{ background: (mode === 2 ? ['#6366f1', '#d97706'] : ['#059669', '#2563eb'])[i] }}
              />
              {s}
            </span>
          ))}
        </div>
        {activeMonth && (
          <section className="cash-month-detail" aria-label={'Расшифровка за ' + activeMonth.label}>
            <div className="cash-month-head">
              <div>
                <strong>{activeMonth.label}</strong>
                {activeCoverage && <span className="chip">{activeCoverage}</span>}
              </div>
              <span className="cash-month-net">
                Чистый поток: <b>{money(activeMonth.net)}</b>
              </span>
            </div>
            <div className="cash-month-grid">
              <div className="cash-month-col">
                <span className="cash-month-label">Поступления</span>
                <strong className="cash-month-total green">{money(activeMonth.incoming)}</strong>
                <dl className="cash-month-rows">
                  {hasReceiptBreakdown ? (
                    <>
                      <div>
                        <dt>Операционные</dt>
                        <dd>{money(activeMonth.operating)}</dd>
                      </div>
                      <div>
                        <dt>Прочие внешние</dt>
                        <dd>{money(activeMonth.otherReceipts ?? activeMonth.nonOperatingReceipts ?? null)}</dd>
                      </div>
                      {activeMonth.unknownInflows != null && activeMonth.unknownInflows > 0 && (
                        <div>
                          <dt>Без категории</dt>
                          <dd>{money(activeMonth.unknownInflows)}</dd>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <dt>Детализация</dt>
                      <dd>—</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="cash-month-col">
                <span className="cash-month-label">Операционные списания</span>
                <strong className="cash-month-total">{money(operatingOutflow)}</strong>
                <dl className="cash-month-rows">
                  <div>
                    <dt>Всего списания</dt>
                    <dd>{money(activeMonth.outgoing)}</dd>
                  </div>
                  {activeMonth.individualBusiness != null ? (
                    <div>
                      <dt>Переводы физлицам</dt>
                      <dd>{money(activeMonth.individualBusiness)}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt>Детализация</dt>
                      <dd>—</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="cash-month-col">
                <span className="cash-month-label">Долги и кредиты</span>
                <strong className="cash-month-total">{money(activeMonth.debt)}</strong>
                <dl className="cash-month-rows">
                  {hasDebtBreakdown ? (
                    <>
                      <div>
                        <dt>Основной долг</dt>
                        <dd>{money(activeMonth.principal ?? null)}</dd>
                      </div>
                      <div>
                        <dt>Проценты</dt>
                        <dd>{money(activeMonth.interest ?? null)}</dd>
                      </div>
                      <div>
                        <dt>Лизинг</dt>
                        <dd>{money(activeMonth.leasing ?? null)}</dd>
                      </div>
                      {activeMonth.unsplit != null && activeMonth.unsplit > 0 && (
                        <div>
                          <dt>Без разбивки</dt>
                          <dd>{money(activeMonth.unsplit)}</dd>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <dt>Детализация</dt>
                      <dd>—</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="cash-month-col">
                <span className="cash-month-label">Налоги и сборы</span>
                <strong className="cash-month-total amber">{money(activeMonth.tax)}</strong>
                <dl className="cash-month-rows">
                  {hasTaxBreakdown ? (
                    <>
                      <div>
                        <dt>Налоги</dt>
                        <dd>{money(activeMonth.taxOnly ?? null)}</dd>
                      </div>
                      <div>
                        <dt>Страховые взносы</dt>
                        <dd>{money(activeMonth.social ?? null)}</dd>
                      </div>
                    </>
                  ) : (
                    <div>
                      <dt>Детализация</dt>
                      <dd>—</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </section>
        )}
        <details className="chart-data">
          <summary>Значения графика</summary>
          <Table
            label="Суммы по месяцам"
            heads={['Месяц', ...labels[mode]]}
            rows={rows.map((r, i) => [
              r.label,
              ...series[i].map((g) => (g.length ? money(g.reduce((a, b) => a + b, 0)) : '—')),
            ])}
          />
        </details>
        <div className="source">
          <span>◇ Банковские выписки</span>
          <button className="text-link" onClick={() => go('documents')}>
            Основания ↗
          </button>
        </div>
      </Card>
      <Card title="Структура платежей" sub="Что составляет списания за выбранный период">
        {total > 0 && (
          <div className="donut-wrap">
            <svg viewBox="0 0 190 190" role="img" aria-label="Категории списаний">
              {categories.map((c, i) => (
                <circle
                  key={c.label}
                  cx="95"
                  cy="95"
                  r="74"
                  fill="none"
                  stroke={c.color}
                  strokeWidth="16"
                  strokeDasharray={(circle * c.value) / total + ' ' + circle * (1 - c.value / total)}
                  strokeDashoffset={
                    (-circle * categories.slice(0, i).reduce((a, v) => a + v.value, 0)) / total
                  }
                >
                  <title>
                    {c.label} · {money(c.value)}
                  </title>
                </circle>
              ))}
            </svg>
            <div className="donut-inner">
              <b>{money(total).split(/ (?:млн )?₽$/)[0]}</b>
              <small>{money(total).endsWith('млн ₽') ? 'млн ₽' : '₽'} · списания</small>
            </div>
          </div>
        )}
        {categories.length ? (
          categories.map((c) => (
            <div className="category" key={c.label}>
              <span>
                <i className="dot" style={{ background: c.color }} />
                {c.label}
              </span>
              <b>{money(c.value)}</b>
            </div>
          ))
        ) : (
          <p className="note">
            Полной разбивки списаний по категориям для этого периода нет. Доступные суммы приведены в движении
            денег.
          </p>
        )}
        <div className="source">
          <span>◇ Классификация операций</span>
          <button className="text-link" onClick={() => go('banking')}>
            Основания ↗
          </button>
        </div>
      </Card>
    </div>
  );
}
