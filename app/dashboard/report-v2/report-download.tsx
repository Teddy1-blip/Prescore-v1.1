'use client';

import {useState} from 'react';
import type {PdfReport} from './report-pdf';

export function ReportDownload({report}:{report:PdfReport}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  async function download(){
    setBusy(true);
    setError(false);
    try{
      const {saveReportPdf}=await import('./report-pdf');
      await saveReportPdf(report);
    }catch{setError(true);}
    finally{setBusy(false);}
  }
  return <div className="cr-download cr-screen-only">
    <button type="button" className="cr-print-button" onClick={download} disabled={busy}>{busy?'Готовим файл…':'Скачать отчёт PDF'}</button>
    {error&&<span role="alert">Не удалось сохранить файл. Повторите загрузку или воспользуйтесь печатью.</span>}
  </div>;
}
