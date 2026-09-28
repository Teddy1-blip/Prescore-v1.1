"use client";
import { useEffect, useState } from "react";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model";
export function useWorkspaceModel(id: string, revision=0) {
 const [result,setResult]=useState<{id:string;revision:number;model:WorkspaceModelV1|null;error:string}>({id:'',revision:0,model:null,error:''});
 useEffect(()=>{if(!id)return;const controller=new AbortController();
 fetch(`/api/workspace-model?analysisId=${encodeURIComponent(id)}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok||!['READY_BASIC','READY_FULL'].includes(data.state))throw Error(r.status===404?'Эта версия анализа недоступна.':'Не удалось загрузить финансовую картину. Попробуйте снова.');return data as WorkspaceModelV1;}).then(model=>setResult({id,revision,model,error:''})).catch(e=>{if(!controller.signal.aborted)setResult({id,revision,model:null,error:e instanceof TypeError?'Не удалось загрузить финансовую картину. Проверьте соединение и повторите.':e instanceof Error?e.message:'Ошибка загрузки'});});
 return ()=>controller.abort();},[id,revision]);
 return result.id===id&&result.revision===revision?{model:result.model,error:result.error,loading:false}:{model:null,error:'',loading:!!id};
}
export function selectAnalysis(id:string){const url=new URL(window.location.href);url.searchParams.set('analysisId',id);window.history.replaceState(null,'',url);}
