'use client';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {LayoutDashboard,Users,ContactRound,Columns3,BriefcaseBusiness,Files,Landmark,Wallet,Network,Bell,Menu,X,Sparkles} from 'lucide-react';
import {agentRecordId} from '../../../lib/agent/workflow';
import type {AgentIdentity} from '../../../lib/agent/types';
import {useAgentRead} from './data';
import './workspace.css';
import '../../components/workspace/client-product.css';
import '../../components/workspace/workspace.css';
import '../../components/workspace/broker-product.css';
import '../../dashboard/report-v2/analysis-v3.css';
import '../../dashboard/dashboard.css';

const nav=[['','Рабочий стол',LayoutDashboard],['clients','Клиенты',Users],['leads','Лиды / База',ContactRound],
  ['pipeline','Воронка',Columns3],['applications','Заявки',BriefcaseBusiness],['documents','Документы',Files],
  ['partners','Банки и партнёры',Landmark],['commissions','Комиссии',Wallet],['network','Агентская сеть',Network],
  ['notifications','Уведомления',Bell]] as const;
export function AgentShell({children}:{children:ReactNode}){
  const path=usePathname(),search=useSearchParams(),[open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),rail=useRef<HTMLElement>(null);
  const {data}=useAgentRead<AgentIdentity>('/api/agent?surface=shell');
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const close=()=>{setOpen(false);trigger.current?.focus();};
    const timer=requestAnimationFrame(()=>rail.current?.querySelector<HTMLElement>('button')?.focus());
    const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){close();return;}if(e.key!=='Tab')return;
      const nodes=Array.from(rail.current?.querySelectorAll<HTMLElement>('button,a[href]')??[]).filter(n=>n.getClientRects().length);
      if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
      if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}
    };
    const resized=()=>{if(window.innerWidth>850)setOpen(false);};
    window.addEventListener('resize',resized);document.addEventListener('keydown',keys);
    return()=>{cancelAnimationFrame(timer);document.body.style.overflow=previous;window.removeEventListener('resize',resized);document.removeEventListener('keydown',keys);};
  },[open]);
  const assistantQuery=new URLSearchParams();
  if(path.startsWith('/agent/clients/')){
    assistantQuery.set('client',agentRecordId(path));
    if(search.get('analysisId'))assistantQuery.set('analysisId',search.get('analysisId')!);
  }
  return <div className="ag-shell"><a className="ag-skip" href="#agent-main">К содержимому</a>
    {open&&<button className="ag-shade" aria-label="Закрыть меню" onClick={()=>{setOpen(false);trigger.current?.focus();}}/>}
    <aside ref={rail} id="agent-nav" className={'ag-rail'+(open?' open':'')} aria-label="Кабинет агента">
      <div className="ag-brand"><Link href="/agent" onClick={()=>setOpen(false)}>prescore<span>.</span></Link><button onClick={()=>{setOpen(false);trigger.current?.focus();}} aria-label="Закрыть навигацию"><X/></button></div>
      <small>РАБОТА С КЛИЕНТАМИ</small><nav aria-label="Разделы кабинета">{nav.map(([slug,label,Icon])=>{
        if(slug==='leads'&&data?.modules?.prospects===false)return null;
        const href='/agent'+(slug?'/'+slug:'');const selected=path===href||!!slug&&path.startsWith(href+'/');
        return <Link key={href} href={href} aria-current={selected?'page':undefined} onClick={()=>setOpen(false)}><Icon size={17}/>{label}</Link>;
      })}</nav>
      <footer><small>Кабинет агента</small>{data?.agent.name&&<strong>{data.agent.name}</strong>}
        <div><Link href="/logout">Сменить аккаунт</Link><Link href="/logout">Выйти</Link></div></footer></aside>
    <div className="ag-main"><header className="ag-top"><button className="ag-menu" ref={trigger} aria-label="Открыть меню" aria-expanded={open} aria-controls="agent-nav" onClick={()=>setOpen(!open)}><Menu/></button>
      <span>Кабинет агента</span><Link className="ag-ai" href={'/agent/assistant'+(assistantQuery.size?'?'+assistantQuery:'')}><Sparkles size={16}/>Спросить Prescore</Link>
    </header><main id="agent-main" tabIndex={-1} className="ag-content">{children}</main></div>
  </div>;
}
