'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
export function LazyDisclosure({title,children}:{title:string;children:ReactNode}){
 const [open,setOpen]=useState(false),current=useRef(false),prior=useRef(false);
 useEffect(()=>{const show=()=>{prior.current=current.current;flushSync(()=>setOpen(true));};const restore=()=>setOpen(prior.current);window.addEventListener('beforeprint',show);window.addEventListener('afterprint',restore);return()=>{window.removeEventListener('beforeprint',show);window.removeEventListener('afterprint',restore);};},[]);
 return <details open={open} onToggle={e=>{current.current=e.currentTarget.open;setOpen(e.currentTarget.open);}}><summary>{title}</summary>{open&&<div className="cr-disclosure">{children}</div>}</details>;
}
