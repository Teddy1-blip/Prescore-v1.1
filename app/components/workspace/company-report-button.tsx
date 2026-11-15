'use client';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';

export function CompanyReportButton({dossierId,model,label,waiting=false}:{
  dossierId:string; model?:WorkspaceModelV1|null; label:string; waiting?:boolean;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[dossierId,model?.analysisId]);
  async function openReport(){
    const controller=new AbortController();
    request.current=controller;
    setBusy(true);
    setError('');
    try{
      const full=model?.full;
      const snapshot=full?.report.meta.snapshot;
      if(model?.entitlement==='FULL'&&(!full?.revisionAvailable||!snapshot)){
        throw Error('Обновите анализ, чтобы открыть сохранённую версию отчёта.');
      }
      const decision=full&&snapshot?{analysisId:model.analysisId,snapshotId:snapshot.snapshotId}:undefined;
      const response=await fetch('/api/dossier',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'issue-report',id:dossierId,decision})});
      const result=await response.json();
      if(!response.ok||!result.snapshot)throw Error(result.error||'Не удалось подготовить отчёт.');
      if(controller.signal.aborted)return;
      router.push('/dashboard/report-v2?'+new URLSearchParams({dossierId,snapshotId:result.snapshot,print:'1'}));
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Не удалось открыть отчёт.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <div className="pc-report-action"><button type="button" className="pc-secondary" disabled={busy||waiting} onClick={openReport}>{busy?'Готовим отчёт…':label}</button>
    {error&&<p role="alert">{error}</p>}</div>;
}
