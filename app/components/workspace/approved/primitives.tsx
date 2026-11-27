import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
export function Card({
  title,
  sub,
  action,
  children,
  extra = '',
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  extra?: string;
}) {
  return (
    <section className={'card ' + extra}>
      <div className="client-card-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Kpi({
  label,
  value,
  foot,
  click,
  tone = '',
}: {
  label: string;
  value: string;
  foot: string;
  click: () => void;
  tone?: string;
}) {
  return (
    <button className="kpi" onClick={click}>
      <div className="kpi-label">
        {label}
        <span>↗</span>
      </div>
      <div className={'value ' + tone}>{value}</div>
      <div className="kpi-foot">{foot}</div>
    </button>
  );
}
export function Table({ heads, rows, label }: { heads: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={label}>
      <table>
        <caption className="sr">{label}</caption>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Review({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="review">
      <h3>{title}</h3>
      <div className="note">{children}</div>
    </div>
  );
}
export function Drawer({
  title,
  company,
  close,
  children,
}: {
  title: string;
  company: string;
  close: () => void;
  children: ReactNode;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    const before = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={element}
      className="drawer"
      aria-labelledby="approved-dialog-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget && e.clientX < e.currentTarget.getBoundingClientRect().left) close();
      }}
    >
      <button className="close" aria-label="Закрыть" onClick={close}>
        ×
      </button>
      <div className="client-eyebrow">{company}</div>
      <h2 id="approved-dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}
