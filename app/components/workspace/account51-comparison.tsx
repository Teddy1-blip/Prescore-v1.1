import type {WorkspaceBasicV1} from '../../../lib/workspace/model';
import type {Account51Summary} from '../../../lib/workspace/dossier-sources';
import {Panel} from './client-insights';

const rub=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('ru-RU',{maximumFractionDigits:2});
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
