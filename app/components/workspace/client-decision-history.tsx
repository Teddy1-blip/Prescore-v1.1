"use client";
import {useEffect,useState} from "react";
import {Panel} from "./panel";
import {date} from "./presentation";

type Revision={snapshotId:string;analysisId:string;asOfDate:string;createdAt:string;inputFingerprint:string;engineVersion:string;reportVersion:string;indexValue?:number|null;readinessLevel?:string|null};
type Change={area:string;entityId:string;kind:"ADDED"|"REMOVED"|"CHANGED";before:unknown;after:unknown};
type Diff={fromSnapshotId:string;toSnapshotId:string;changes:Change[];counts:Record<string,number>};
type HistoryState={loading:boolean;error:string|null;revisions:Revision[];diff:Diff|null};

const areaLabel:Record<string,string>={
 SOURCES:"Источники",INDEX:"Prescore Index",READINESS:"Готовность",RISK:"Риски",
 PORTFOLIO:"Кредитный портфель",CAPACITY:"Долговая ёмкость",PRODUCTS:"Финансирование",ACTIONS:"План действий",
};
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const rub=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value)+" ₽":"—";
const short=(id:string)=>id.startsWith("sha256:")?id.slice(7,19)+"…":id.slice(0,12)+"…";

const readiness:Record<string,string>={HIGH:"Высокая",MEDIUM:"Средняя",LOW:"Низкая",NOT_READY:"Пока не готова"};
function describe(change:Change){
 const before=record(change.before),after=record(change.after),value=Object.keys(after).length?after:before;
 if(change.area==="INDEX")return `Индекс: ${before.value??"—"} → ${after.value??"—"} из 1000.`;
 if(change.area==="READINESS")return `Готовность: ${readiness[String(before.level)]??"—"} → ${readiness[String(after.level)]??"—"}.`;
 if(change.area==="CAPACITY")return `Дополнительный платёж в месяц: ${rub(before.recurringPrudential)} → ${rub(after.recurringPrudential)}. На 30 дней: ${rub(before.nearTermPrudential)} → ${rub(after.nearTermPrudential)}.`;
 if(change.area==="PORTFOLIO" && change.entityId==="portfolio-summary")return `Подтверждённый долг: ${rub(record(before.fundedDebt).value)} → ${rub(record(after.fundedDebt).value)}.`;
 if(change.area==="PORTFOLIO")return `Изменилось обязательство${value.creditor?" · "+value.creditor:""}. Остаток: ${rub(value.principal)}.`;
 const verb=change.kind==="ADDED"?"Добавлено":change.kind==="REMOVED"?"Снято":"Изменено";
 if(change.area==="RISK")return verb+" в составе факторов риска.";
 if(change.area==="PRODUCTS")return verb+" в подборе продуктов финансирования.";
 if(change.area==="ACTIONS")return verb+" в плане действий.";
 return "Обновился состав использованных источников.";
}

export function DecisionHistory({analysisId,currentSnapshotId,compact=false,openHistory}:{analysisId:string;currentSnapshotId?:string;compact?:boolean;openHistory?:()=>void}){
 const [state,setState]=useState<HistoryState>({loading:true,error:null,revisions:[],diff:null});
 useEffect(()=>{
  const controller=new AbortController();
  (async()=>{
   try{
    const response=await fetch("/api/workspace-model?analysisId="+encodeURIComponent(analysisId)+"&projection=decision-history",{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("HISTORY_UNAVAILABLE");
    const body=await response.json() as {revisions?:Revision[]};
    const revisions=Array.isArray(body.revisions)?body.revisions:[];
    let diff:Diff|null=null;
    const currentIndex=currentSnapshotId?revisions.findIndex(r=>r.snapshotId===currentSnapshotId):-1;
    const previous=currentIndex>=0?revisions[currentIndex+1]:undefined;
    if(currentSnapshotId&&previous){
     const diffResponse=await fetch("/api/workspace-model?analysisId="+encodeURIComponent(analysisId)+"&projection=decision-diff&from="+encodeURIComponent(previous.snapshotId)+"&to="+encodeURIComponent(currentSnapshotId),{cache:"no-store",signal:controller.signal});
     if(!diffResponse.ok)throw new Error("DIFF_UNAVAILABLE");
     diff=await diffResponse.json() as Diff;
    }
    setState({loading:false,error:null,revisions,diff});
   }catch(error){
    if((error as {name?:string})?.name==="AbortError")return;
    setState({loading:false,error:"История версий временно недоступна.",revisions:[],diff:null});
   }
  })();
  return()=>controller.abort();
 },[analysisId,currentSnapshotId]);

 if(compact){
  if(state.loading||state.error||!state.diff)return null;
  const changes=state.diff.changes;
  return <section className="pc-change-strip"><header><h2>Что изменилось</h2><button className="pc-text-button" onClick={openHistory}>История выпусков →</button></header>
   {changes.length?<ul>{Object.keys(areaLabel).filter(area=>state.diff!.counts[area]>0).map(area=><li key={area}><b>{areaLabel[area]}</b> · {state.diff!.counts[area]}</li>)}</ul>:<p>Показатели совпадают с предыдущим выпуском.</p>}
   {changes.some(c=>c.area==='INDEX'||c.area==='CAPACITY')&&<p>{describe(changes.find(c=>c.area==='INDEX'||c.area==='CAPACITY')!)}</p>}
  </section>;
 }
 if(state.loading)return <Panel title="История версий"><p>Загружаем сохранённые выпуски…</p></Panel>;
 if(state.error)return <Panel title="История версий"><p>{state.error}</p><p className="pc-muted">Текущий кредитный анализ остаётся доступен.</p></Panel>;
 const diff=state.diff;
 return <>
  <Panel title="Что изменилось">
   {!currentSnapshotId?<p>У текущего отчёта нет идентификатора сохранённого выпуска.</p>
    :diff?.changes.length?<><p>Показаны изменения между текущим выпуском и непосредственно предыдущим. Это сравнение сохранённых результатов, а не новый расчёт.</p>
      <ul>{diff.changes.map((change,index)=><li key={change.area+change.entityId+index}><b>{areaLabel[change.area]??change.area}.</b> {describe(change)}</li>)}</ul></>
    :state.revisions.length>1?<p>Между выбранными выпусками значимых изменений в сохранённых результатах не обнаружено.</p>
    :<p>Это первый сохранённый выпуск. Сравнение появится после следующего изменения данных или версии расчёта.</p>}
  </Panel>
  <Panel title="Сохранённые выпуски">
   <p className="pc-muted">Каждый выпуск хранит именно ту публичную модель, которая была выдана пользователю. При открытии старой версии она не пересчитывается текущими правилами.</p>
   {state.revisions.length?<div className="pc-table-scroll" tabIndex={0} aria-label="История версий Prescore"><table><thead><tr><th>Срез</th><th>Сохранён</th><th>Оценка</th><th>Действия</th></tr></thead><tbody>{state.revisions.map(revision=>{
    const current=revision.snapshotId===currentSnapshotId;
    const href="/dashboard/report-v2?analysisId="+encodeURIComponent(analysisId)+"&snapshotId="+encodeURIComponent(revision.snapshotId);
    return <tr key={revision.snapshotId}><th>{date(revision.asOfDate)}{current&&<small>Текущий выпуск</small>}{!current&&<small>Предыдущий выпуск</small>}</th><td>{date(revision.createdAt)}</td><td>{revision.indexValue!=null&&<b>{revision.indexValue} / 1000</b>}{revision.readinessLevel&&readiness[revision.readinessLevel]&&<small>{readiness[revision.readinessLevel]} готовность</small>}<details><summary>Версия расчёта</summary><code title={revision.snapshotId}>{short(revision.snapshotId)}</code><small>{revision.engineVersion}</small></details></td><td><a className="pc-text-button" href={href} target="_blank" rel="noreferrer">Открыть</a>{" "}<a className="pc-text-button" href={href+"&print=1"} target="_blank" rel="noreferrer">Печать / PDF</a></td></tr>;
   })}</tbody></table></div>:<p>Сохранённых выпусков пока нет.</p>}
  </Panel>
 </>;
}
