'use client';
import {useState} from 'react';
import type {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {Panel} from './client-insights';
type Review=ReturnType<typeof sourceProjection>['reviews'][number];
export function SourceReview({review,save,recognize,approveBureau}:{review:Review;approveBureau?:()=>Promise<void>;recognize:(layout:string)=>Promise<void>;save:(field:string,value:string)=>Promise<void>}){
 const [values,setValues]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const partial=!!review.ocr&&review.ocr.through<review.ocr.total;
 const word=review.anchor==='paragraph';
 const summaryOnly=review.status==='BUREAU_STRUCTURE_REVIEW';
 const image=/\.(?:png|jpe?g)$/i.test(review.name??'');
 const [layout,setLayout]=useState(review.ocr?.layout??'SINGLE');
 async function confirm(key:string,value:string){setError('');setBusy(true);try{await save(key,value);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Panel title={'Проверка полей · '+review.name}><div className="pc-review-columns"><section><h3>Исходный документ</h3>{review.documentId&&<a href={'/api/documents?download='+encodeURIComponent(review.documentId)}>Скачать оригинал</a>}
 {!word&&!Object.keys(review.verified).length&&(!review.ocr||review.ocr.through<review.ocr.total)&&<section>{!image&&<label>Раскладка PDF <select value={layout} disabled={busy||!!review.ocr} onChange={e=>setLayout(e.target.value as typeof layout)}><option value="SINGLE">Одна страница</option><option value="TWO_UP_ROTATED">Разворот с поворотом</option></select></label>}
 <button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await recognize(layout);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{review.ocr?'Продолжить распознавание':'Распознать страницы для проверки'}</button></section>}
 {review.ocr&&<p>Обработано страниц: {review.ocr.through} из {review.ocr.total}</p>}
 {review.fields.filter(f=>f.fragment).map((f,i)=><blockquote key={i}><small>{word?'Абзац':'Страница'} {f.page}</small><p>{f.fragment}</p></blockquote>)}</section>
 <section><h3>Извлечённые поля</h3><small>Версия обработки · {review.version}</small>
 {review.bureauPages&&<details><summary>Текст по страницам</summary>{review.bureauPages.map((p,i)=><details key={i}><summary>Страница {p.page}</summary><pre style={{whiteSpace:'pre-wrap'}}>{p.text}</pre></details>)}</details>}
 {review.nbkiStructure&&<details><summary>Сопоставление НБКИ · УИд: {review.nbkiStructure.modern.length}, старых карточек: {review.nbkiStructure.legacy.length}</summary>
 <p>Предварительный индекс, не действующий кредитный портфель. Между форматами учитываются только точные совпадения УИд; остатки и просрочки не подтверждены.</p>
 <p>Прямых совпадений УИд: {review.nbkiStructure.exactUidLinks}.</p>
 {review.nbkiStructure.modern.map(r=><p key={r.uid}>УИд {r.uid} · {r.kind==='LOAN'?'Кредит/заём':r.kind==='GUARANTEE'?'Независимая гарантия':'Тип требует сверки'} · страница {r.pages.join(', ')}{r.agreementDate&&' · дата '+r.agreementDate}{r.nominalRub!==null&&' · сумма договора '+r.nominalRub.toLocaleString('ru-RU')+' ₽ (стр. '+r.nominalPage+')'}{r.termination&&' · Надлежащее исполнение '+r.termination.date+' (стр. '+r.termination.page+')'}
 {r.historicalDebt&&' · Исторический основной долг '+r.historicalDebt.principalRub.toLocaleString('ru-RU')+' ₽ на '+r.historicalDebt.asOf+' (стр. '+r.historicalDebt.page+'; расчёт по последнему платежу: '+(r.historicalDebt.lastPaymentBasis?'да':'нет')+'; НЕ текущий остаток)'}{r.status==='CONFLICT'&&' · конфликт источников'}</p>)}
 <details><summary>Старые карточки ({review.nbkiStructure.legacy.length})</summary>
 {review.nbkiStructure.legacy.map((r,i)=><p key={r.account+':'+i}>{r.account} · {r.creditor} · страница {r.pages.join(', ')}{r.printedUid&&' · УИд из карточки '+r.printedUid}{r.uidWrapped&&' (перенос строки восстановлен)'}
 {r.linkedModernUid&&' · совпадает с новым разделом'}
 {r.uidReview&&' · УИд требует сверки по оригиналу'}
 {r.statusEvidence?.reportedState==='ACTIVE'&&' · Активный по архивному отчёту'}
 {r.statusEvidence?.reportedState==='CLOSED'&&' · Закрыт по архивному отчёту'}
 {r.statusEvidence?.reportedState==='TRANSFERRED'&&' · Передан другому кредитору'}
 {r.statusEvidence?.statusDate&&' · дата статуса '+r.statusEvidence.statusDate}
 {r.statusEvidence?.fulfillmentDate&&' · дата исполнения '+r.statusEvidence.fulfillmentDate}
 {r.statusEvidence?.lastUpdatedAt&&' · обновление '+r.statusEvidence.lastUpdatedAt}
 {r.status==='CONFLICT'&&' · требуется сверка'}</p>)}</details></details>}
 {review.bureauPreview&&<section><h4>Обязательства для сверки</h4>{review.bureauPreview.map((o,i)=><p key={i}>{o.creditor} · {o.contract} {o.total!==null&&' · Общая задолженность '+o.total.toLocaleString('ru-RU')+' ₽'} {o.principal!==null&&' · Основной долг '+o.principal.toLocaleString('ru-RU')+' ₽'} · {o.reference}</p>)}
 <button disabled={!approveBureau||busy} onClick={async()=>{setBusy(true);setError('');try{await approveBureau?.();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Сверил с оригиналом · подтвердить отчёт</button></section>}
 {review.issues.includes('CREDIT_OFFER_ACCEPTANCE_UNVERIFIED')&&<p>Это заявление-оферта: условия можно проверить, но выдача кредита и акцепт пока не подтверждены. В кредитный портфель документ автоматически не попадёт.</p>}
 {summaryOnly&&<p>Сводка корпоративного НБКИ извлечена из документа только для сверки. Числа не являются подтверждёнными остатками по отдельным договорам и не включаются в кредитный расчёт. Сначала необходимо сопоставить договоры, гарантии и их уникальные идентификаторы.</p>}
 {review.status==='BUREAU_NO_ROWS'&&<p>В отчёте не удалось прочитать строки обязательств. Проверьте оригинал.</p>}
 {review.status==='BUREAU_IDENTITY_REVIEW'&&<p>Не удалось подтвердить формат, дату или принадлежность отчёта. Сверьте ИНН с оригиналом. Если ошиблись в роли, выберите правильную и загрузите тот же файл повторно.</p>}
 {review.status==='BUREAU_CONFIRMED'&&<p>Отчёт подтверждён и сохранён.</p>}
 {review.status==='TYPE_MISMATCH'&&<p>Тип документа не совпадает с выбранным разделом.</p>}
 {review.status==='MIXED_REVIEW'&&<p>В файле обнаружены документы разных типов. Проверьте состав оригинала.</p>}
 {!review.fields.length&&review.status==='INCOMPLETE'&&<p>Тип или полнота текста требуют проверки. Откройте оригинал{word?'.':' и предпросмотр OCR.'}</p>}
 {review.fields.map((f,i)=>{const confirmed=review.verified[f.key],value=values[f.key]??confirmed?.value??f.value??'';
  return <div key={i}><label>{f.label} {f.unit} <input value={value} disabled={summaryOnly||!f.fragment||!f.page||busy||partial} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/></label>
  <small>{summaryOnly?'Данные сводки · только для сверки':confirmed?'Подтверждено пользователем':f.value===null?'Значение не прочитано':'Проверить по оригиналу'}{f.page?(word?' · абзац ':' · страница ')+f.page:''}</small>
  {!summaryOnly&&f.fragment&&f.page&&<button type="button" disabled={busy||partial||!value.trim()} onClick={()=>void confirm(f.key,value)}>Подтвердить поле</button>}</div>})}
 </section></div>{error&&<p role="alert">{error}</p>}</Panel>;
}
