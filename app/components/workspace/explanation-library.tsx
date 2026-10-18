"use client";
import {useState} from 'react';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {publicText as clientText} from '../../../lib/credit-engine/client-report/copy';
import {Evidence} from './credit-depth';
export function ExplanationLibrary({model}:{model:WorkspaceModelV1}){
 const [query,setQuery]=useState(''),[selected,setSelected]=useState('');
 const e=model.full?.canonical.explainability;if(!e)return null;
 const section=e.sections.find(s=>s.sectionCode===selected)??e.sections[0];
 const publicClaims=e.claims.filter(c=>c.claimKind!=='INDEX_CONTRIBUTION');
 const candidates=query?publicClaims:publicClaims.filter(c=>section?.claimIds.includes(c.claimId));
 const items=candidates.filter(c=>clientText(c.titleRu+' '+c.textRu).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 return <section className="ws-section"><h2>Почему Prescore так решил?</h2><p>Найдите вывод или выберите раздел, чтобы проверить его источники и период.</p><label>Раздел оснований<select className="cc-evidence-search" value={section?.sectionCode??''} onChange={event=>{setSelected(event.target.value);setQuery('');}}>{e.sections.map(s=><option value={s.sectionCode} key={s.sectionCode}>{clientText(s.titleRu)}</option>)}</select></label><label>Поиск по всем выводам<input className="cc-evidence-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Например, ликвидность или долговая нагрузка"/></label><p>Найдено оснований: {items.length}</p>{!query&&section&&<p>{clientText(section.summaryRu)}</p>}<div className="cc-cards">{items.map(c=><article className="cc-card" key={c.claimId}><h3>{clientText(c.titleRu)}</h3><p>{clientText(c.textRu)}</p><Evidence model={model} claimIds={[c.claimId]}/></article>)}</div><details className="cc-card"><summary>Термины анализа</summary><dl className="cc-prose">{e.glossary.map(t=><div key={t.code}><dt>{t.termRu}</dt><dd>{clientText(t.definitionRu)}</dd></div>)}</dl></details></section>;
}
