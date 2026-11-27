import type {ReportSettlement} from '../../../lib/workspace/dossier-report';

const rubles = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2});
export function DossierSettlementBalances({rows}: {rows: ReportSettlement[]}) {
  return <section className="pc-panel">
    <h2>Остатки по ОСВ 60, 62 и 76</h2>
    <div className="pc-table-scroll"><table>
      <thead><tr><th>Контрагент и договор</th><th>Счёт</th><th>Дата</th><th>Дебет, ₽</th><th>Кредит, ₽</th><th>Основание</th></tr></thead>
      <tbody>{rows.map(row=><tr key={JSON.stringify(row.references)}>
        <th scope="row">{row.party}{row.contract && <small>{row.contract}</small>}</th>
        <td>{row.account}</td><td>{row.asOf}</td>
        <td>{row.debit == null ? '—' : rubles.format(row.debit)}</td>
        <td>{row.credit == null ? '—' : rubles.format(row.credit)}</td>
        <td>{row.references.map(ref=><div key={JSON.stringify(ref)}>{ref.name} · {ref.page ? 'стр.' : 'строка'} {ref.row}</div>)}
          {row.conflict && <strong>Требуется сверка источников</strong>}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
