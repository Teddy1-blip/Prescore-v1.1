import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { ApprovedShell } from '../../app/components/workspace/approved/shell';
import { ApprovedPage } from '../../app/components/workspace/approved/pages';
import { ApplicationForm } from '../../app/components/workspace/approved/application-form';
import { Drawer } from '../../app/components/workspace/approved/primitives';
import {
  colorList,
  focusLabels,
  money,
  pages,
  type ViewData,
  type Page,
  type Application,
  type Task,
} from '../../app/components/workspace/approved/types';
import fixture from './fixture.json';
import '../../app/components/workspace/approved/client.css';

const companyNames = { trade: 'Демо-Трейд', service: 'Демо-Сервис' };
const choices = Object.entries(companyNames).map(([id, label]) => ({ id, label }));
const periods = [
  { id: '6', label: 'Май — октябрь 2026' },
  { id: '3', label: 'Август — октябрь 2026' },
  { id: '1', label: 'Октябрь 2026' },
];
function snapshot(
  id: keyof typeof companyNames,
  period: string,
  tasks: Task[],
  promises: Record<string, string>,
): ViewData {
  const f = id === 'trade' ? 1 : 0.6,
    unit = f * 1e6;
  const all = fixture.raw.map((r, i) => {
    const ps = [r.supplier, r.payroll, r.tax, r.principal, r.interest, r.lease, r.misc, r.unknown].map(
        (v) => v * unit,
      ),
      receipts = [r.op, r.loan, r.other].map((v) => v * unit);
    const incoming = receipts.reduce((a, b) => a + b, 0),
      outgoing = ps.reduce((a, b) => a + b, 0);
    return {
      id: '2026-' + String(i + 5).padStart(2, '0'),
      label: r.m,
      incoming,
      outgoing,
      net: incoming - outgoing,
      operating: r.op * unit,
      debt: (r.principal + r.interest + r.lease) * unit,
      tax: r.tax * unit,
      parts: ps,
      receipts,
    };
  });
  const months = all.slice(-Number(period)),
    sum = (key: 'operating' | 'incoming' | 'outgoing' | 'net') => months.reduce((a, r) => a + r[key], 0),
    closing = 2 * unit + all.reduce((a, r) => a + r.net, 0);
  const cats = ['Поставщики', 'Персонал', 'В бюджет', 'Долг и лизинг', 'Прочее', 'Не определено'].map(
    (label, i) => ({
      label,
      color: colorList[i],
      value: months.reduce((a, r) => a + (i === 3 ? r.debt : r.parts[i < 3 ? i : i + 2]), 0),
    }),
  );
  return {
    company: companyNames[id],
    asOf: '31.10.2026',
    period: periods.find((p) => p.id === period)!.label,
    plan: '6 500 ₽ / 30 дней',
    title: 'Деньги в обороте есть.\nФинансирование требует подготовки.',
    summary:
      'Остаток на счетах — ' +
      money(closing) +
      '. Дебиторка — ' +
      money(9.8 * unit) +
      '. Уточните графики обязательств и сроки оплаты покупателей, прежде чем определять новую кредитную нагрузку.',
    score: 849,
    scoreStatus: 'Частичный анализ',
    components: [
      { label: 'Финансовая устойчивость', score: 328, max: 400 },
      { label: 'Операционное поведение', score: 246, max: 300 },
      { label: 'Долг и кредитная история', score: 200, max: 200 },
      { label: 'Юридический профиль', score: 100, max: 100 },
    ],
    capacity: 'Нужны графики',
    capacityText: 'Для оценки дополнительного платежа нужны графики будущих выплат.',
    opening: closing - sum('net'),
    closing,
    closingDate: 'На 31 октября · три учебных счёта',
    operating: sum('operating'),
    incoming: sum('incoming'),
    outgoing: sum('outgoing'),
    net: sum('net'),
    debt: 8.4 * unit,
    debtDate: 'На 31 октября · без свободных лимитов',
    months,
    categories: cats,
    tasks,
    factors: [
      { title: '38% поступлений — один покупатель', detail: 'Доля операционных поступлений за период.' },
    ],
    products: [
      { title: 'Оборотная линия', detail: 'Закупка и временная потребность' },
      { title: 'Факторинг', detail: 'Финансирование под требования' },
      { title: 'Лизинг', detail: 'Использование оборудования' },
    ],
    fiscalDate: '2025 · на 31.12.2025',
    bfo: [
      ['Выручка', '2110', money(96 * unit), '31.12.2025'],
      ['Чистая прибыль', '2400', money(7.2 * unit), '31.12.2025'],
      ['Капитал', '1300', money(12 * unit), '31.12.2025'],
      ['Оборотные активы', '1200', money(23 * unit), '31.12.2025'],
      ['Краткосрочные обязательства', '1500', money(25 * unit), '31.12.2025'],
      ['Текущая ликвидность', '1200 / 1500', '0,92', '31.12.2025'],
    ],
    obligations: [
      ['Кредитная линия', money(5.2 * unit), 'График неполный'],
      ['Оборотный кредит', money(3.2 * unit), 'Остаток указан'],
    ],
    sources: [
      { label: 'Банковские выписки', date: 'Май — октябрь 2026', status: 'Учебные данные', route: 'banking' },
      { label: 'Бухгалтерская отчётность', date: '31.12.2025', status: 'Учебные данные', route: 'banking' },
      { label: 'ОСВ по счёту 62', date: '31.10.2026', status: 'Учебные данные', route: 'counterparties' },
      { label: 'Кредитная история', date: '31.10.2026', status: 'Остатки раскрыты', route: 'analysis' },
      { label: 'Графики платежей', date: 'Ближайшие выплаты', status: 'Нужно уточнить', route: 'actions' },
    ],
    ar: {
      asOf: '31.10.2026',
      total: 9.8 * unit,
      advance: 1.2 * unit,
      overdue: 2.6 * unit,
      unclassified: 1.6 * unit,
      rows: fixture.counterparties.map((r) => ({
        id: r.id,
        name: r.name,
        amount: r.amount * unit,
        due: r.dueLabel,
        status: r.status,
        promise: promises[r.id],
      })),
    },
  };
}
const parse = () => {
  const q = new URLSearchParams(location.hash.slice(1));
  const route = q.get('view') || 'home';
  return {
    page: (Object.hasOwn(pages, route) ? route : 'home') as Page,
    company: q.get('company') === 'service' ? ('service' as const) : ('trade' as const),
    period: ['1', '3'].includes(q.get('period') || '') ? q.get('period')! : '6',
  };
};
type Work = { tasks: Task[]; apps: Application[]; promises: Record<string, string> };
const fresh = (): Work => ({
  tasks: fixture.initialTasks.map((t) => ({
    ...t,
    route: (
      { credit: 'analysis', finance: 'banking', counterparties: 'counterparties' } as Record<string, Page>
    )[t.route],
  })),
  apps: [],
  promises: {},
});
function Preview() {
  const [ctx, setCtx] = useState(parse),
    [focus, setFocus] = useState(focusLabels[0]),
    [modal, setModal] = useState(''),
    [all, setAll] = useState({ trade: fresh(), service: fresh() });
  const { company, page, period } = ctx,
    w = all[company],
    d = snapshot(company, period, w.tasks, w.promises);
  useEffect(() => {
    function sync() {
      setCtx(parse());
      setModal('');
    }
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function route(p: Partial<typeof ctx>) {
    const next = { ...ctx, ...p };
    location.hash = new URLSearchParams({
      view: next.page,
      company: next.company,
      period: next.period,
    }).toString();
  }
  function change(next: Work) {
    setAll((a) => ({ ...a, [company]: next }));
  }
  const newApp = (product = '') => setModal('application:' + product);
  return (
    <ApprovedShell
      page={page}
      available={Object.keys(pages)}
      preview
      company={d.company}
      companyId={company}
      companies={choices}
      date="Учебный срез · 31 октября 2026"
      sources={['Выписки', 'БФО', 'ОСВ 62']}
      period={period}
      periods={periods}
      focus={focus}
      onFocus={setFocus}
      onPeriod={(period) => route({ period })}
      onCompany={(id) => route({ company: id as typeof company })}
      choose={(v) => route({ page: v as Page })}
      onApplication={newApp}
    >
      <ApprovedPage
        key={page + company}
        page={page}
        data={d}
        apps={w.apps}
        focus={focus}
        go={(page) => route({ page })}
        newApp={newApp}
        newTask={() => setModal('task')}
        toggleTask={(id) =>
          change({ ...w, tasks: w.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })
        }
        promise={(id, date) => change({ ...w, promises: { ...w.promises, [id]: date } })}
      />
      {modal.startsWith('application:') && (
        <ApplicationForm
          product={modal.slice('application:'.length) || undefined}
          company={d.company}
          close={() => setModal('')}
          save={async (input) => {
            change({
              ...w,
              apps: [...w.apps, { ...input, id: 'DEMO-' + (w.apps.length + 1), status: 'Черновик' }],
            });
            route({ page: 'applications' });
          }}
        />
      )}
      {modal === 'task' && (
        <Drawer title="Новое действие" company={d.company} close={() => setModal('')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = String(new FormData(e.currentTarget).get('title') || '').trim();
              if (title) {
                change({
                  ...w,
                  tasks: [
                    ...w.tasks,
                    {
                      id: 't' + (w.tasks.length + 1),
                      title,
                      detail: 'Учебная задача',
                      done: false,
                      route: 'actions',
                    },
                  ],
                });
                setModal('');
              }
            }}
          >
            <label className="formfield">
              Что нужно сделать
              <input required name="title" maxLength={140} />
            </label>
            <button className="btn primary">Сохранить задачу</button>
          </form>
        </Drawer>
      )}
    </ApprovedShell>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
