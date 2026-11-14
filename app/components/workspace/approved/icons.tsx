const shapes: Record<string, React.ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  bfo: (<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8m-8 4h5"/></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m3 0h3"/></>),
  analyst: (<><path d="M4 5h16v13H8l-4 3V5Z"/><path d="M8 10h8m-8 4h5"/></>),
  finance: (
    <>
      <path d="M4 20h17M6 15V9m6 6V4m6 11v-5" />
    </>
  ),
  credit: (
    <>
      <path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  counterparties: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-3c0-4 12-4 12 0v3M16 5c4 0 4 6 0 6m2 3c3 0 3 3 3 6" />
    </>
  ),
  funding: (
    <>
      <path d="m3 9 9-6 9 6H3m2 0v10m7-10v10m7-10v10M3 21h18" />
    </>
  ),
  applications: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V3h8v4M3 12c6 4 12 4 18 0m-9 1v4" />
    </>
  ),
  documents: (
    <>
      <path d="M5 3h9l5 5v13H5zm9 0v5h5M8 12h8m-8 4h6" />
    </>
  ),
  actions: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M9 3h6v4H9zM8 12l2 2 6-5m-8 9h8" />
    </>
  ),
  billing: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v7m0-10v.1" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
};
export function NavIcon({ id }: { id: string }) {
  const names: Record<string, string> = {
    home: 'overview',
    banking: 'finance',
    analysis: 'credit',
    obligations: 'applications',
    financing: 'funding',
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {shapes[names[id] ?? id] ?? shapes.info}
    </svg>
  );
}
