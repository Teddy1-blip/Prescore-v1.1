"use client";
import {ExternalSourceCards} from './external-sources';
import {LegalRegistrySource} from "./legal-registry-source";
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {date} from './presentation';
import {sourceLabel,sourceState} from './credit-depth';
import {Panel} from './client-insights';

const sources=[
 {key:'BANK_STATEMENTS',types:['BANK_STATEMENT'],benefit:'Денежный поток, налоги, долговые платежи и ликвидность.',action:'Создайте новый анализ с выписками по всем счетам за сопоставимый период.'},
 {key:'FINANCIAL_STATEMENTS',types:['BFO','FINANCIAL_STATEMENT'],benefit:'Выручка, прибыль, активы, капитал и финансовые коэффициенты.',action:'Добавьте бухгалтерскую отчётность через форму ниже.'},
 {key:'QUARTERLY_REPORT',types:['QUARTERLY'],benefit:'Финансовое состояние после последней годовой отчётности.',action:'Добавьте квартальную отчётность через форму ниже.'},
 {key:'CREDIT_HISTORY',types:['BKI','CREDIT_HISTORY'],benefit:'Обязательства, просрочка и сопоставление долга с платежами по выпискам.',action:'Добавьте кредитную историю через форму ниже.'},
 {key:'EXTERNAL_SOURCE',types:['CHECKO','EIS','LEGAL_SOURCE'],benefit:'Регистрационные сведения, правовые ограничения и контракты, когда доступны.',action:'Получите открытые сведения компании; проверьте дату каждого источника.'}
] as const;

export function DocumentSources({model,saved,externalEnabled=true,readOnly=false}:{readOnly?:boolean;externalEnabled?:boolean;model:WorkspaceModelV1;saved?:()=>Promise<void>}){
 const observations=model.full?.report.analysisV3?.observations??[];
 const entries=sources.map(source=>({...source,rows:model.basic.sources.availability.filter(row=>row.source===source.key),
  observed:observations.filter(o=>source.types.some(t=>t===o.type))}));
 const connected=entries.filter(s=>s.rows.some(r=>['READY','PARTIAL','STALE'].includes(r.status)));
 const targets:Record<string,string>={FINANCIAL_STATEMENTS:'source-bfo',QUARTERLY_REPORT:'source-quarterly',CREDIT_HISTORY:'source-bki'};
 return <><Panel title="Источники кредитного досье">
  <h3>Подключённые источники</h3>
  {connected.map(s=><section className="pc-source-entry" key={s.key}><header><h4>{sourceLabel(s.key)}</h4><small>{[...new Set(s.rows.map(r=>sourceState(r.status)))].join(' · ')}</small></header>
   <p>{s.benefit}</p>{s.rows.map((r,i)=><small key={i}>{[s.key==='CREDIT_HISTORY'?(r.reportDate?'Дата отчёта: '+date(r.reportDate):'Дата отчёта не подтверждена'):null,r.periodFrom&&r.periodTo&&date(r.periodFrom)+' — '+date(r.periodTo)].filter(Boolean).join(' · ')}</small>)}
   {s.observed.some(o=>o.receivedAt)&&<small>{'Получен: '+[...new Set(s.observed.filter(o=>o.receivedAt).map(o=>date(o.receivedAt)))].join(', ')}</small>}
  </section>)}
  {!connected.length&&<p>Начните с банковской выписки, чтобы увидеть движение денег.</p>}
 </Panel>
 {!readOnly&&model.access.role!=='ASSIGNED_BROKER'&&entries.some(s=>targets[s.key]&&!connected.includes(s))&&<Panel title="Что можно добавить"><div className="pc-source-choices">
  {entries.filter(s=>targets[s.key]&&!connected.includes(s)).map(s=><a key={s.key} href={'#'+targets[s.key]}><strong>{sourceLabel(s.key)}</strong><span>{s.benefit}</span><b>К загрузке →</b></a>)}</div></Panel>}
 <Panel title="Файлы досье"><p>Счётчики относятся к дополнительным файлам досье. Обработанные выписки, БФО и БКИ перечислены в источниках.</p>
  <dl className="pc-definition">{model.basic.operations.documents.count!=null&&<div><dt>Файлы компании</dt><dd>{model.basic.operations.documents.count}</dd></div>}
   {model.basic.operations.documents.analysisCount!=null&&<div><dt>В этом анализе</dt><dd>{model.basic.operations.documents.analysisCount}</dd></div>}</dl>
  {model.basic.financingRequest&&<p className="pc-muted">Запрос на финансирование сохранён {date(model.basic.financingRequest.receivedAt)}.</p>}
 </Panel>{externalEnabled&&<ExternalSourceCards key={model.analysisId+model.entitlement} model={model} saved={saved} readOnly={readOnly}/>}<LegalRegistrySource key={model.basic.analysis.id} model={model} saved={saved}/></>;
}
