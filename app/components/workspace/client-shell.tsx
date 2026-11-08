"use client";
import Link from 'next/link';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {LayoutDashboard,ChartNoAxesCombined,WalletCards,Landmark,Files,BriefcaseBusiness,Sparkles,ScanLine,Menu,X,Plus,LogOut,Users,GitBranch,Handshake,BellRing,ScrollText} from 'lucide-react';
type NavItem={id:string;label:string;Icon:typeof LayoutDashboard;later?:boolean};
export const CLIENT_NAV=[
 {id:'home',label:'Обзор',Icon:LayoutDashboard},
 {id:'banking',label:'Финансы',Icon:ChartNoAxesCombined},
 {id:'analysis',label:'Кредитный профиль',Icon:ScanLine},
 {id:'financing',label:'Финансирование',Icon:Landmark},
 {id:'documents',label:'Документы',Icon:Files},
 {id:'applications',label:'Заявки',Icon:BriefcaseBusiness},
 {id:'monitoring',label:'Мониторинг',Icon:BellRing,later:true},
 {id:'counterparties',label:'Контрагенты',Icon:Users,later:true},
 {id:'contracts',label:'Контракты',Icon:ScrollText,later:true},
] as const satisfies readonly NavItem[];
export const BROKER_NAV=[{id:'home',label:'Рабочий стол',Icon:LayoutDashboard},{id:'clients',label:'Клиенты',Icon:Users},{id:'applications',label:'Заявки',Icon:BriefcaseBusiness},{id:'pipeline',label:'Воронка',Icon:GitBranch},{id:'documents',label:'Документы',Icon:Files},{id:'partners',label:'Партнёрство',Icon:Handshake},{id:'billing',label:'Продажи и комиссии',Icon:WalletCards}] as const satisfies readonly NavItem[];
export function ClientShell({view,choose,availableViews,context,children,broker=false,admin=false,navigation}:{admin?:boolean;navigation?:readonly NavItem[];broker?:boolean;view:string;choose:(v:string)=>void;availableViews:string[];context:ReactNode;children:ReactNode}){
 const [open,setOpen]=useState(false),toggle=useRef<HTMLButtonElement>(null),rail=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const focus=requestAnimationFrame(()=>rail.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  function onKey(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();setOpen(false);toggle.current?.focus();return;}
   if(event.key!=='Tab')return;
   const nodes=rail.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)');
   if(!nodes?.length)return;
   const outside=!rail.current?.contains(document.activeElement);
   const first=nodes[0],last=nodes[nodes.length-1];
   if(event.shiftKey&&(outside||document.activeElement===first)){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(outside||document.activeElement===last)){event.preventDefault();first.focus();}
  }
  document.addEventListener('keydown',onKey);
  return()=>{cancelAnimationFrame(focus);document.removeEventListener('keydown',onKey);document.body.style.overflow=previous;};
 },[open]);
 function close(){setOpen(false);toggle.current?.focus();}
 function go(id:string){choose(id);setOpen(false);requestAnimationFrame(()=>document.getElementById('ws-main')?.focus());}
 const navItems:readonly NavItem[]=navigation??(broker?BROKER_NAV:CLIENT_NAV);
 const currentNav=navItems.filter(item=>!item.later&&availableViews.includes(item.id));
 const laterNav=navItems.filter(item=>item.later);
 return <div className="pc-app" data-client-release="client-production-20261011"><a className="pc-skip" href="#ws-main">К содержимому</a>{open&&<button className="pc-backdrop" onClick={close} aria-label="Закрыть навигацию"/>}<aside ref={rail} id="client-navigation" className={'pc-sidebar'+(open?' is-open':'')}><div className="pc-brand"><Link href={admin?"/prescore-control":broker?"/agent":"/dashboard"}>prescore<span>.</span></Link><button onClick={close} aria-label="Закрыть меню"><X size={20}/></button></div><span className="pc-caption">{admin?'УПРАВЛЕНИЕ ПЛАТФОРМОЙ':broker?'РАБОТА С КЛИЕНТАМИ':'КРЕДИТНЫЙ ПРОФИЛЬ'}</span><nav aria-label="Разделы кабинета">{currentNav.map(({id,label,Icon})=><button key={id} onClick={()=>go(id)} aria-current={view===id?'page':undefined}><Icon size={19}/><span>{label}</span></button>)}{laterNav.length>0&&<><span className="pc-nav-section">Развитие</span>{laterNav.map(({id,label,Icon})=><button key={id} type="button" disabled data-later="true"><Icon size={19}/><span>{label}</span><small className="pc-nav-later">Позже</small></button>)}</>}</nav><div className="pc-account"><span>{admin?'Кабинет администратора':broker?'Кабинет брокера':'Кабинет компании'}</span><Link href="/logout">Сменить аккаунт</Link><Link href="/logout"><LogOut size={16}/> Выйти</Link></div></aside><div className="pc-workarea"><header className="pc-topbar"><button ref={toggle} className="pc-menu" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="client-navigation" aria-label="Открыть меню"><Menu size={21}/></button><div className="pc-header-context">{context}</div>{!admin&&!broker&&availableViews.includes('analyst')&&<button className="pc-ask" aria-label="Спросить Prescore" onClick={()=>go('analyst')}><Sparkles size={17}/><span>Спросить Prescore</span></button>}{availableViews.includes('upload')&&<button className="pc-primary pc-new" onClick={()=>go('upload')}><Plus size={17}/><span>Обновить данные</span></button>}</header><main className="pc-content ws" id="ws-main" tabIndex={-1}>{children}</main><footer className="pc-footer">Прескор · Финансовый анализ бизнеса<span>Решение о финансировании принимает кредитор</span></footer></div></div>;
}
