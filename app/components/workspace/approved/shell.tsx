import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pages, clientNavigation, focusLabels, type Page } from './types';
import { Drawer } from './primitives';
import { NavIcon } from './icons';
type Choice = { id: string; label: string };
export type ShellProps = {
  page: string;
  available: string[];
  company: string;
  companyId: string;
  companies: Choice[];
  period: string;
  periods: Choice[];
  date: string;
  sources: string[];
  focus: string;
  onFocus: (f: string) => void;
  onCompany: (id: string) => void;
  onPeriod: (p: string) => void;
  choose: (p: string) => void;
  context?: ReactNode;
  preview?: boolean;
  readOnly?: boolean;
  onApplication?: () => void;
  children: ReactNode;
};
export function ApprovedShell(p: ShellProps) {
  const [menu, setMenu] = useState(false),
    [explain, setExplain] = useState(false);
  const nav = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = nav.current?.querySelector('a');
    focus?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenu(false);
        trigger.current?.focus();
        return;
      }
      if (e.key === 'Tab') {
        const links = Array.from(nav.current?.querySelectorAll<HTMLElement>('a,button') ?? []);
        const first = links[0],
          last = links[links.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', keys);
    };
  }, [menu]);
  const extra: Record<string, readonly string[]> = {
    upload: ['Загрузка', 'Обновление данных', 'Банковские выписки компании'],
    analyst: ['Кредитный эксперт', 'Кредитный эксперт', 'Вопросы по выбранному анализу'],
  };
  const [label, title, subtitle] = pages[p.page as Page] ?? extra[p.page] ?? pages.home;
  const go = (v: string) => {
    setMenu(false);
    p.choose(v);
  };
  function link(id: string) {
    const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (p.companyId) query.set('analysisId', p.companyId);
    query.set('view', id);
    return '?' + query.toString();
  }
  return (
    <div className="approved-client">
      <div className="layout">
        <a className="sr skip" href="#approved-main">
          Перейти к содержимому
        </a>
        {menu && <button className="scrim" aria-label="Закрыть меню" onClick={() => setMenu(false)} />}
        <aside ref={nav} id="approved-side" className={'sidebar' + (menu ? ' open' : '')}>
          <div className="client-brand">
            prescore<i>.</i>
            <small>ФИНАНСЫ БИЗНЕСА</small>
          </div>
          <div className="workspace">
            <div className="square">{p.company[0] || 'П'}</div>
            <div>
              <b>{p.company}</b>
              <span>Кабинет компании</span>
            </div>
          </div>
          <div className="nav-label">ФИНАНСОВАЯ КАРТИНА</div>
          <nav className="nav" aria-label="Разделы кабинета">
            {clientNavigation
              .filter(id => p.available.includes(id))
              .map(id => {
                const [name] = pages[id];
                return (
                <a
                  key={id}
                  href={link(id)}
                  className={name === label ? 'active' : ''}
                  aria-current={name === label ? 'page' : undefined}
                  onClick={(e) => {
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      go(id);
                    }
                  }}
                >
                  <NavIcon id={id} />
                  <span>{name}</span>
                </a>
                );
              })}
          </nav>
          <div className="side-bottom">
            {p.available.includes('billing') && <button type="button" className="side-billing" onClick={() => go('billing')}>Подписка и доступ</button>}
            <strong>Prescore для бизнеса</strong>
            <span className="status-dot" />
            {p.preview ? 'Интерактивный стенд' : p.readOnly ? 'Доступ для просмотра' : 'Кабинет компании'}
            {!p.preview && (
              <p>
                <a href="/logout">Выйти</a>
              </p>
            )}
          </div>
        </aside>
        <main className="main" id="approved-main" tabIndex={-1}>
          <header className="topbar">
            <button
              ref={trigger}
              className="mobile-toggle"
              aria-label="Открыть меню"
              aria-expanded={menu}
              aria-controls="approved-side"
              onClick={() => setMenu(!menu)}
            >
              ☰
            </button>
            <div className="breadcrumbs">
              Компания　/　<b>{label}</b>
            </div>
            <div className="top-actions">
              <span>{p.date}</span>
              <button className="text-link" onClick={() => setExplain(true)}>
                Объяснение ✧
              </button>
              <div className="client-avatar">{p.company[0] || 'П'}</div>
            </div>
          </header>
          <div className="content">
            {p.preview && (
              <div className="demo">
                <b>ВИЗУАЛЬНЫЙ СТЕНД</b>
                <span>Учебные данные · действия в этом примере доступны на время просмотра</span>
              </div>
            )}
            <div className="head">
              <div>
                <div className="client-eyebrow">КАБИНЕТ КОМПАНИИ</div>
                <h1>{title}</h1>
                <p className="sub">
                  {p.company} · {subtitle}
                </p>
              </div>
              <div className="head-actions">
                {p.available.includes('documents') && (
                  <button className="btn" onClick={() => go('documents')}>
                    Обновить данные
                  </button>
                )}
                {p.onApplication && (
                  <button className="btn primary" onClick={() => p.onApplication?.()}>
                    Подготовить заявку ↗
                  </button>
                )}
              </div>
            </div>
            <div className="filters">
              <div className="fields">
                {(
                  [
                    ['Компания', p.companyId, p.companies, p.onCompany],
                    ['Период', p.period, p.periods, p.onPeriod],
                    ['Мой фокус', p.focus, focusLabels.map((v) => ({ id: v, label: v })), p.onFocus],
                  ] as const
                ).map(([text, value, options, change]) => (
                  <div className="select-box" key={text}>
                    <label htmlFor={'approved-' + text}>{text}</label>
                    <select
                      id={'approved-' + text}
                      aria-label={text}
                      value={value}
                      onChange={(e) => change(e.target.value)}
                      disabled={options.length < 2}
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="client-source-strip">
                {p.sources.map((s) => (
                  <span className="chip ok" key={s}>
                    ● {s}
                  </span>
                ))}
              </div>
            </div>
            {p.children}
            <div className="info-footer">
              {p.preview
                ? 'Синтетическое досье для визуальной проверки.'
                : 'Prescore · Финансовый анализ бизнеса. Условия финансирования определяет кредитор.'}
            </div>
          </div>
        </main>
      </div>
      {explain && (
        <Drawer title="Объяснение Prescore" company={p.company} close={() => setExplain(false)}>
          {p.context}
          <p>
            Период относится к денежным потокам. Отчётность, обязательства и расчёты с покупателями используют
            даты своих источников.
          </p>
          {p.available.includes('analyst') && (
            <button
              className="btn primary"
              onClick={() => {
                setExplain(false);
                go('analyst');
              }}
            >
              Спросить Prescore
            </button>
          )}
        </Drawer>
      )}
    </div>
  );
}
