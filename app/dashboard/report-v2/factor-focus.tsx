'use client';
import {useState} from 'react';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
export function FactorFocus({model:m,print=false}:{model:ClientReportModelV1;print?:boolean}){
 const [selected,setSelected]=useState<string|null>(null);
 const actions=m.actionPlan.horizons.flatMap(h=>h.items);
 const focus=actions.find(i=>m.actionPlan.focusIds.includes(i.id));
 const factor=m.primaryFactors.find(f=>f.id===selected);
 const linked=m.visual.factorActions[selected??'']??[];
 return <div className="cr-now">
  <div className="cr-primary-issues"><h3>Что важно сейчас</h3>{m.primaryFactors.map((f,n)=><div className={'cr-factor-summary cr-tone-'+f.status.tone} key={f.id}>{print?<h4>{f.title}</h4>:<button type="button" aria-expanded={selected===f.id} aria-controls="factor-relationship" onClick={()=>setSelected(selected===f.id?null:f.id)}><span>{String(n+1).padStart(2,'0')}</span> {f.title}</button>}<p className="cr-caption">{f.status.label} · {f.confidence}</p></div>)}{!m.primaryFactors.length&&<p>{m.hero.summary}</p>}{m.dataQuality[0]&&<p className="cr-data-note"><strong>Ограничение данных: </strong>{m.dataQuality[0].title}</p>}<a className="cr-screen-only" href="#factors">Факторы и основания →</a></div>
  <aside className={'cr-current-action '+(focus&&linked.includes(focus.id)?'cr-related':'')}><p className="cr-eyebrow">Что делать сейчас · 7 дней</p>{focus?<><h3>{focus.title}</h3><p>{focus.summary}</p></>:<p>Действия первого этапа не назначены. Учитывайте ограничения анализа.</p>}{!print&&<a className="cr-primary" data-primary-cta="true" href={'#'+m.hero.cta.target}>{m.hero.cta.label}<span aria-hidden="true"> →</span></a>}<p className="cr-caption">Контрольная точка Prescore, не крайний срок.</p>{m.actionPlan.rerun[0]&&<p className="cr-caption"><strong>Когда обновить: </strong>{m.actionPlan.rerun[0].title}</p>}</aside>
  {!print&&<div id="factor-relationship" className="cr-factor-relationship" aria-live="polite">{factor&&<div key={factor.id}><h4>{factor.title}</h4><p>{factor.why}</p><p>{factor.impact}</p>{linked.length?<ul>{actions.filter(a=>linked.includes(a.id)).map(a=><li key={a.id}><a href={'#'+a.id}>{a.title}</a></li>)}</ul>:<p>Связанное действие первого этапа не назначено.</p>}</div>}</div>}
 </div>;
}
