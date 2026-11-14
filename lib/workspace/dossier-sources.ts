import {verifiedCreditDocument} from './contract-portfolio.ts';
import {financialFacts} from '../credit-engine/risk/adapters/financial.ts';
import {financialRules} from '../credit-engine/risk/rules/financial.ts';
import {evaluateRiskFacts} from '../credit-engine/risk/engine.ts';
import {EXPLANATION_TEMPLATE_REGISTRY} from '../credit-engine/explainability/templates.ts';
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

export type PrivateSource={publicProfile?:import("../company-profile.ts").CompanyProfileData;envelope:SourceEnvelope; snapshot?:FinancialStatementSnapshot; bki?:CreditHistoryReport; ledger?:LedgerBalance[]; calendar?:import("./calendar-entry.ts").CalendarEntry; review?:import("../document-poc/review-fields.ts").DocumentReview; verified?:Record<string,{value:string;page:number;fragment:string}>};
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
    for(const source of analysis.sourceManifest?.bankStatements??[])add({envelope:source},'BANK_STATEMENT');
    for(const snapshot of analysis.financialStatementsV2??[])add({envelope:snapshot.source,snapshot},snapshot.sourceType);
    if(analysis.creditHistory && analysis.sourceManifest?.bki)add({envelope:analysis.sourceManifest.bki,bki:analysis.creditHistory},'BKI');
  }
  return [...indexed.values()];
}
export function sourceProjection(rows:SourceRow[],inn:string){
  const snapshots=rows.flatMap(r=>r.payload.snapshot?[r.payload.snapshot]:[]);
  const manifest={financialUploads:rows.filter(r=>r.payload.snapshot).map(r=>r.payload.envelope)};
  const selected=activeFinancialSnapshots(snapshots,[manifest]);
  const financialAnalysis=selected.length?buildFinancialAnalysis(selected):undefined;
  const financial=publicFinancialAnalysis({financialAnalysis});
  const date=selected.map(s=>s.period.asOf??'').sort().at(-1);
  const risk=date&&financialAnalysis?evaluateRiskFacts({companyInn:inn,asOfDate:date,facts:financialFacts({analysis:{companyInn:inn,financialAnalysisV2:financialAnalysis},asOfDate:date})},financialRules):null;
  const findings=(risk?.findings??[]).flatMap(f=>{
    const template=EXPLANATION_TEMPLATE_REGISTRY.templates.find(t=>t.code===f.code);
    if(!template||!f.evidence.some(e=>e.sourceId))return [];
    return [{id:f.findingId,rule:f.code,title:template.shortTitleRu,why:template.whyItMattersRu,scope:f.scope,value:f.actualValue,unit:f.unit,sourceIds:[...new Set(f.evidence.flatMap(e=>e.sourceId?[e.sourceId]:[]))],asOf:date}];
  });
  const bki=rows.flatMap(r=>r.payload.bki?[adaptUploadedBki(r.payload.bki,{companyInn:inn,source:r.payload.envelope})]:[]);
  const documents=rows.flatMap(row=>verifiedCreditDocument(row,inn)??[]);
  const asOf=[...documents.map(d=>d.observedAt),...rows.flatMap(r=>r.payload.bki?.reportDate?[r.payload.bki.reportDate]:[])].sort().at(-1);
  const portfolio=(bki.length||documents.length)&&asOf?buildCreditPortfolio({companyInn:inn,asOfDate:asOf,creditHistorySnapshots:bki,documents}):null;
  return {
    sources:rows.map(r=>({id:r.id,kind:r.kind,documentId:r.documentId,name:r.payload.envelope.fileName??r.payload.envelope.sourceName??r.kind,received:r.payload.envelope.receivedAt})),
    reviews:rows.flatMap(r=>r.payload.review?[{id:r.id,name:r.payload.envelope.fileName,documentId:r.documentId,...r.payload.review,verified:r.payload.verified??{}}]:[]),
    calendar:rows.flatMap(r=>r.payload.calendar?[r.payload.calendar]:[]).sort((a,b)=>a.date.localeCompare(b.date)),
    financial,findings,
    obligations:portfolio?.obligations.map(o=>({id:o.obligationId,creditor:o.identity.creditorName.value,contract:o.identity.contractNumber.value,principal:o.currentPosition.principalOutstanding.value,original:o.currentTerms.originalAmount.value,limit:o.currentTerms.creditLimit.value,rate:o.currentTerms.annualRate.value,maturity:o.currentTerms.maturityDate.value,sourceIds:o.sourceIds}))??[],
    ledger:rows.flatMap(r=>(r.payload.ledger??[]).map(line=>({...line,kind:r.kind,sourceId:r.id})))
  };
}
