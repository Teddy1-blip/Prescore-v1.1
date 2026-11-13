import type { BankBfoComparison } from "../../../lib/credit-engine/client-report/bank-bfo";

const rubles = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
function SourceAmount({ fact }: { fact: BankBfoComparison["accounting"] }) {
  const period = fact.period.asOf ?? [fact.period.from, fact.period.to].filter(Boolean).join(" — ");
  return <div><dt>{fact.label}</dt><dd>{fact.value !== null ? rubles.format(fact.value) + " ₽" : "Сумма не подтверждена"}
    <small style={{ display: "block", overflowWrap: "anywhere" }}>{[period, ...fact.sourceIds].filter(Boolean).join(" · ")}</small></dd></div>;
}

export function BankBfoReconciliation({ rows }: { rows?: BankBfoComparison[] }) {
  if (!rows?.length) return null;
  return <section className="pc-panel" data-testid="bank-bfo"><h2>Сверка выписок и БФО</h2>
    {rows.map(row => <article key={row.findingId} className="pc-factor-section">
      <h3>{row.title}</h3>
      <dl className="pc-definition">{row.bank && <SourceAmount fact={row.bank}/>}<SourceAmount fact={row.accounting}/></dl>
      {row.difference !== null && <p><strong>{row.direction === "EQUAL" ? "Суммы совпадают" :
        (row.direction === "LEFT_ABOVE_RIGHT" ? "По выпискам больше на " : "По выпискам меньше на ") + rubles.format(row.difference) + " ₽"}</strong></p>}
      {row.context.length > 0 && <><dl className="pc-definition">{row.context.map(fact => <SourceAmount key={fact.label} fact={fact}/>)}</dl>
        <p>Эти данные помогают проверить сроки расчётов. Их вклад в разницу не установлен.</p></>}
      <p>{row.limitation}</p>{row.action && <p><strong>Что проверить</strong> · {row.action}</p>}
    </article>)}</section>;
}
