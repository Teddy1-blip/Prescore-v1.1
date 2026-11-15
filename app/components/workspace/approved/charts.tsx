import { useState } from 'react';
import { Card, Table } from './primitives';
import { money, type ViewData, type Page, type Row } from './types';

const modes = ['Все потоки', 'Операционные', 'Долг и налоги'];
const labels = [
  ['Поступления', 'Списания'],
  ['Операционные поступления', 'Платежи поставщикам и персоналу'],
  ['Долг и лизинг', 'В бюджет'],
];
const incomingColors = ['#23a28b', '#b0a0e5', '#d6ceed'];
const outgoingColors = [
  '#7887db',
  '#a4b3ef',
  '#dfb05f',
  '#9c87d4',
  '#c2b1e7',
  '#b8a6d5',
  '#bfc9d8',
  '#e3e7ef',
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
function bars(row: Row, mode: number) {
  const value = (n: number | null) => (n == null ? [] : [n]);
  if (mode === 0) return [row.receipts ?? value(row.incoming), row.parts ?? value(row.outgoing)];
  if (mode === 1) return [value(row.operating), row.parts?.slice(0, 2) ?? []];
  return [value(row.debt), value(row.tax)];
}
export function CashCards({ data: d, go }: { data: ViewData; go: (p: Page) => void }) {
  const [mode, setMode] = useState(0);
  const rows = d.months;
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
  return (
    <div className="grid two">
      <Card
        title="Движение денег"
        sub={'млн ₽ · ' + d.period + ' · внешние потоки'}
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
            {rows.map((r, i) => (
              <g key={r.id}>
                <text x={38 + step * (i + 0.5)} y="232" textAnchor="middle">
                  {rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0 ? r.label : ''}
                </text>
                {series[i].map((group, j) =>
                  group.map((n, k) => {
                    const y = 211 - (group.slice(0, k + 1).reduce((a, b) => a + b, 0) / ceiling) * 196;
                    const color =
                      mode === 2
                        ? ['#9c87d4', '#dfb05f'][j]
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
                        rx="1"
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
            ))}
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
                style={{ background: (mode === 2 ? ['#9c87d4', '#dfb05f'] : ['#23a28b', '#7887db'])[i] }}
              />
              {s}
            </span>
          ))}
        </div>
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
