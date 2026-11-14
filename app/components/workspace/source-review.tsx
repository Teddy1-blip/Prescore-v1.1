'use client';
import {useState} from 'react';
import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {Panel} from './client-insights';
type Review=ReturnType<typeof sourceProjection>['reviews'][number];
export function SourceReview({review,save}:{review:Review;save:(field:string,value:string)=>Promise<void>}){
 const [values,setValues]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function confirm(key:string,value:string){setError('');setBusy(true);try{await save(key,value);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Panel title={'Проверка полей · '+review.name}><div className="pc-review-columns"><section><h3>Исходный документ</h3>{review.documentId&&<a href={'/api/documents?download='+encodeURIComponent(review.documentId)}>Скачать оригинал PDF</a>}
 {review.fields.filter(f=>f.fragment).map((f,i)=><blockquote key={i}><small>Страница {f.page}</small><p>{f.fragment}</p></blockquote>)}</section>
 <section><h3>Извлечённые поля</h3><small>Версия обработки · {review.version}</small>
 {!review.fields.length&&<p>Тип или полнота текста требуют проверки. Откройте оригинал и предпросмотр OCR.</p>}
 {review.fields.map((f,i)=>{const confirmed=review.verified[f.key],value=values[f.key]??confirmed?.value??f.value??'';
  return <div key={i}><label>{f.label} {f.unit} <input value={value} disabled={!f.fragment||busy} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/></label>
  <small>{confirmed?'Подтверждено пользователем':f.value===null?'Значение не прочитано':'Проверить по оригиналу'}{f.page?' · страница '+f.page:''}</small>
  {f.fragment&&<button type="button" disabled={busy||!value.trim()} onClick={()=>void confirm(f.key,value)}>Подтвердить поле</button>}</div>})}
 </section></div>{error&&<p role="alert">{error}</p>}</Panel>;
}
