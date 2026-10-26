"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model";
import { workspaceDiagnosticMessage } from "../../../lib/workspace/diagnostic-view";
export function useWorkspaceModel(id: string, revision=0, endpoint='/api/workspace-model?analysisId=') {
 const [result,setResult]=useState<{id:string;revision:number;model:WorkspaceModelV1|null;error:string;diagnostic:string}>({id:'',revision:0,model:null,error:'',diagnostic:''});
 const [pending,setPending]=useState(false),active=useRef(''),request=useRef<AbortController|null>(null);
 const scope=`${endpoint}${id}:${revision}`;
 const load=useCallback(async()=>{
  if(!id||active.current!==scope)return false;
  request.current?.abort();const controller=new AbortController();request.current=controller;
  let failureDiagnostic='',message='Не удалось загрузить финансовую картину. Попробуйте снова.',discardPrevious=false;
  try{
   const r=await fetch(`${endpoint}${encodeURIComponent(id)}`,{signal:controller.signal,cache:'no-store'});
   discardPrevious=[401,403,404].includes(r.status);
   if(discardPrevious)message=r.status===401?'Сессия завершена. Войдите в кабинет повторно.':'Эта версия анализа недоступна.';
   const data=await r.json();
   if(!discardPrevious&&data?.analysisId===id)failureDiagnostic=workspaceDiagnosticMessage(data.diagnostic);
   if(!r.ok||!['READY_BASIC','READY_FULL'].includes(data?.state)||data.analysisId!==id)throw Error('WORKSPACE_RESPONSE_UNAVAILABLE');
   if(controller.signal.aborted||active.current!==scope)return false;
   setResult({id,revision,model:data as WorkspaceModelV1,error:'',diagnostic:failureDiagnostic});return true;
  }catch(e){
   if(!controller.signal.aborted&&active.current===scope)setResult(previous=>({id,revision,model:!discardPrevious&&previous.id===id?previous.model:null,error:e instanceof TypeError?'Не удалось загрузить финансовую картину. Проверьте соединение и повторите.':message,diagnostic:failureDiagnostic}));
   return false;
  }finally{if(request.current===controller)setPending(false);}
 },[id,revision,endpoint,scope]);
 useEffect(()=>{active.current=scope;void load();return()=>{active.current='';request.current?.abort();};},[load,scope]);
 const refresh=useCallback(async()=>{if(active.current!==scope)return false;setPending(true);return load();},[load,scope]);
 const sameAnalysis=result.id===id,current=sameAnalysis&&result.revision===revision;
 return sameAnalysis?{model:result.model,error:result.model?'':result.error,diagnostic:result.diagnostic,refreshError:result.model?result.error:'',loading:!result.model&&!current,refreshing:pending||!current,refresh}:{model:null,error:'',diagnostic:'',refreshError:'',loading:!!id,refreshing:false,refresh};
}
export function selectAnalysis(id:string){const url=new URL(window.location.href);url.searchParams.set('analysisId',id);window.history.replaceState(null,'',url);}
