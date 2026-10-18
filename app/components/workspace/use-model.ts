"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model";
export function useWorkspaceModel(id: string, revision=0, endpoint='/api/workspace-model?analysisId=') {
 const [result,setResult]=useState<{id:string;revision:number;model:WorkspaceModelV1|null;error:string}>({id:'',revision:0,model:null,error:''});
 const [pending,setPending]=useState(false),active=useRef(''),request=useRef<AbortController|null>(null);
 const scope=`${endpoint}${id}:${revision}`;
 const load=useCallback(async()=>{
  if(!id||active.current!==scope)return false;
  request.current?.abort();const controller=new AbortController();request.current=controller;
  try{
   const r=await fetch(`${endpoint}${encodeURIComponent(id)}`,{signal:controller.signal,cache:'no-store'}),data=await r.json();
   if(!r.ok||!['READY_BASIC','READY_FULL'].includes(data.state)||data.analysisId!==id)throw Error(r.status===404?'Эта версия анализа недоступна.':'Не удалось загрузить финансовую картину. Попробуйте снова.');
   if(controller.signal.aborted||active.current!==scope)return false;
   setResult({id,revision,model:data as WorkspaceModelV1,error:''});return true;
  }catch(e){
   if(!controller.signal.aborted&&active.current===scope)setResult(previous=>({id,revision,model:previous.id===id?previous.model:null,error:e instanceof TypeError?'Не удалось загрузить финансовую картину. Проверьте соединение и повторите.':e instanceof Error?e.message:'Ошибка загрузки'}));
   return false;
  }finally{if(request.current===controller)setPending(false);}
 },[id,revision,endpoint,scope]);
 useEffect(()=>{active.current=scope;void load();return()=>{active.current='';request.current?.abort();};},[load,scope]);
 const refresh=useCallback(async()=>{if(active.current!==scope)return false;setPending(true);return load();},[load,scope]);
 const sameAnalysis=result.id===id,current=sameAnalysis&&result.revision===revision;
 return sameAnalysis?{model:result.model,error:result.model?'':result.error,refreshError:result.model?result.error:'',loading:!result.model&&!current,refreshing:pending||!current,refresh}:{model:null,error:'',refreshError:'',loading:!!id,refreshing:false,refresh};
}
export function selectAnalysis(id:string){const url=new URL(window.location.href);url.searchParams.set('analysisId',id);window.history.replaceState(null,'',url);}
