'use client';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {clientStatuses,applicationStatuses,closedStatuses} from '../../../lib/agent/workflow';

export function useAgentRead<T>(url:string){
  const [revision,setRevision]=useState(0);
  const [result,setResult]=useState<{url:string;revision:number;data?:T;error?:string}>({url:'',revision:0});
  const reload=useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{
    const c=new AbortController();
    fetch(url,{cache:'no-store',signal:c.signal}).then(async r=>{
      const body=await r.json();
      if(!r.ok)throw Error(body.error||'Не удалось открыть раздел.');
      if(!c.signal.aborted)setResult({url,revision,data:body});
    }).catch(e=>{if(!c.signal.aborted)setResult({url,revision,error:e.message});});
    return ()=>c.abort();
  },[url,revision]);
  return {data:result.url===url?result.data:undefined,error:result.url===url?result.error:undefined,reload};
}
export function Notice({error,reload}:{error?:string;reload:()=>void}){
  return error?<p role="alert" className="ag-empty">{error} <button onClick={reload}>Повторить</button></p>:<p role="status" className="ag-empty">Загружаем раздел…</p>;
}
export function Section({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){
  return <section className="ag-card"><header><h2>{title}</h2>{action}</header>{children}</section>;
}
export function PageHeader({title,subtitle,children}:{title:string;subtitle?:string;children?:ReactNode}){
  return <header className="ag-title"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{children}</header>;
}
export function Badge({value}:{value:string}){return <span className="ag-badge" data-tone={['Одобрена','Выдана','Анализ готов'].includes(value)?'good':value==='Требуются документы'?'attention':undefined}>{value}</span>;}
export function StatusControl({entity,id,value,onSaved}:{entity:'lead'|'application';id:string;value:string;onSaved:()=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const items=entity==='lead'?clientStatuses:applicationStatuses;
  if(entity==='application'&&closedStatuses.includes(value))return <Badge value={value}/>;
  return <label className="ag-status">{entity==='lead'?'Этап клиента':'Статус заявки'}
    <select aria-label={entity==='lead'?'Этап клиента':'Статус заявки'} value={value} disabled={busy} onChange={async e=>{
      const status=e.target.value;setBusy(true);setError('');
      try{const r=await fetch('/api/agent',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status,entity})});
        if(!r.ok)throw Error((await r.json()).error||'Не удалось сохранить статус.');onSaved();
      }catch(e){setError(e instanceof Error?e.message:'Ошибка сохранения');}finally{setBusy(false);}
    }}>{[...new Set([value,...items])].map(s=><option key={s}>{s}</option>)}</select>{error&&<span role="alert">{error}</span>}</label>;
}
export const amount=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
export function day(s?:string){if(!s)return '';const date=new Date(s);return Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU'):'';}
export function Pager({page,next,change}:{page:number;next:boolean;change:(n:number)=>void}){
  return page===1&&!next?null:<nav aria-label="Страницы списка" className="ag-pager"><button disabled={page===1} onClick={()=>change(page-1)}>Назад</button><span>Страница {page}</span><button disabled={!next} onClick={()=>change(page+1)}>Далее</button></nav>;
}
