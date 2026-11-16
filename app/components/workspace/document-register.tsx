'use client';

import type {sourceProjection} from '../../../lib/workspace/dossier-sources';

type Projection = ReturnType<typeof sourceProjection>;
type Source = Projection['sources'][number];
const groups = [
  {title:'Банковские документы', kinds:['BANK_STATEMENT','ACCOUNT_51'], view:'banking'},
  {title:'Бухгалтерская отчётность', kinds:['BFO','QUARTERLY','BFO_REVIEW'], view:'bfo'},
  {title:'Бухгалтерские регистры', kinds:['COUNTERPARTIES','DEBT_LEDGER'], view:'counterparties'},
  {title:'Кредитные документы', kinds:['BKI','CREDIT_DOCUMENT','CALENDAR_SHEET','MANUAL_DEBT'], view:'obligations'},
  {title:'Договоры и контракты', kinds:['COMMERCIAL_DOCUMENT'], view:'counterparties'},
  {title:'Внешние сведения', kinds:['CHECKO'], view:'bfo'},
  {title:'Другие источники', kinds:[], view:'documents'},
];
const sourceGroup = (kind:string) => groups.find(g=>g.kinds.includes(kind)) ?? groups[groups.length-1];

function resultFor(source:Source, profile:Projection) {
  const review=profile.reviews.find(r=>r.id===source.id);
  const period=profile.matrix.periods.find(p=>p.selected.id===source.id ||
    Boolean(source.documentId && p.selected.documentId===source.documentId));
  const metric=period?.selected.values.REVENUE;
  const portfolio=profile.obligations.filter(item=>item.sourceIds.includes(source.id));
  const card=profile.cards51.find(c=>c.id===source.id);
  const ledger=profile.ledger.filter(row=>row.sourceId===source.id);
  const bureau=profile.bureauReports.find(b=>b.id===source.id);
  const schedule=profile.sheets.find(s=>s.id===source.id);
  const view=source.kind==='DEBT_LEDGER'?'obligations':source.kind==='CALENDAR_SHEET'?'calendar':sourceGroup(source.kind).view;
  const rub=(value:number)=>value.toLocaleString('ru-RU')+' ₽';
  const details:string[]=[];
  if(period?.period.asOf)details.push('Отчётная дата '+period.period.asOf);
  if(metric)details.push('Выручка '+rub(metric.value));
  if(card)details.push('Карточка 51 · '+card.from+' — '+card.to);
  if(ledger.length)details.push('Строк ОСВ в досье: '+ledger.length);
  if(bureau)details.push('БКИ от '+bureau.date+(bureau.companyDebt?'':' · вне долга компании'));
  if(portfolio.length)details.push('Обязательств со ссылкой на источник: '+portfolio.length);
  if(schedule?.confirmed.length)details.push('Подтверждено строк графика: '+schedule.confirmed.length);
  const used=Boolean(period&&Object.keys(period.selected.values).length || portfolio.length ||
    profile.settlements.some(s=>s.references.some(r=>Boolean(source.documentId && r.documentId===source.documentId))) ||
    profile.claims.some(c=>c.sourceIds.includes(source.id)));
  let status='Оригинал сохранён';
  if(!source.documentId)status='Источник сохранён';
  if(source.status==='READY')status='Данные извлечены';
  if(used)status='Есть данные в расчётах';
  if(source.status==='PROCESSING')status='Идёт обработка';
  if(source.status==='EMPTY'||source.status==='FAILED')status='Обработка не завершена';
  if(source.status==='STALE')status='Требует обновления';
  if(review&&review.status!=='BUREAU_CONFIRMED')status=used?'Часть данных учтена · требуется проверка':'Требуется проверка';
  return {status,details,review,view,hasResult:used||!!card||!!bureau||ledger.length>0||!!schedule};
}

export function DocumentRegister({profile,inn,companyName,labels,choose,recentId,openBank}:{
  profile:Projection;inn:string;companyName?:string;labels:Record<string,string>;choose:(view:string)=>void;recentId:string;openBank:()=>void;
}){
  const recent=profile.sources.find(s=>s.id===recentId);
  const report=recent&&resultFor(recent,profile);
  const byGroup=new Map(groups.map(g=>[g,profile.sources.filter(s=>sourceGroup(s.kind)===g)]));
  return <section className="pc-register" aria-label="Документы компании">
    <header><div><h2>Документы компании</h2><p>{companyName && <>{companyName} · </>}ИНН {inn}</p></div>
      <a className="pc-primary" href="#dossier-intake">Добавить документ</a></header>
    {recent&&report&&<section className="pc-register-receipt" role="status"><strong>{recent.name}</strong><p>{report.status}</p>
      {report.details.length>0&&<p>{report.details.join(' · ')}</p>}
      {report.hasResult&&<button onClick={()=>choose(report.view)}>Посмотреть результаты</button>}
      {report.review&&<a href={'#review-'+encodeURIComponent(recent.id)}>Проверить поля</a>}</section>}
    {[...byGroup].filter(([g,items])=>g.kinds.length||items.length).map(([g,items])=><details key={g.title} className="pc-register-group">
      <summary>{g.title}<span>{items.length}</span></summary>
      {items.length>0?<ul>{items.map(s=>{
        const result=resultFor(s,profile);
        return <li key={s.id}><div><strong>{s.name}</strong><small>{labels[s.kind]??s.kind} · {s.received.slice(0,10)}{s.from&&s.to?' · '+s.from+' — '+s.to:''}</small>
          {result.details.length>0&&<small>{result.details.join(' · ')}</small>}</div><div><span>{result.status}</span>
          <div className="pc-register-links">{s.documentId&&<a href={'/api/documents?download='+encodeURIComponent(s.documentId)}>Открыть оригинал</a>}
          {result.review&&<a href={'#review-'+encodeURIComponent(s.id)}>Проверить</a>}
          {result.hasResult&&<button onClick={()=>choose(result.view)}>Посмотреть результаты</button>}</div></div></li>;
      })}</ul>:<p>В этой группе пока нет источников.</p>}
      {g.kinds.includes('BANK_STATEMENT')&&<button type="button" onClick={openBank}>Добавить банковскую выписку</button>}
    </details>)}
  </section>;
}
