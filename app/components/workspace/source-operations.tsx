"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
export function SourceUpload({analysisId,kind,saved}:{analysisId:string;kind:'BKI'|'QUARTERLY'|'BFO';saved:()=>void|Promise<void>}) {
 const pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[fileName,setFileName]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending.current)return;pending.current=true;
  const form=e.currentTarget;setBusy(true);setMessage('');setFailed(false);
  try{
   const data=new FormData(form);data.set('analysisId',analysisId);data.set('sourceType',kind);
   const r=await fetch('/api/source-documents',{method:'POST',body:data});const body=await r.json();
   if(!r.ok)throw Error(body.error||'Документ не сохранён');
   if(!mounted.current)return;form.reset();setFileName('');setMessage('Документ сохранён. Обновляем анализ…');await saved();if(mounted.current)setMessage('Документ добавлен. Финансовая картина обновлена.');
  }catch(e){if(mounted.current){setFailed(true);setMessage(e instanceof Error?e.message:'Ошибка загрузки');}}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 const accept=kind==='BKI'?'.pdf':'.pdf,.xlsx,.csv';
 return <form onSubmit={submit} className="ws-source-upload" id={'source-'+kind.toLowerCase()} aria-busy={busy} aria-label={kind==='BKI'?'Добавить кредитную историю':kind==='BFO'?'Добавить бухгалтерскую отчётность':'Добавить квартальную отчётность'}>
  <h2>{kind==='BKI'?'Добавить кредитную историю':kind==='BFO'?'Добавить бухгалтерскую отчётность':'Добавить квартальную отчётность'}</h2>
  <p>{kind==='BKI'?'PDF с кредитной историей. Обязательства появятся после проверки источника.':kind==='BFO'?'Текстовый PDF, XLSX или CSV: ИНН, годовой период, единица измерения и строки отчётности. Один период в файле; другие годы добавляйте отдельными файлами. Повторная загрузка за тот же период обновит его.':'PDF, XLSX или CSV за промежуточный период. Укажите в файле период и единицу измерения.'}</p>
  <p className="pc-muted">{kind==='BKI'?'До 35 МБ. ':'До 25 МБ. '}PDF должен содержать текст: сканы и фотографии не распознаются.</p>
  {kind==='BKI'&&<label>Кому принадлежит отчёт<select name="relationship"><option>Компания-заёмщик</option><option>ИП-заёмщик</option><option>Собственник</option><option>Руководитель</option><option>Поручитель</option><option>Не указано</option></select></label>}
  <label>Исходный документ
   <span className="pc-file-control">
    <input className="pc-file-native" type="file" name="file" required accept={accept} onChange={e=>setFileName(e.currentTarget.files?.[0]?.name??'')}/>
    <span className="pc-file-button">Выбрать файл</span>
    <span className="pc-file-name">{fileName||'Файл не выбран'}</span>
   </span>
  </label>
  <label className="ws-consent"><input type="checkbox" required/>Подтверждаю право передать документ и согласие на обработку данных.</label>
  <button disabled={busy} className="ws-primary">{busy?'Обрабатываем…':'Загрузить документ'}</button>
  {message&&<p role={failed?'alert':'status'}>{message}</p>}
 </form>;
}
type Profile={fetchedAt?:string;source?:string;company?:{name?:string;ogrn?:string;status?:string;registrationDate?:string;okved?:string;region?:string};contracts?:{items?:Array<{number?:string;subject?:string;amount?:number}>};error?:string};
export function CompanyData({id,inn,updated}:{id:string;inn:string;updated:()=>void|Promise<void>}) {
 const [data,setData]=useState<Profile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{const r=await fetch(`/api/checko?inn=${encodeURIComponent(inn)}&analysisId=${encodeURIComponent(id)}`);const body=await r.json();if(!r.ok)throw Error(body.error||'Источник недоступен');setData(body);await updated();}catch(e){setError(e instanceof Error?e.message:'Источник недоступен');}finally{setBusy(false);}}
 return <section className="ws-section"><h2>Компания и открытая отчётность</h2><p>Регистрационные сведения и БФО из официальных источников. Кредитная интерпретация доступна в подробном анализе.</p><button disabled={busy} onClick={load}>{busy?'Получаем сведения…':'Получить открытые сведения'}</button>{!data&&<p>Открытые сведения в этом просмотре ещё не запрошены. Получение может обратиться к внешнему сервису.</p>}{data?.fetchedAt&&<p>Сведения получены: {data.fetchedAt.slice(0,10)}. Дата получения не гарантирует актуальность каждого факта.</p>}{error&&<p role="alert">{error}</p>}{data?.company&&<><dl className="ws-detail-list">{[['Компания',data.company.name],['ОГРН',data.company.ogrn],['Статус',data.company.status],['Регистрация',data.company.registrationDate],['Деятельность',data.company.okved],['Регион',data.company.region]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Не указано'}</dd></div>)}</dl></>}{data?.contracts?.items?.map((x,i)=><p key={i}>Контракт {x.number} · {x.subject}</p>)}</section>;
}

export function RecipientApplications({analysis,saved}:{analysis:{id:string;companyName:string;companyInn:string};saved:()=>void|Promise<void>}) {
 const pending=useRef(false),request=useRef<{key:string;id:string}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(pending.current)return;pending.current=true;const form=e.currentTarget,fields=new FormData(form);setBusy(true);setMessage('');try{const applications=String(fields.get('banks')).split(',').map(bank=>({bank:bank.trim(),product:String(fields.get('product')),amount:Number(fields.get('amount'))})).filter(x=>x.bank);const key=JSON.stringify(applications);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'applications',requestId:request.current.id,analysisId:analysis.id,companyName:analysis.companyName,companyInn:analysis.companyInn,consentAt:new Date().toISOString(),applications})});const body=await r.json();if(!r.ok||!body.deals)throw Error(body.error||'Заявки не сохранены');request.current=null;await saved();form.reset();setMessage('Заявки созданы. Брокер проверит документы перед отправкой.');}catch(e){setMessage(e instanceof Error?e.message:'Ошибка сохранения');}finally{pending.current=false;setBusy(false);}}
 return <details className="ws-section"><summary>Подготовить заявки выбранным получателям</summary><form className="ws-source-upload" onSubmit={submit}><p>Укажите получателей самостоятельно или согласуйте их с брокером. Это обычные заявки, без автоматического подбора банка.</p><label>Банки или партнёры через запятую<input name="banks" required/></label><label>Продукт<select name="product"><option>Оборотный кредит</option><option>Контрактный кредит</option><option>Банковская гарантия</option><option>Факторинг</option><option>Лизинг</option><option>Рефинансирование</option></select></label><label>Запрошенная сумма, ₽<input type="number" name="amount" min="1" required/></label><label className="ws-consent"><input type="checkbox" required/>Подтверждаю создание заявок выбранным получателям, полномочия и согласие на подготовку передачи данных. Отправка — после проверки брокером.</label><button disabled={busy} className="ws-primary">{busy?'Сохраняем…':'Создать заявки'}</button>{message&&<p role="status">{message}</p>}</form></details>;
}
