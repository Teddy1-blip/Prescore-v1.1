"use client";
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceModel} from './use-model';
export function BrokerClientSummary({analysisId}:{analysisId:string}){
 const target=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});if(target.current)observer.observe(target.current);return()=>observer.disconnect();},[]);
 const state=useWorkspaceModel(visible?analysisId:''),r=state.model?.full?.report;
 return <div ref={target} className="bp-client-summary">{state.error?<p role="alert">Анализ недоступен. Откройте досье для повторной загрузки.</p>:state.loading||!visible?<p>Загружаем показатели анализа…</p>:state.model&&<><span className="pc-badge">{state.model.entitlement}</span><p>Prescore Index: <b>{state.model.full?.canonical.prescoreIndex.value??'Недостаточно данных'}</b> · Готовность: {r?.readiness.level??'Недостаточно данных'}</p><p>Ограничение: {r?.readiness.constraints[0]?.title??r?.limitations[0]?.title??'Отдельное ограничение не опубликовано'}</p><p>Следующий шаг: {r?.recommendations.primary[0]?.title??'Проверить комплект источников'}</p></>}</div>;
}
