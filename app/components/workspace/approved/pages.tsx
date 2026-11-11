import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card, Drawer, Kpi, Review, Table } from './primitives';
import { CashCards } from './charts';
import { money, rub, type Application, type Page, type ViewData } from './types';

export type ScreenProps = {
  page: Page;
  data: ViewData;
  focus: string;
  go: (p: Page) => void;
  apps: Application[];
  details?: ReactNode;
  newApp?: (product?: string) => void;
  toggleTask?: (id: string) => void;
  newTask?: () => void;
  promise?: (id: string, date: string) => void;
  operations?: ReactNode;
};
export function ApprovedPage(p: ScreenProps) {
  const { page, data: d, go } = p;
  const [statement, setStatement] = useState(false),
    [drawer, setDrawer] = useState(''),
    [promiseDate, setPromiseDate] = useState('');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!p.details || !location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target && detailsRef.current?.contains(target)) {
      detailsRef.current.open = true;
      target.scrollIntoView();
    }
  }, [page, !!p.details]);
  const jump = (label: string, target: Page) => (
    <button className="text-link" onClick={() => go(target)}>
      {label} →
    </button>
  );
  const metric = (label: string, value: string, foot: string, target: Page, tone = '') => (
    <Kpi label={label} value={value} foot={foot} click={() => go(target)} tone={tone} />
  );
  const list = (limit?: number) =>
    d.tasks.slice(0, limit).map((t) => (
      <div key={t.id} className={'task-row' + (t.done ? ' done' : '')}>
        {p.toggleTask ? (
          <input
            type="checkbox"
            aria-label={t.title}
            checked={!!t.done}
            onChange={() => p.toggleTask?.(t.id)}
          />
        ) : (
          <span aria-hidden="true">◇</span>
        )}
        <div className="text">
          <b>{t.title}</b>
          <small>{t.detail}</small>
        </div>
        <button
          className="text-link"
          aria-label={'Открыть ' + t.title}
          onClick={() => setDrawer('task:' + t.id)}
        >
          ↗
        </button>
      </div>
    ));
  const taskCard = (
    <Card
      title="Ближайшие действия"
      sub={p.toggleTask ? 'Выполнение задач не меняет учётные суммы' : 'Рекомендации из выбранного анализа'}
      action={<span className="chip purple">{d.tasks.length} действий</span>}
    >
      {d.tasks.length ? (
        list(3)
      ) : (
        <p className="note">После формирования плана здесь появятся ближайшие действия.</p>
      )}
      {p.toggleTask && (
        <progress
          className="progress"
          max={d.tasks.length || 1}
          value={d.tasks.filter((t) => t.done).length}
        />
      )}
      <div>{jump('Открыть весь план', 'actions')}</div>
    </Card>
  );
  const first = d.factors[0],
    counter = d.ar?.rows.find((v) => 'ar:' + v.id === drawer),
    task = d.tasks.find((v) => 'task:' + v.id === drawer),
    app = p.apps.find((v) => 'app:' + v.id === drawer);
  const footlink = (title: string, desc: string, target: Page) => (
    <button className="plan-link" onClick={() => go(target)}>
      <strong>{title} ↗</strong>
      <small>{desc}</small>
    </button>
  );
  let content: ReactNode;
  if (page === 'home')
    content = (
      <>
        <section className="client-hero">
          <div>
            <div className="client-eyebrow">КРАТКОЕ ЗАКЛЮЧЕНИЕ</div>
            <h2>
              {d.title.split('\n').map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </h2>
            <p>{d.summary}</p>
            <div className="hero-foot">
              <button className="btn" onClick={() => go('analysis')}>
                Открыть заключение ↗
              </button>
              {d.tasks.length > 0 && <span className="chip dark">{d.tasks.length} действий в плане</span>}
            </div>
          </div>
          <div className="hero-score">
            <div className="score-label">Prescore Index</div>
            <div className="score-number">
              {d.score ?? '—'}
              <small>/ 1000</small>
            </div>
            <div className="score-scale">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <span className="chip dark">{d.scoreStatus}</span>
            <p className="sub">Основания и ограничения раскрыты в кредитном профиле.</p>
          </div>
        </section>
        <div className="kpis">
          {metric('Деньги на счетах', money(d.closing), d.closingDate, 'banking')}
          {metric('Операционные поступления', money(d.operating), d.period, 'banking')}
          {metric(
            'Дебиторская задолженность',
            money(d.ar?.total ?? null),
            d.ar ? 'ОСВ · ' + d.ar.asOf : 'Для остатка нужна ОСВ 62',
            'counterparties',
          )}
          {metric('Остаток основного долга', money(d.debt), d.debtDate, 'analysis')}
        </div>
        <CashCards data={d} go={go} />
        <div className="grid two gap-top">
          {taskCard}
          <Card
            title="Перед следующим решением"
            sub={
              p.focus === 'Бухгалтер'
                ? 'Проверьте источники и неразнесённые операции.'
                : p.focus === 'Финансист'
                  ? 'Уточните графики долга и сроки поступлений.'
                  : 'Сроки денег и условия финансирования'
            }
          >
            <Review title="Дополнительный платёж">{d.capacityText}</Review>
            {jump('Проверить документы', 'documents')}
            {first && <Review title={first.title}>{first.detail}</Review>}
          </Card>
        </div>
        <div className="grid equal gap-top">
          <Card title="Внутри бизнеса" sub="Расчёты с покупателями">
            <p className="note">Остатки, договорные сроки и обещания оплаты относятся к разным событиям.</p>
            {footlink('Работать с дебиторкой', 'Остатки · сроки · договорённости', 'counterparties')}
          </Card>
          <Card title="Внешнее финансирование" sub="От анализа к обращению">
            <p className="note">Опишите цель, нужную сумму и срок финансирования.</p>
            {footlink('Подготовить финансовую задачу', 'Цель · документы · требования · заявка', 'financing')}
          </Card>
        </div>
      </>
    );
  if (page === 'banking')
    content = (
      <>
        <div className="section-tabs">
          <button className={!statement ? 'active' : ''} onClick={() => setStatement(false)}>
            Деньги и платежи
          </button>
          <button className={statement ? 'active' : ''} onClick={() => setStatement(true)}>
            Бухгалтерская отчётность
          </button>
        </div>
        {statement ? (
          <Card title="БФО: показатели и основания" sub={d.fiscalDate || 'Отдельный отчётный период'}>
            {d.bfo.length ? (
              <Table
                label="Бухгалтерская отчётность"
                heads={['Показатель', 'Источник', 'Значение', 'Дата']}
                rows={d.bfo}
              />
            ) : (
              <p>Добавьте бухгалтерскую отчётность в документы компании.</p>
            )}
            {jump('Источники', 'documents')}
          </Card>
        ) : (
          <>
            <div className="kpis">
              {metric('На начало периода', money(d.opening), d.period, 'banking')}
              {metric('Все поступления', money(d.incoming), d.period, 'banking')}
              {metric('Все списания', money(d.outgoing), 'Внешние списания', 'banking')}
              {metric('Изменение денег', money(d.net), 'Чистый внешний поток', 'banking', 'green')}
            </div>
            <CashCards data={d} go={go} />
            <Card extra="gap-top" title="Месячные итоги" sub="Единые данные с обзором">
              <Table
                label="Месячные итоги"
                heads={['Месяц', 'Операционные', 'Все поступления', 'Списания', 'Изменение денег']}
                rows={d.months.map((r) => [
                  r.label,
                  money(r.operating),
                  money(r.incoming),
                  money(r.outgoing),
                  money(r.net),
                ])}
              />
            </Card>
          </>
        )}
      </>
    );
  if (page === 'analysis')
    content = (
      <>
        <div className="grid two">
          <Card title="Кредитное заключение" sub={d.asOf}>
            <div className="alert">
              <span>ⓘ</span>
              <span>
                <b>{d.title}</b> {d.summary}
              </span>
            </div>
            {d.factors.slice(0, 2).map((f) => (
              <Review key={f.title} title={f.title}>
                {f.detail}
              </Review>
            ))}
            <Review title="Следующее действие">
              {d.tasks[0]?.title ?? 'Посмотрите источники и доступные действия.'}
            </Review>
            {jump('Перейти к плану действий', 'actions')}
          </Card>
          <Card title={(d.score ?? '—') + ' / 1000'} sub={d.scoreStatus}>
            {d.components.map((c) => (
              <div className="barrow" key={c.label}>
                <div className="title">
                  <span>{c.label}</span>
                  <b>
                    {c.score} / {c.max}
                  </b>
                </div>
                <div className="bar">
                  <span style={{ width: (100 * c.score) / c.max + '%' }} />
                </div>
              </div>
            ))}
            <p className="note">Итог учитывает ограничения и потолки выбранного снимка.</p>
            <button className="text-link" onClick={() => setDrawer('score')}>
              Показать основания →
            </button>
          </Card>
        </div>
        <Card extra="gap-top" title="Обязательства компании" sub={d.debtDate}>
          {d.obligations.length ? (
            <Table
              label="Обязательства"
              heads={['Обязательство', 'Остаток долга', 'Основание']}
              rows={d.obligations}
            />
          ) : (
            <p>Для договоров и остатков добавьте кредитную историю.</p>
          )}
          {jump('Проверить документы', 'documents')}
        </Card>
      </>
    );
  if (page === 'counterparties')
    content = (
      <>
        {d.ar && (
          <div className="kpis">
            {metric('Положительная задолженность', money(d.ar.total), 'Остаток по ОСВ', 'counterparties')}
            {metric('Полученные авансы', money(d.ar.advance), 'Отдельно от задолженности', 'counterparties')}
            {metric(
              'Срок оплаты прошёл',
              money(d.ar.overdue),
              'По установленным срокам',
              'counterparties',
              'amber',
            )}
            {metric('Нужно уточнить сроки', money(d.ar.unclassified), 'Срок не установлен', 'counterparties')}
          </div>
        )}
        <Card
          title="Покупатели"
          sub={d.ar ? 'ОСВ 62 · срез ' + d.ar.asOf : 'Остатки и сроки по ОСВ 62'}
          action={
            p.newTask && (
              <button className="btn" onClick={p.newTask}>
                + Задача
              </button>
            )
          }
        >
          {d.ar ? (
            <Table
              label="Реестр покупателей"
              heads={['Контрагент', 'Задолженность', 'Договорный срок', 'Статус', 'Обещание оплаты']}
              rows={d.ar.rows.map((r, i) => [
                <button
                  className="table-action entity"
                  onClick={() => {
                    setPromiseDate(r.promise ?? '');
                    setDrawer('ar:' + r.id);
                  }}
                >
                  <span className="pill-avatar">{i + 1}</span>
                  <span>
                    <b>{r.name}</b>
                    <small>Открыть карточку ↗</small>
                  </span>
                </button>,
                money(r.amount),
                r.due || 'Уточняется',
                <span
                  className={
                    'chip ' +
                    (r.due === 'Нужно уточнить' ? 'warn' : r.status.includes('просроч') ? 'red' : 'ok')
                  }
                >
                  {r.status}
                </span>,
                r.promise || 'Не зафиксировано',
              ])}
            />
          ) : (
            <p className="note">
              Реестр ОСВ 62 пока не подключён к этому кабинету. Поступления по выписке доступны в разделе
              «Финансы».
            </p>
          )}
        </Card>
        <div className="grid equal gap-top">
          {taskCard}
          <Card title="Из учёта — в действие" sub="Сроки расчётов с покупателями">
            <p className="note">Обещание оплаты сохраняется отдельно от договорного срока и остатка.</p>
            {footlink('Нужны внешние деньги?', 'Подготовить запрос на финансирование', 'financing')}
          </Card>
        </div>
      </>
    );
  if (page === 'financing')
    content = (
      <>
        <div className="grid two">
          <Card title="Опишите задачу, а не только сумму" sub="Что финансируем и к какому сроку">
            <p className="note">Цель, срок и комплект документов относятся к выбранной компании.</p>
            <div className="timeline">
              {['01 · Задача', '02 · Подготовка', '03 · Предложения'].map((s, i) => (
                <div className={'step ' + (!i ? 'active' : '')} key={s}>
                  {s}
                  <small>{['Цель и срок', 'Данные и документы', 'Условия кредиторов'][i]}</small>
                </div>
              ))}
            </div>
            {p.newApp && (
              <button className="btn primary" onClick={() => p.newApp?.()}>
                Создать черновик заявки ↗
              </button>
            )}
          </Card>
          <Card title="Дополнительный платёж" sub="По выбранному анализу">
            <h2>{d.capacity || 'Нужны графики'}</h2>
            <p className="note">{d.capacityText}</p>
            {jump('Проверить документы', 'documents')}
          </Card>
        </div>
        <div className="grid thirds gap-top">
          {d.products.map((v) => (
            <Card key={v.title} title={v.title} sub={v.detail}>
              <span className="chip purple">Механика финансирования</span>
              {p.newApp && (
                <div className="product-request">
                  <button className="text-link" onClick={() => p.newApp?.(v.title)}>
                    Подготовить запрос →
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
        {p.operations}
      </>
    );
  if (page === 'applications')
    content = (
      <>
        <Card
          title="Работа по обращениям"
          sub={d.company}
          action={
            p.newApp && (
              <button className="btn primary" onClick={() => p.newApp?.()}>
                + Новая заявка
              </button>
            )
          }
        >
          {p.apps.length ? (
            <Table
              label="Заявки компании"
              heads={['Заявка', 'Цель / продукт', 'Сумма', 'Статус', 'Следующий шаг']}
              rows={p.apps.map((a) => [
                a.id,
                a.product,
                rub(a.amount),
                <span className="chip purple">{a.status}</span>,
                <button className="text-link" onClick={() => setDrawer('app:' + a.id)}>
                  {a.next || 'Проверить сведения'} →
                </button>,
              ])}
            />
          ) : (
            <div className="empty">
              <h3>Соберём первое обращение</h3>
              <p className="note">Цель, сумма и документы будут связаны с этой компанией.</p>
              {p.newApp && (
                <button className="btn" onClick={() => p.newApp?.()}>
                  Создать черновик
                </button>
              )}
            </div>
          )}
        </Card>
        <Card extra="gap-top" title="Кто работает с заявкой">
          <p className="note">Статус обращения и история действий доступны в карточке заявки.</p>
        </Card>
        {p.operations}
      </>
    );
  if (page === 'documents')
    content = (
      <>
        <Card title="Источники финансовой картины" sub={d.company}>
          <Table
            label="Источники"
            heads={['Источник', 'Дата / период', 'Состояние', 'Где используется']}
            rows={d.sources.map((s) => [
              <div className="entity">
                <span className="file-icon">◇</span>
                <b>{s.label}</b>
              </div>,
              s.date,
              <span
                className={
                  'chip ' +
                  (['Обработан', 'Учебные данные', 'Остатки раскрыты'].includes(s.status) ? 'ok' : 'warn')
                }
              >
                {s.status}
              </span>,
              jump(s.route === 'banking' ? 'Финансы' : 'Открыть раздел', s.route),
            ])}
          />
        </Card>
        <div className="grid equal gap-top">
          <Card title="Обновление данных" sub="Один источник — несколько представлений">
            {p.operations ?? (
              <p className="note">При добавлении источника проверяются его принадлежность и период.</p>
            )}
          </Card>
          <Card title="Проверка согласованности" sub="Основания и даты">
            <Review title="Денежные потоки и выручка">
              Поступления отражают движение денег. Выручка БФО относится к периоду отчётности.
            </Review>
            <Review title="Отсутствующий график">
              Для оценки будущих выплат нужны сроки и суммы обязательств.
            </Review>
          </Card>
        </div>
      </>
    );
  if (page === 'actions')
    content = (
      <div className="grid two">
        <Card
          title="План ближайших действий"
          sub="Рекомендации и задачи по выбранной компании"
          action={
            p.newTask && (
              <button className="btn" onClick={p.newTask}>
                + Задача
              </button>
            )
          }
        >
          {list()}
          {!d.tasks.length && <p className="note">План появится после расчёта рекомендаций.</p>}
          <div className="mini-panel">Завершение действия само по себе не подтверждает оплату.</div>
        </Card>
        <Card title="От действия к результату" sub="План завершается проверкой">
          <Review title="1. Уточнить основания">Сроки, документы, графики и спорные операции.</Review>
          <Review title="2. Выполнить договорённости">Работа с покупателями и подготовка документов.</Review>
          <Review title="3. Подтвердить изменение">Проверить новые данные и обновить анализ.</Review>
        </Card>
      </div>
    );
  if (page === 'billing')
    content = (
      <div className="grid equal">
        <section className="card premium">
          <span className="chip purple">ПОДПИСКА КОМПАНИИ</span>
          <h2>Prescore для компании</h2>
          {p.operations ?? (
            <>
              <div className="preview-price">
                {d.plan.split(' / ')[0]} <small>/ {d.plan.split(' / ')[1]}</small>
              </div>
              <p className="note">Полный кредитный профиль, рекомендации и план действий.</p>
              <div className="mini-panel">В учебном кабинете оплата отключена.</div>
            </>
          )}
        </section>
        <Card title="Условия доступа" sub="Кабинет выбранной компании">
          <Review title="Доступ относится к компании">
            Тариф и права определяются для выбранной компании.
          </Review>
          <Review title="Документы компании">Доступ к аналитике определяется состоянием подписки.</Review>
          <Review title="Заявки на финансирование">
            Условия обращения к кредитору рассматриваются отдельно.
          </Review>
        </Card>
      </div>
    );
  return (
    <>
      {content}
      {p.details && (
        <details ref={detailsRef} className="details">
          <summary id="approved-source-operations">Подробности, источники и доступные операции</summary>
          {p.details}
        </details>
      )}
      {drawer && (
        <Drawer
          title={counter?.name ?? task?.title ?? (app ? 'Карточка заявки' : 'Основания оценки')}
          company={d.company}
          close={() => setDrawer('')}
        >
          {counter ? (
            <>
              <p>Задолженность · {rub(counter.amount)}</p>
              <p>Договорный срок · {counter.due}</p>
              {p.promise && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    p.promise?.(counter.id, promiseDate);
                    setDrawer('');
                  }}
                >
                  <label className="formfield">
                    Обещанная дата оплаты
                    <input
                      type="date"
                      required
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                    />
                  </label>
                  <button className="btn primary">Зафиксировать обещание</button>
                </form>
              )}
            </>
          ) : task ? (
            <p>{task.detail}</p>
          ) : app ? (
            <>
              <p>
                {app.product} · {rub(app.amount)}
              </p>
              <p>
                {app.status} · {app.next}
              </p>
            </>
          ) : (
            <>
              <p>
                {d.scoreStatus} · {d.asOf}
              </p>
              {d.components.map((c) => (
                <p key={c.label}>
                  {c.label} · {c.score} / {c.max}
                </p>
              ))}
              {jump('Открыть источники', 'documents')}
            </>
          )}
        </Drawer>
      )}
    </>
  );
}
