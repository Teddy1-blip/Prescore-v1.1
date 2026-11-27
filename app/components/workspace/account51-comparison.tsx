import type {WorkspaceBasicV1} from '../../../lib/workspace/model';
import type {Account51Summary} from '../../../lib/workspace/dossier-sources';
import type {Account51ReconciliationV1} from '../../../lib/workspace/bank-sources-adapter';
import {Panel} from './client-insights';

const rub=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('ru-RU',{maximumFractionDigits:2});
const statusLabels:Record<Account51ReconciliationV1['status'],string>={
  AGREES:'Совпадает (AGREES)',
  DIFFERS:'Есть расхождения (DIFFERS)',
  PERIOD_MISMATCH:'Периоды не совпадают (PERIOD_MISMATCH)',
  BANK_MISSING:'Нет банковских метрик (BANK_MISSING)',
};
export function Account51ServerReconciliation({items}:{items?:Account51ReconciliationV1[]}) {
  if(!items?.length)return null;
  return <Panel title="Серверная сверка: банк ↔ карточка счёта 51">
    {items.map((item,index)=>{
      const rows=[
        ['Поступления',item.inflow],
        ['Списания',item.outflow],
        ['Остаток на конец периода',item.closingBalance],
      ] as const;
      return <section key={index}>
        <div className="pc-statusline">
          <span className={'pc-badge'+(item.status==='DIFFERS'?' critical':'')}>{statusLabels[item.status]}</span>
        </div>
        <p className="pc-muted">Карточка 51: {item.period.cardFrom} — {item.period.cardTo}{item.period.bankFrom&&item.period.bankTo?` · Банк: ${item.period.bankFrom} — ${item.period.bankTo}`:''}</p>
        <div className="pc-table-scroll">
          <table>
            <caption>Обороты и остатки, ₽</caption>
            <thead><tr><th>Показатель</th><th>Карточка 51</th><th>Банк</th><th>Разница</th></tr></thead>
            <tbody>{rows.map(([title,pair])=><tr key={title}><th scope="row">{title}</th><td>{rub(pair.card)}</td><td>{rub(pair.bank)}</td><td>{rub(pair.diff)}</td></tr>)}</tbody>
          </table>
        </div>
        {item.warnings.length>0&&<p className="pc-muted">Предупреждения: {item.warnings.join(', ')}</p>}
      </section>;
    })}
  </Panel>;
}
export function Account51Comparison({cards,bank}:{cards:(Account51Summary&{id:string;name:string})[];bank?:WorkspaceBasicV1}) {
  return <Panel title="Сверка выписок с карточкой счёта 51">
    {!cards.length&&<p>Загрузите карточку счёта 51 из 1С в формате XLS или XLSX за период выписки. Обороты карточки используются только для сверки.</p>}
    {cards.map(card=>{
      const comparable=bank&&card.from===bank.analysis.period.from&&card.to===bank.analysis.period.to;
      const facts=comparable?bank.bankingFacts:null;
      const rows=[['Поступления',card.inflow,facts?.grossInflow.value],['Списания',card.outflow,facts?.grossOutflow.value],['Остаток на конец периода',card.closing,facts?.endingBalance.value]] as const;
      return <section key={card.id}><h3>{card.name}</h3><p>{card.from} — {card.to} · {card.entries} проводок</p>
        <div className="pc-table-scroll"><table><caption>Обороты и остатки, ₽</caption><thead><tr><th>Показатель</th><th>Карточка 51</th><th>Банк</th><th>Разница</th></tr></thead><tbody>{rows.map(([title,cardValue,bankValue])=><tr key={title}><th scope="row">{title}</th><td>{rub(cardValue)}</td><td>{rub(bankValue)}</td><td>{rub(cardValue!=null&&bankValue!=null?cardValue-bankValue:null)}</td></tr>)}</tbody></table></div>
        <p>{!comparable?'Для сравнения выберите банковский анализ за те же даты.':'Сопоставьте состав расчётных счетов и переводы между своими счетами. Разница требует проверки охвата.'}</p>
        {card.requiresReview&&<p>Требуется сверка проводок и сальдо внутри карточки.</p>}
      </section>;
    })}
  </Panel>;
}
