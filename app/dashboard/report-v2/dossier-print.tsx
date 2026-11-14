import type {DossierReport} from '../../../lib/workspace/dossier-report';
import {PrintControl} from './print-control';
type Result=DossierReport;
export function DossierPrint({inn,result}:{inn:string;result:Result}){
 const name=result.name;
 return <main className="cr-report"><PrintControl/><header><h1>Финансовый профиль компании</h1><p>{name} · ИНН {inn} · {result.entitlement}</p></header>
 {result.financial?.history.map(p=><section key={p.id}><h2>Бухгалтерская отчётность · {p.period.from} — {p.period.to}</h2>
 {p.groups.map(g=><section key={g.key}><h3>{g.title}</h3><dl>{g.metrics.filter(m=>m.value!==null).map(m=><div key={m.key}><dt>{m.label}</dt><dd>{typeof m.value==='number'?m.value.toLocaleString('ru-RU',{maximumFractionDigits:3}):m.value} {{RUB:'₽',PERCENT:'%',RATIO:'×',DAYS:'дн.',COUNT:''}[m.unit]}</dd></div>)}</dl></section>)}</section>)}
 {result.obligations.length>0&&<section><h2>Обязательства на {result.portfolioAsOf}</h2>{result.obligations.map(o=><p key={o.id}>{o.creditor} · {o.contract} · {o.principal==null?'Остаток не указан':o.principal.toLocaleString('ru-RU')+' ₽'}</p>)}</section>}
 {result.claims.map(c=><section key={c.id} data-claim={c.id}><h3>{c.title}</h3><p>{c.text}</p><small>{c.sources.map((s,i)=>(result.sources.find(r=>r.id===c.sourceIds[i])?.name??'Источник')+' · '+s.date).join(', ')}</small></section>)}
 <section><h2>Источники</h2>{result.sources.filter(s=>s.kind!=='CALENDAR').map(s=><p key={s.id}>{s.name} · {s.received.slice(0,10)}</p>)}</section></main>;
}
