'use client';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {ExecutiveOverview} from './client-insights';
import {FullCreditAnalysis,DebtPortfolio,FinancingProducts} from './client-analysis';
import {FinancialStatements} from './client-financials';
import {BankingLedger} from './banking-ledger';
import {DocumentSources} from './client-documents';
export const DOSSIER_VIEWS=[['home','Обзор'],['analysis','Анализ Prescore'],['banking','Финансы'],['obligations','Обязательства'],['financing','Финансирование'],['documents','Источники']] as const;
export function CanonicalDossier({model,view,choose,retry}:{model:WorkspaceModelV1;view:string;choose:(v:string)=>void;retry:()=>void}){
 return <><section className="pc-panel"><h2>{model.basic.analysis.company.name}</h2><p>ИНН {model.basic.analysis.company.inn} · Только чтение</p><p>Период {model.basic.analysis.period.from} — {model.basic.analysis.period.to} · Доступ к полному анализу определяется подпиской владельца</p></section><nav className="pc-tabs" aria-label="Разделы досье">{DOSSIER_VIEWS.map(([id,title])=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>choose(id)}>{title}</button>)}</nav>
 {view==='home'&&<ExecutiveOverview model={model} choose={choose} retry={retry}/>}
 {view==='analysis'&&<FullCreditAnalysis model={model} retry={retry}/>}
 {view==='banking'&&<><BankingLedger model={model}/><FinancialStatements model={model}/></>}
 {view==='obligations'&&<DebtPortfolio model={model}/>}
 {view==='financing'&&<FinancingProducts model={model}/>}
 {view==='documents'&&<DocumentSources model={model}/>}
 </>;
}
