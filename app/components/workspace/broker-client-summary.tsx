"use client";
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceModel} from './use-model';

export function BrokerClientSummary({analysisId}:{analysisId:string}){
  const target=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}
    },{rootMargin:'120px'});
    if(target.current)observer.observe(target.current);
    return ()=>observer.disconnect();
  },[]);
  const {model}=useWorkspaceModel(visible?analysisId:'');
  const readiness=model?.full?.report.readiness;
  return <div ref={target}>{readiness&&<small>Готовность · {readiness.level}</small>}</div>;
}
