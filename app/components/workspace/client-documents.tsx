"use client";
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

export function DocumentSources({model}:{model:WorkspaceModelV1}){
 const observations=model.full?.report.analysisV3?.observations??[];
 return <Panel title="Источники кредитного досье">
  <p className="pc-muted">Статус обработки и дата получения относятся к источнику. Они не подтверждают актуальность всех его сведений сегодня.</p>
  <div className="pc-table-scroll" tabIndex={0} aria-label="Источники анализа"><table className="pc-source-table"><thead><tr><th>Источник и состояние</th><th>Период / дата отчёта / получен</th><th>Что добавляет и следующий шаг</th></tr></thead><tbody>{sources.map(s=>{
   const availability=model.basic.sources.availability.filter(v=>v.source===s.key),seen=observations.filter(o=>s.types.some(t=>t===o.type));
   return <tr key={s.key}><th>{sourceLabel(s.key)}<small>{availability.length?[...new Set(availability.map(v=>sourceState(v.status)))].join(', '):'Не добавлен'}</small></th><td>{availability.length?availability.map((v,i)=><p key={i}>{s.key==='CREDIT_HISTORY'?(v.reportDate?'Дата отчёта: '+date(v.reportDate):'Дата отчёта не подтверждена'):date(v.periodFrom)+' — '+date(v.periodTo)}</p>):'Период не указан'}<small>{seen.length?'Получен: '+[...new Set(seen.map(v=>date(v.receivedAt)))].join(', '):'Дата получения не опубликована'}</small></td><td>{s.benefit}<small>{model.access.readOnly?'Запросите сведения у владельца компании. Источник для анализа не является автоматически требованием банка.':s.action}</small></td></tr>;
  })}</tbody></table></div>
  <p className="pc-muted">Счётчики файлов ниже относятся к дополнительным файлам досье, а не к обработанным выпискам, БФО и БКИ. Их состояния показаны в таблице источников выше.</p>
  <dl className="pc-definition"><div><dt>Сведения компании</dt><dd>{model.basic.analysis.company.name} · ИНН {model.basic.analysis.company.inn}</dd></div><div><dt>Файлы компании</dt><dd>{model.basic.operations.documents.count??'Недостаточно данных'}</dd></div><div><dt>Файлы выбранного анализа</dt><dd>{model.basic.operations.documents.analysisCount??'Недостаточно данных'}</dd></div></dl>
  {model.basic.financingRequest&&<p className="pc-muted">Заявленные параметры финансирования сохранены {date(model.basic.financingRequest.receivedAt)}. Они используются как сведения клиента, без независимого документального подтверждения.</p>}
  <p>Бухгалтерская отчётность, кредитная история и квартальные данные дополняют общую финансовую картину через формы ниже. Произвольные файлы сохраняются в досье и не меняют оценку автоматически.</p>
 </Panel>;
}
