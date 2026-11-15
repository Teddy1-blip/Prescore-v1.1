import {paymentFacts,settlementState,type LoggedSettlementEvent,type PaymentFact,type SettlementEvent} from './settlement-events.ts';
import {settlementPositions} from './settlement-positions.ts';
import {readBureau} from './bureau-review.ts';
import {ledgerObservations} from './ledger-observations.ts';
import {dossierDecisions} from './dossier-decisions.ts';
import {verifiedCreditDocument} from './contract-portfolio.ts';
import type {SourceEnvelope} from '../credit-engine/contracts/sources.ts';
import type {CreditHistoryReport} from '../credit-history.ts';
import type {FinancialStatementSnapshot} from '../credit-engine/contracts/financial-statements.ts';
import type {AnalysisResult} from '../prescore.ts';
import type {QueryExecutor} from '../db/compatibility.ts';
import type {LedgerBalance} from './ledger-import.ts';
import {buildFinancialAnalysis} from '../credit-engine/financial-analysis/engine.ts';
import {activeFinancialSnapshots} from '../credit-engine/financial-analysis/source-selection.ts';
import {publicFinancialAnalysis} from '../credit-engine/client-report/source-detail.ts';
import {buildCreditPortfolio} from '../credit-engine/credit-portfolio/resolver.ts';
import {adaptUploadedBki} from '../credit-engine/credit-portfolio/bki-adapter.ts';

export type Account51Summary={from:string;to:string;opening:number|null;closing:number|null;inflow:number;outflow:number;entries:number;requiresReview:boolean};
export type CounterpartyCheck={inn:string;fetchedAt:string;cases:number|null;enforcements:number|null};
export type PrivateSource={counterpartyCheck?:CounterpartyCheck;manualDebt?:import('./manual-debt.ts').ManualDebt;calendarSheet?:string[][];sheetEntries?:Record<string,import('./calendar-entry.ts').CalendarEntry>;settlementEvent?:SettlementEvent;bankPayments?:PaymentFact[];bankXlsxReview?:{version:string;totalOperations:number;accounts:number;warnings:string[];sheets:{name:string;account:string|null;periodFrom:string|null;periodTo:string|null;operations:number;inMinor:number;outMinor:number}[]};questionnaireReview?:{version:string;sheets:{name:string;fields:import('../document-poc/bank-questionnaire.ts').QuestionnaireField[];issues:string[]}[]};account51?:Account51Summary;relationship?:import("../credit-history.ts").CreditSubjectRelationship;ocr?:import("./dossier-ocr.ts").OcrProgress;publicProfile?:import("../company-profile.ts").CompanyProfileData;envelope:SourceEnvelope; snapshot?:FinancialStatementSnapshot; bki?:CreditHistoryReport; ledger?:LedgerBalance[]; calendar?:import("./calendar-entry.ts").CalendarEntry; review?:import("../document-poc/review-fields.ts").DocumentReview; verified?:Record<string,{value:string;page:number;fragment:string}>};
export type SourceRow={id:string;kind:string;documentId:string|null;payload:PrivateSource};
export async function dossierSources(db:QueryExecutor,owner:string,id:string){
  const result=await db.query(`SELECT s.source_id AS id,s.source_type AS kind,s.document_id AS "documentId",s.payload
    FROM dossier_sources s JOIN company_dossiers d ON d.id=s.dossier_id WHERE d.owner_email=$1 AND d.id=$2 ORDER BY s.received_at,s.source_id`,[owner,id]);
  const indexed=new Map((result.rows as SourceRow[]).map(row=>[row.id,row]));
  const versions=await db.query(`SELECT a.payload FROM analyses a JOIN company_dossiers d ON d.owner_email=a.owner_email AND d.company_inn=a.company_inn
    WHERE d.id=$1 AND d.owner_email=$2 AND a.archive_state='ACTIVE' ORDER BY a.created_at,a.id`,[id,owner]);
  function add(source:PrivateSource,kind:string){
    const key=source.envelope.sourceId;
    if(!indexed.has(key))indexed.set(key,{id:key,kind,documentId:null,payload:source});
  }
  for(const version of versions.rows){
    const analysis=JSON.parse(String(version.payload)) as AnalysisResult;
    const bySource=new Map<string,typeof analysis.transactions>();
    for(const t of analysis.transactions??[]){if(t.sourceId){const list=bySource.get(t.sourceId)??[];list.push(t);bySource.set(t.sourceId,list);}}
    for(const source of analysis.sourceManifest?.bankStatements??[]){
      add({envelope:source},'BANK_STATEMENT');
      const stored=indexed.get(source.sourceId)!;
      stored.payload={...stored.payload,bankPayments:[...(stored.payload.bankPayments??[]),...paymentFacts(bySource.get(source.sourceId)??[])]};
    }
    for(const snapshot of analysis.financialStatementsV2??[])add({envelope:snapshot.source,snapshot},snapshot.sourceType);
    if(analysis.creditHistory && analysis.sourceManifest?.bki)add({envelope:analysis.sourceManifest.bki,bki:analysis.creditHistory},'BKI');
  }
  return [...indexed.values()];
}
export function sourceProjection(rows:SourceRow[],inn:string,includeFull=true){
  const publicProfile=rows.flatMap(r=>r.payload.publicProfile??[]).at(-1);
  const supplied=publicProfile?.financialStatementsV2??[];
  const snapshots=[...supplied,...rows.flatMap(r=>r.payload.snapshot?[r.payload.snapshot]:[])];
  const manifest={financialUploads:rows.filter(r=>r.payload.snapshot).map(r=>r.payload.envelope)};
  const selected=activeFinancialSnapshots(snapshots,[publicProfile?.sourceManifest,manifest]);
  const financialAnalysis=selected.length?buildFinancialAnalysis(selected):undefined;
  const financial=publicFinancialAnalysis({financialAnalysis});
  const bki=rows.flatMap(r=>r.payload.bki?.affectsCompanyDebt?[adaptUploadedBki(r.payload.bki,{companyInn:inn,source:r.payload.envelope})]:[]);
  const documents=rows.flatMap(row=>verifiedCreditDocument(row,inn)??[]);
  const ledger=ledgerObservations(rows,inn);
  const relevant=rows.filter(r=>r.payload.snapshot||r.payload.bki?.affectsCompanyDebt||r.payload.publicProfile||r.kind==='DEBT_LEDGER'||r.payload.manualDebt||verifiedCreditDocument(r,inn));
  const asOf=[...ledger.map(o=>o.observedAt??''),...documents.map(d=>d.observedAt),...rows.flatMap(r=>r.payload.bki?.affectsCompanyDebt&&r.payload.bki.reportDate?[r.payload.bki.reportDate]:[])].sort().at(-1);
  const portfolio=(bki.length||documents.length||ledger.length)&&asOf?buildCreditPortfolio({companyInn:inn,asOfDate:asOf,creditHistorySnapshots:bki,documents,observations:ledger}):null;
  const informationDate=[...relevant.map(r=>r.payload.envelope.receivedAt.slice(0,10)),...(asOf?[asOf]:[])].sort().at(-1);
  const decisionPortfolio=includeFull&&informationDate?buildCreditPortfolio({companyInn:inn,asOfDate:informationDate,creditHistorySnapshots:bki,documents,observations:ledger}):null;
  const history:LoggedSettlementEvent[]=rows.flatMap(r=>r.payload.settlementEvent?[{...r.payload.settlementEvent,id:r.id,recordedAt:r.payload.envelope.receivedAt}]:[]);
  const bankPayments=new Map<string,PaymentFact|null>();
  for(const p of rows.flatMap(r=>r.payload.bankPayments??[])){
    const prior=bankPayments.get(p.id);
    if(prior===undefined)bankPayments.set(p.id,p);
    else if(prior&&(prior.amount!==p.amount||prior.inn!==p.inn||prior.date!==p.date||prior.direction!==p.direction))bankPayments.set(p.id,null);
  }
  const payments=[...bankPayments.values()].filter((p):p is PaymentFact=>p!==null);
  return {
    settlements:settlementPositions(rows).map(p=>settlementState(p,history,payments)),
    cards51:rows.flatMap(r=>r.payload.account51?[{...r.payload.account51,id:r.id,name:r.payload.envelope.fileName??"Карточка 51"}]:[]),
    bankXlsxReviews:rows.flatMap(r=>r.payload.bankXlsxReview?[{id:r.id,name:r.payload.envelope.fileName??'Банковская XLSX',...r.payload.bankXlsxReview}]:[]),
    questionnaireReviews:rows.flatMap(r=>r.payload.questionnaireReview?[{id:r.id,name:r.payload.envelope.fileName??'Банковская анкета',...r.payload.questionnaireReview}]:[]),
    sources:rows.filter(r=>!r.payload.settlementEvent&&(includeFull||!r.payload.counterpartyCheck)).map(r=>({id:r.id,kind:r.kind,documentId:r.documentId,name:r.payload.envelope.fileName??r.payload.envelope.sourceName??r.kind,received:r.payload.envelope.receivedAt})),
    bureauReports:rows.flatMap(r=>r.payload.bki?[{id:r.id,source:r.payload.bki.source,date:r.payload.bki.reportDate,companyDebt:r.payload.bki.affectsCompanyDebt,
      obligations:r.payload.bki.obligations.map(o=>({creditor:o.creditor,product:o.product,status:o.status,principal:o.outstandingPrincipal,total:o.totalOutstanding,overdue:o.overdueAmount,reference:o.sourcePageHint}))}]:[]),
    reviews:rows.flatMap(r=>r.payload.review?[{id:r.id,name:r.payload.envelope.fileName,documentId:r.documentId,...r.payload.review,
      bureauPreview:r.payload.review.status==='BUREAU_CONFIRM'&&r.payload.ocr?readBureau(r.payload.ocr.pages.map(p=>p.text).join('\n\f\n'),r.payload.envelope.fileName??'',inn,r.payload.relationship??'Компания-заёмщик').obligations.map(o=>({creditor:o.creditor,contract:o.accountNumber,total:o.totalOutstanding,principal:o.outstandingPrincipal,reference:o.sourcePageHint})):undefined,
      bureauPages:r.kind==='BKI'&&r.payload.ocr&&!r.payload.bki?r.payload.ocr.pages.map(p=>({page:p.page,text:p.text})):undefined,ocr:r.payload.ocr?{through:r.payload.ocr.through,total:r.payload.ocr.total,layout:r.payload.ocr.layout,version:r.payload.ocr.version}:null,verified:r.payload.verified??{}}]:[]),
    counterpartyChecks:includeFull?rows.flatMap(r=>r.payload.counterpartyCheck?[r.payload.counterpartyCheck]:[]).sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt)):[],
    sheets:includeFull?rows.flatMap(r=>r.payload.calendarSheet?[{id:r.id,name:r.payload.envelope.fileName??'График',rows:r.payload.calendarSheet,confirmed:Object.keys(r.payload.sheetEntries??{}).map(Number)}]:[]):[],
    calendar:rows.flatMap(r=>r.payload.calendar?[r.payload.calendar]:Object.values(r.payload.sheetEntries??{})).sort((a,b)=>a.date.localeCompare(b.date)),
    financial,claims:informationDate&&decisionPortfolio?dossierDecisions(relevant,inn,financialAnalysis,decisionPortfolio,informationDate):[],
    schedule:portfolio?.obligations.flatMap(o=>o.schedule.filter(e=>e.dueDate).map(e=>({id:e.scheduledEventId,obligationId:o.obligationId,exposure:o.exposureClass,status:e.status,date:e.dueDate!,type:e.type,amount:e.amount.value,creditor:o.identity.creditorName.value,contract:o.identity.contractNumber.value,sourceIds:o.sourceIds})))??[],
    lines:selected.map(s=>({id:s.snapshotId,sourceId:s.sourceId,rows:[...Object.values(s.balance),...Object.values(s.income)].filter(v=>v.rawCode&&v.rawValue!=null).map(v=>({code:v.rawCode!,raw:v.rawValue!,scale:s.confirmedScale}))})),
    portfolioAsOf:asOf??null,
    obligations:portfolio?.obligations.map(o=>({id:o.obligationId,creditor:o.identity.creditorName.value,contract:o.identity.contractNumber.value,type:o.type,exposure:o.exposureClass,principalDate:o.currentPosition.principalOutstanding.observedAt,overdue:o.currentPosition.overdueAmount.value,overdueDate:o.currentPosition.overdueAmount.observedAt,nextDate:o.currentPosition.nextPaymentDate.value,nextAmount:o.currentPosition.nextPaymentAmount.value,scheduledAmount:o.currentTerms.scheduledPaymentAmount.value,frequency:o.currentTerms.scheduledPaymentFrequency.value,requiresReview:o.warnings.length>0,principal:o.currentPosition.principalOutstanding.value,original:o.currentTerms.originalAmount.value,limit:o.currentTerms.creditLimit.value,rate:o.currentTerms.annualRate.value,maturity:o.currentTerms.maturityDate.value,sourceIds:o.sourceIds}))??[],
    ledger:rows.flatMap(r=>(r.payload.ledger??[]).map(line=>({...line,kind:r.kind,sourceId:r.id})))
  };
}
