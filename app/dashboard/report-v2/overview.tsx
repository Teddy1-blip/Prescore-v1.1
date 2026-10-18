import {IndexStrands} from './index-strands.tsx';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import {Metric,Disclosure} from './primitives.tsx';
import {COPY} from '../../../lib/credit-engine/client-report/copy.ts';
import {Signature} from './signature.tsx';
import {FactorFocus} from './factor-focus.tsx';
import {VISUAL_POLICY} from '../../../lib/credit-engine/client-report/visual.ts';
export function ExecutiveSummary({model:m,print=false}:{model:ClientReportModelV1;print?:boolean}){
 return <section id={print?undefined:'overview'} className={'cr-overview '+(m.hero.globalStop?'cr-global-stop':'')} aria-label="Итог анализа">
  <div className="cr-hero"><div><h2>{m.hero.headline}</h2><p>{m.hero.summary}</p><span className="cr-caption">{m.hero.status} · {m.hero.confidence}</span></div>{!print&&!m.hero.globalStop&&<Signature/>}</div>
  <div className="cr-metrics">{m.index.value?.value!=null&&<IndexCard model={m} print={print}/>}{m.readiness.level!==COPY.readiness.UNKNOWN&&<ReadinessCard model={m} print={print}/>}{m.capacity.headline?.value!=null&&<DebtCapacityCard model={m}/>}</div>
  {(m.index.value?.value==null||m.readiness.level===COPY.readiness.UNKNOWN||m.capacity.headline?.value==null)&&<p className="cr-disclaimer">Предварительная оценка. Пока не определены: {m.index.value?.value==null&&<span id="index">Prescore Index; </span>}{m.readiness.level===COPY.readiness.UNKNOWN&&<span id="readiness">готовность к финансированию; </span>}{m.capacity.headline?.value==null&&<span id="capacity">дополнительный долговой платёж</span>}. Подтверждённые источники, основания ограничений и действия приведены в отчёте.</p>}
  {m.capacity.headline?.value==null&&<p className="cr-disclaimer">{m.capacity.disclaimer}</p>}
  <FactorFocus model={m} print={print}/>
 </section>;
}
export function IndexCard({model:m,print=false}:{model:ClientReportModelV1;print?:boolean}){
 const components=<div className="cr-component-grid">{m.index.components.map(c=><div key={c.id}><span>{c.label}</span><strong>{m.visual.componentStates[c.id]}</strong></div>)}</div>;
 return <article className="cr-metric-card cr-index" id="index"><h3>Prescore Index</h3><div className="cr-index-number"><Metric metric={m.index.value}/>{m.index.value?.value!=null&&<span className="cr-caption"> / 1000</span>}</div><p className="cr-caption">{m.index.status} · {m.index.confidence}</p>{m.index.components.length>0&&<><IndexStrands/>{print?components:<div className="cr-components"><Disclosure title="Четыре компонента и факторы">{components}</Disclosure></div>}</>}<a className="cr-screen-only" href="#factors">Почему такой результат →</a></article>;
}
export function ReadinessCard({model:m,print=false}:{model:ClientReportModelV1;print?:boolean}){return <article className="cr-metric-card cr-readiness" id="readiness"><div><h3>Готовность к финансированию</h3><p className="cr-level">{m.readiness.level}</p></div><div className="cr-readiness-detail"><p className="cr-caption">{m.readiness.confidence}</p><Disclosure title="Что означает готовность" print={print}><p>{m.readiness.text}</p>{m.readiness.constraints[0]&&<p>{m.readiness.constraints[0].text}</p>}</Disclosure></div></article>;}
export function CapacityScale({model:m}:{model:ClientReportModelV1}){
 const s=m.visual.capacityScale;if(!s)return null;
 // Display geometry only; every amount and both boundaries are existing model bindings.
 const extent=Math.max(Number(s.upper.value),Number(s.current.value),Number(s.cautious.value),1);
 const current=Number(s.current.value)/extent*100,cautious=Number(s.cautious.value)/extent*100,upper=Number(s.upper.value)/extent*100;
 const headroom=Number(s.headroom.value)/extent*100;
 return <div className="cr-capacity-scale" role="img" aria-label={`${VISUAL_POLICY.capacity.current}: ${s.current.display}. Дополнительный запас: ${s.headroom.display} в месяц. Границы модели не являются банковским лимитом.`}>
  <div className="cr-scale-labels"><span>{VISUAL_POLICY.capacity.current}<br/><b>{s.current.display}</b></span><span>{VISUAL_POLICY.capacity.cautious}</span></div>
  <div className="cr-scale-track"><span className="cr-load" style={{width:`${current}%`}}/><span className="cr-headroom" style={{left:`${current}%`,width:`${headroom}%`}}/><i className="cr-cautious" style={{left:`${cautious}%`}}/><i className="cr-upper" style={{left:`${upper}%`}}/></div>
  <div className="cr-scale-foot"><span>Запас обслуживания</span><span>{VISUAL_POLICY.capacity.upper}</span></div>
 </div>;
}
export function DebtCapacityCard({model:m}:{model:ClientReportModelV1}){return <article className="cr-metric-card cr-capacity" id="capacity"><h3>{COPY.capacity}</h3><div className="cr-capacity-number"><Metric metric={m.capacity.headline}/>{m.capacity.headline?.value!=null&&<span className="cr-caption"> / месяц</span>}</div><p className="cr-caption">{m.capacity.status} · {m.capacity.confidence}</p><CapacityScale model={m}/>{!m.visual.capacityScale&&<p>{m.capacity.text}</p>}<p className="cr-disclaimer">{m.capacity.disclaimer}</p>{m.capacity.headline?.value===0&&<p>Дополнительный расчётный запас пока не выявлен. <a className="cr-screen-only" href="#plan">Что проверить сначала</a></p>}</article>;}
export function CapacityDetails({model:m,print=false}:{model:ClientReportModelV1;print?:boolean}){return <Disclosure title="Как рассчитан запас обслуживания" print={print}>{m.capacity.details.map(f=><section key={f.id}><h4>{f.title}</h4><p>{f.text}</p><dl className="cr-values">{f.metrics.map(v=><div key={v.id}><dt>{v.label}</dt><dd>{v.display}</dd></div>)}</dl></section>)}</Disclosure>;}
