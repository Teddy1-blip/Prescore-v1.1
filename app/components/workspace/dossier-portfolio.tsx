import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {Panel} from './client-insights';

type Profile=Pick<ReturnType<typeof sourceProjection>,'obligations'|'sources'> & {entitlement:string};
const money=(n:number|null)=>n===null?'—':n.toLocaleString('ru-RU');
const products:Record<string,string>={TERM_LOAN:'Кредит',CREDIT_LINE:'Кредитная линия',OVERDRAFT:'Овердрафт',LEASING:'Лизинг',FACTORING:'Факторинг',BANK_GUARANTEE:'Гарантия',GUARANTORSHIP:'Поручительство',OTHER_DEBT:'Иное обязательство'};
export function DossierPortfolio({profile}:{profile:Profile|null}){
 return <Panel title="Реестр обязательств"><div className="pc-table-scroll pc-register"><table aria-label="Реестр обязательств"><thead><tr>{['Кредитор / продукт','Договор','Лимит, ₽','Основной долг, ₽','Ставка','Очередной платёж','Срок','Просрочено, ₽','Источники'].map(t=><th key={t}>{t}</th>)}</tr></thead>
 <tbody>{profile?.obligations.map(o=><tr key={o.id}><th scope="row">{o.creditor??'Кредитор уточняется'}<small>{products[o.type]??'Вид уточняется'}</small></th><td>{o.contract??'—'}</td><td>{money(o.limit)}</td><td>{money(o.principal)}{o.principalDate&&<small>на {o.principalDate}</small>}</td><td>{o.rate===null?'—':o.rate+'%'}</td><td>{money(o.nextAmount)}{o.nextDate&&<small>{o.nextDate}</small>}{o.scheduledAmount!==null&&<small>По договору {money(o.scheduledAmount)} ₽</small>}</td><td>{o.maturity??'—'}</td><td>{money(o.overdue)}{o.overdueDate&&<small>на {o.overdueDate}</small>}</td><td>{o.sourceIds.map(id=><div key={id}>{profile.sources.find(s=>s.id===id)?.name??'Подтверждение в анализе'}</div>)}{o.requiresReview&&<small>Проверить расхождения</small>}</td></tr>)}</tbody></table></div>
 {!profile?.obligations.length&&<p>{profile?.entitlement==='FULL'?'Загрузите БКИ, договор или ОСВ, чтобы заполнить реестр.':profile?'Кредитный портфель доступен в полном кабинете.':'Выберите компанию для просмотра обязательств.'}</p>}</Panel>;
}
