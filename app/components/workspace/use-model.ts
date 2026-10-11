"use client";
import { useEffect, useState } from "react";
import type { WorkspaceModelV1 } from "../../../lib/workspace/model";
export function useWorkspaceModel(id: string, revision=0, endpoint='/api/workspace-model?analysisId=') {
 const [result,setResult]=useState<{id:string;revision:number;model:WorkspaceModelV1|null;error:string}>({id:'',revision:0,model:null,error:''});
 useEffect(()=>{if(!id)return;const controller=new AbortController();
 fetch(`${endpoint}${encodeURIComponent(id)}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok||!['READY_BASIC','READY_FULL'].includes(data.state)||data.analysisId!==id)throw Error(r.status===404?'Эта версия анализа недоступна.':'Не удалось загрузить финансовую картину. Попробуйте снова.');return data as WorkspaceModelV1;}).then(model=>{if(!controller.signal.aborted)setResult({id,revision,model,error:''});}).catch(e=>{if(!controller.signal.aborted)setResult(previous=>({id,revision,model:previous.id===id?previous.model:null,error:e instanceof TypeError?'Не удалось загрузить финансовую картину. Проверьте соединение и повторите.':e instanceof Error?e.message:'Ошибка загрузки'}));});
 return ()=>controller.abort();},[id,revision,endpoint]);
 const sameAnalysis=result.id===id,current=sameAnalysis&&result.revision===revision;
 return sameAnalysis?{model:result.model,error:result.model?'':result.error,refreshError:result.model?result.error:'',loading:!result.model&&!current,refreshing:!current}:{model:null,error:'',refreshError:'',loading:!!id,refreshing:false};
}
export function selectAnalysis(id:string){const url=new URL(window.location.href);url.searchParams.set('analysisId',id);window.history.replaceState(null,'',url);}
