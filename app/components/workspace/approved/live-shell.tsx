'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { WorkspaceModelV1 } from '../../../../lib/workspace/model';
import type { Deal, StoredAnalysis } from '../client-operations';
import { ApprovedShell } from './shell';
import { ApprovedPage } from './pages';
import { ApplicationForm, type RequestInput } from './application-form';
import { liveView } from './adapter';
import { focusLabels, pages, type Page } from './types';
import { date } from '../presentation';
import './client.css';
type Workspace = {
  view: string;
  choose: (v: string) => void;
  availableViews: string[];
  selected?: StoredAnalysis;
  analyses: StoredAnalysis[];
  model: WorkspaceModelV1 | null;
  locked: boolean;
  renderPage: boolean;
  deals: Deal[];
  select: (id: string) => void;
  add: (input: Omit<Deal, 'id'>) => Promise<void>;
  context: ReactNode;
  children: ReactNode;
};
type ContentProps = Pick<Workspace, 'view' | 'renderPage' | 'choose' | 'availableViews'> & {
  data: ReturnType<typeof liveView>;
  focus: string;
  apps: Deal[];
  readOnly: boolean;
  open?: (product?: string) => void;
};
const ScreenContext = createContext<ContentProps | null>(null);
export function ClientShell(p: Workspace) {
  const [month, setMonth] = useState(''),
    [focus, setFocus] = useState(focusLabels[0]),
    [application, setApplication] = useState<string | null>(null);
  const months = p.model?.basic.bankingFacts.monthly ?? [];
  useEffect(() => {
    function sync() {
      setMonth(new URLSearchParams(location.search).get('bankMonth') ?? '');
      setApplication(null);
    }
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [p.selected?.id]);
  const period = months.some((m) => m.month === month) ? month : '';
  const chooseMonth = (v: string) => {
    setMonth(v);
    const u = new URL(location.href);
    if (v) u.searchParams.set('bankMonth', v);
    else u.searchParams.delete('bankMonth');
    history.pushState(null, '', u);
  };
  const company = p.model?.basic.analysis.company.name || p.selected?.companyName || 'Кабинет компании';
  const data = liveView(p.model, company, period);
  const options = p.analyses
    .filter((a) => a.historyPurpose !== 'QA' || a.id === p.selected?.id)
    .map((a) => ({ id: a.id, label: a.companyName + ' · ' + date(a.periodTo) }));
  if (!p.selected) options.unshift({ id: '', label: 'Выберите компанию' });
  const open =
    p.selected && !p.locked && p.availableViews.includes('applications')
      ? (product = '') => setApplication(product)
      : undefined;
  async function save(v: RequestInput) {
    if (!p.selected || !open) throw Error('Запись недоступна');
    const id = p.selected.id;
    await p.add({
      analysisId: id,
      companyName: p.selected.companyName,
      product: v.product,
      amount: v.amount,
      status: 'Черновик',
      owner: 'Не назначен',
      nextAction: v.next,
    });
    if (new URLSearchParams(location.search).get('analysisId') === id) p.choose('applications');
  }
  return (
    <ApprovedShell
      context={p.context}
      page={p.view}
      company={company}
      companyId={p.selected?.id ?? ''}
      companies={options}
      onCompany={p.select}
      periods={[
        {
          id: '',
          label: p.model
            ? date(p.model.basic.analysis.period.from) + ' — ' + date(p.model.basic.analysis.period.to)
            : 'Период выписки',
        },
        ...months.map((r) => ({ id: r.month, label: r.month })),
      ]}
      period={period}
      onPeriod={chooseMonth}
      focus={focus}
      onFocus={setFocus}
      date={data.asOf ? 'Срез · ' + data.asOf : ''}
      sources={[...new Set(data.sources.filter((s) => s.status === 'Обработан').map((s) => s.label))]}
      choose={p.choose}
      available={p.availableViews}
      readOnly={p.locked}
      onApplication={open}
    >
      <ScreenContext.Provider
        value={{
          view: p.view,
          renderPage: p.renderPage,
          availableViews: p.availableViews,
          choose: p.choose,
          data,
          focus,
          open,
          readOnly: p.locked,
          apps: p.deals.filter((v) => v.analysisId === p.selected?.id),
        }}
      >
        {p.children}
      </ScreenContext.Provider>
      {application !== null && open && (
        <ApplicationForm
          product={application}
          company={company}
          close={() => setApplication(null)}
          save={save}
        />
      )}
    </ApprovedShell>
  );
}
export function LivePage({ children }: { children: ReactNode }) {
  const c = useContext(ScreenContext);
  if (!c?.renderPage || !Object.hasOwn(pages, c.view)) return <>{children}</>;
  if (['obligations', 'bfo', 'calendar', 'analyst'].includes(c.view)) return <div className="ws">{children}</div>;
  const page = c.view as Page;
  const billing = page === 'billing',
    ar = page === 'counterparties';
  return (
    <ApprovedPage
      key={page}
      page={page}
      availableViews={c.availableViews}
      data={c.data}
      focus={c.focus}
      go={c.choose}
      apps={c.apps.map((d) => ({
        id: d.id,
        amount: d.amount,
        product: d.product,
        status: d.status,
        next: d.nextAction,
      }))}
      newApp={c.open}
      operations={billing ? children : undefined}
      details={billing || ar ? undefined : page === 'home' ? undefined : <div className="ws">{children}</div>}
    />
  );
}
