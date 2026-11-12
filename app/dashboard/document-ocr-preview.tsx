'use client';
import {useMemo,useRef,useState} from 'react';
import {extractContractReview,type ContractFactKey} from '../../lib/document-poc/contract-facts';
import {routeDocument,DOCUMENT_UPLOAD_DEFINITIONS,type UploadFamily,type RoutingDecision} from '../../lib/document-poc/document-routing';
import type {OcrLayout,OcrPage} from '../../lib/document-poc/local-ocr';
type DocumentOption={id:string;fileName:string;category:string};
type OcrResponse={status:'PREVIEW';fileName:string;ocr:{pageCount:number;processedFrom:number;processedTo:number;pages:OcrPage[];warnings:string[]};warnings:string[]};
const names:Record<ContractFactKey,string>={
 CONTRACT_DATE:'Дата договора',CONTRACT_AMOUNT:'Цена договора, ₽',ADVANCE_MAX_PERCENT:'Предельный аванс, %',
 ADVANCE_MAX_ESTIMATE:'Максимальный аванс (расчёт), ₽',ADVANCE_TIMING:'Срок возможного аванса',
 INTERIM_PAYMENT:'Промежуточные расчёты',FINAL_PAYMENT:'Окончательный расчёт',WORK_START:'Начало работ',WORK_END:'Окончание работ',
 CONTRACT_DURATION:'Срок действия договора',ASSIGNMENT:'Уступка требования',TITLE_TRANSFER:'Переход собственности',PAYMENT_SCHEDULE:'Календарный график платежей'
};
const familyNames:Record<RoutingDecision['actualFamily'],string>={BFO:'Бухгалтерская отчётность',CREDIT:'Кредитные документы',COMMERCIAL:'Коммерческий договор',OTHER:'Другой документ',UNKNOWN:'Требуется уточнение',MIXED:'Смешанный комплект'};
const routingMessages:Record<RoutingDecision['status'],string>={READY_FOR_REVIEW:'Тип определён; извлечённые поля требуют проверки.',INCOMPLETE:'Тип уточняется: необходимо прочитать все листы.',TYPE_MISMATCH:'Содержимое не соответствует выбранной загрузке. Используйте подходящий раздел.',MIXED_REVIEW:'Обнаружены разные документы. Разделите комплект перед финансовым разбором.',TYPE_REVIEW:'Тип по содержимому не установлен. Нужна проверка документа.',PARENT_REQUIRED:'Укажите основной договор, к которому относятся приложение или изменения.',RELATED_DOCUMENT_REVIEW:'Этот документ требует отдельного анализатора; он не создаёт обычный кредит или баланс.',RETRY_CONFLICT:'Результаты двух OCR-проходов различаются. Проверьте исходник и выберите проход для предварительного разбора.',INPUT_INVALID:'Параметры распознавания требуют проверки.'};
export default function DocumentOcrPreview({documents,expectedFamily}:{documents:DocumentOption[];expectedFamily?:UploadFamily}){
 const available=documents.filter(d=>/\.pdf$/i.test(d.fileName));
 const [selected,setSelected]=useState(''),[layout,setLayout]=useState<OcrLayout>('SINGLE'),[quality,setQuality]=useState<'STANDARD'|'HIGH'>('STANDARD');
 const [pages,setPages]=useState<OcrPage[]>([]),[extraPages,setExtraPages]=useState<OcrPage[]>([]),[total,setTotal]=useState(0),[progress,setProgress]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const [scanWarnings,setScanWarnings]=useState<string[]>([]),[retryChoice,setRetryChoice]=useState<'FIRST'|'SECOND'|null>(null);
 const stopped=useRef(false),controller=useRef<AbortController|null>(null);
 const documentId=available.some(d=>d.id===selected)?selected:available[0]?.id??'';
 const reviewPages=useMemo(()=>retryChoice==='FIRST'?pages:retryChoice==='SECOND'?[...pages.filter(p=>!extraPages.some(e=>e.page===p.page&&e.segment===p.segment)),...extraPages]:[...pages,...extraPages],[pages,extraPages,retryChoice]);
 const routing=useMemo(()=>routeDocument({expectedFamily,pages:reviewPages,totalPhysicalPages:total||null,layout,extractionWarnings:scanWarnings}),[expectedFamily,reviewPages,total,layout,scanWarnings]);
 const contract=useMemo(()=>routing.parser==='COMMERCIAL_CONTRACT'?extractContractReview(reviewPages):null,[routing.parser,reviewPages]);
 function reset(){setPages([]);setExtraPages([]);setProgress(0);setTotal(0);setDone(false);setError('');setScanWarnings([]);setRetryChoice(null);}
 async function run(){
  if(busy||!documentId)return;
  stopped.current=false;setBusy(true);setError('');setDone(false);
  let next=progress+1,totalPages=total;
  const scanned=[...pages],warnings=[...scanWarnings];
  try{
   for(;;){
    controller.current=new AbortController();
    const limit=quality==='HIGH'?2:3;
    const response=await fetch('/api/document-ocr',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({documentId,fromPage:next,toPage:totalPages?Math.min(totalPages,next+limit-1):next,layout,quality,expectedFamily}),
      cache:'no-store',signal:controller.current.signal});
    const data=await response.json() as OcrResponse&{error?:string};
    if(!response.ok)throw Error(data.error??'Не удалось прочитать документ');
    totalPages=data.ocr.pageCount;
    setTotal(totalPages);setProgress(data.ocr.processedTo);
    scanned.push(...data.ocr.pages);warnings.push(...data.ocr.warnings);setScanWarnings([...new Set(warnings)]);
    setPages([...scanned].sort((a,b)=>a.logicalPage-b.logicalPage));
    next=data.ocr.processedTo+1;
    if(next>totalPages){
      // A faint first sheet sometimes loses a key date at one resolution.
      // Re-run only that sheet at the other DPI and merge review evidence, not accounting facts.
      const completedRouting=routeDocument({expectedFamily,pages:scanned,totalPhysicalPages:totalPages,layout,extractionWarnings:warnings});
      const commercial=completedRouting.parser==='COMMERCIAL_CONTRACT';
      const candidates=commercial?extractContractReview(scanned).facts:[];
      const missing=candidates.some(f=>['CONTRACT_DATE','WORK_START','WORK_END'].includes(f.key)&&f.value===null);
      if(missing&&commercial&&layout==='TWO_UP_ROTATED'&&!stopped.current){
       try{
        const other=quality==='HIGH'?'STANDARD':'HIGH';
        controller.current=new AbortController();
        const retry=await fetch('/api/document-ocr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId,fromPage:1,toPage:1,layout,quality:other,expectedFamily}),cache:'no-store',signal:controller.current.signal});
        const refined=await retry.json() as OcrResponse&{error?:string};
        if(retry.ok){setExtraPages(refined.ocr.pages);setScanWarnings([...new Set([...warnings,...refined.ocr.warnings])]);}
       }catch{/* The first pass remains available for manual review. */}
      }
      setDone(true);break;
    }
    if(stopped.current)break;
   }
  }catch(e){if(!stopped.current)setError(e instanceof Error?e.message:'OCR недоступен');}
  finally{controller.current=null;setBusy(false);}
 }
 function stop(){stopped.current=true;controller.current?.abort();}
 if(!available.length)return null;
 return <section className="ps-card" data-testid="prescore-local-ocr" aria-label="OCR финансовых документов">
  <h3>{expectedFamily?DOCUMENT_UPLOAD_DEFINITIONS[expectedFamily].title:'Распознавание финансовых документов'}</h3>
  <p>Текст читается на сервере Prescore с помощью бесплатного CPU OCR. Данные не отправляются DeepSeek. Условия требуют проверки и пока не меняют расчёты компании.</p>
  <label>Документ <select value={documentId} disabled={busy} onChange={e=>{setSelected(e.target.value);reset();}}>{available.map(d=><option key={d.id} value={d.id}>{d.fileName} — {d.category}</option>)}</select></label>
  <label>Расположение страниц <select disabled={busy} value={layout} onChange={e=>{setLayout(e.target.value as OcrLayout);reset();}}>
   <option value="SINGLE">Одна страница на листе</option><option value="TWO_UP_ROTATED">Две повёрнутые страницы на одном PDF-листе</option>
  </select></label>
  <label>Качество <select disabled={busy} value={quality} onChange={e=>{setQuality(e.target.value as 'STANDARD'|'HIGH');reset();}}>
   <option value="STANDARD">Обычное (быстрее)</option><option value="HIGH">Повышенное (медленнее, для мелкого текста)</option>
  </select></label>
  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
   <button type="button" disabled={busy||!documentId||done} onClick={()=>void run()}>{busy?'Распознаём…':progress?'Продолжить распознавание':'Распознать PDF локально'}</button>
   {busy&&<button type="button" onClick={stop}>Остановить</button>}
   {progress>0&&<span role="status">PDF-листов обработано: {progress}{total?' из '+total:''}</span>}
  </div>
  {error&&<p role="alert">{error} Можно продолжить с последнего обработанного листа.</p>}
  {done&&<p role="status">Распознавание завершено. {extraPages.length?'Для плохо читаемого первого листа добавлен второй OCR-проход. ':''}Проверьте все финансовые поля по оригиналу.</p>}
  {!!pages.length&&<section aria-label="Результат локального OCR">
   <p data-testid="document-routing-result"><strong>Тип по содержимому: {familyNames[routing.actualFamily]}.</strong> {routingMessages[routing.status]}</p>
   {routing.status==='RETRY_CONFLICT'&&extraPages.length>0&&<div><button type="button" disabled={busy} onClick={()=>setRetryChoice('FIRST')}>Использовать первый проход</button><button type="button" disabled={busy} onClick={()=>setRetryChoice('SECOND')}>Использовать повторный проход</button><p>Выбор относится только к предпросмотру; он не подтверждает финансовые факты.</p></div>}
   {retryChoice&&<p>Для предпросмотра выбран {retryChoice==='FIRST'?'первый':'повторный'} проход. <button type="button" disabled={busy} onClick={()=>setRetryChoice(null)}>Сравнить проходы</button></p>}
   {contract?<><h4>Предварительные условия коммерческого договора</h4>
   <div className="ps-table-scroll"><table><thead><tr><th>Поле</th><th>Извлечено</th><th>Основание</th></tr></thead><tbody>
    {contract.facts.map(f=><tr key={f.key}><th>{names[f.key]}</th><td>{f.value??'Не подтверждено'}<small> · {f.status==='REVIEW'?'Проверить':'Неизвестно'}</small></td>
     <td>{f.pdfPage?`PDF-лист ${f.pdfPage}, страница ${f.logicalPage}`:'Нет надёжного извлечения'}{f.sourceText&&<details><summary>Фрагмент</summary><p>{f.sourceText}</p></details>}<small>{f.note}</small></td></tr>)}
   </tbody></table></div>
   <p>Уступка требования не признаётся разрешённой автоматически; дата окончания работ не считается датой оплаты. Сведения не являются юридическим заключением.</p></>:<p>{routing.parser==='FINANCIAL_STATEMENT'?'БФО определена. Специализированный табличный анализатор ещё не подключён к этому OCR-предпросмотру.':routing.parser==='CREDIT_AGREEMENT'?'Кредитный документ определён. Анализатор кредитных условий ещё не подключён к этому OCR-предпросмотру.':'Финансовый парсер не запускается, пока тип и полнота чтения требуют проверки.'}</p>}
   <p>Результат этого предпросмотра пока не сохраняется после перезагрузки страницы и не меняет действующие расчёты.</p>
   <details><summary>Текст OCR по страницам ({pages.length})</summary>{pages.map(p=><section key={`${p.page}-${p.segment}`}><h5>PDF-лист {p.page}, страница {p.logicalPage} · {p.method}</h5><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{p.text}</pre></section>)}</details>
  </section>}
 </section>;
}