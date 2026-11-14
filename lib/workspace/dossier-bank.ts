import type {AnalysisResult} from '../prescore.ts';
import type {SourceRow} from './dossier-sources.ts';
import {activeFinancialSnapshots,financialSources} from '../credit-engine/financial-analysis/source-selection.ts';
import {buildFinancialAnalysis} from '../credit-engine/financial-analysis/engine.ts';
import {adaptUploadedBki} from '../credit-engine/credit-portfolio/bki-adapter.ts';
import {verifiedCreditDocument} from './contract-portfolio.ts';
import {buildCreditPortfolio} from '../credit-engine/credit-portfolio/resolver.ts';
import {withRefreshedIntegrity} from '../credit-engine/source-foundation.ts';
import {reconciliationForAnalysis} from '../credit-engine/reconciliation/integration.ts';
import {buildRiskShadow} from '../credit-engine/risk/integration.ts';

export function withDossierSources(bank:AnalysisResult, rows:SourceRow[]):AnalysisResult {
  if(!rows.length)return bank;
  if(rows.some(r=>r.payload.envelope.companyInn!==bank.companyInn))throw Error('SOURCE_COMPANY_MISMATCH');
  const manifest={...bank.sourceManifest,bankStatements:bank.sourceManifest?.bankStatements??[]};
  const financial=rows.flatMap(r=>r.payload.snapshot?[r.payload.snapshot]:[]);
  const bki=rows.flatMap(r=>r.payload.bki?[{report:r.payload.bki,source:r.payload.envelope}]:[]);
  const documents=rows.flatMap(row=>verifiedCreditDocument(row,bank.companyInn)??[]);
  if(!financial.length&&!bki.length&&!documents.length)return bank;
  const result={...bank,sourceManifest:manifest};
  if(financial.length){
    manifest.financialUploads=[...new Map([...financialSources(manifest),...financial.map(s=>s.source)].map(s=>[s.sourceId,s])).values()];
    const active=activeFinancialSnapshots([...(bank.financialStatementsV2??[]),...financial],[manifest]);
    for(const s of active)manifest[s.sourceType==='BFO'?'bfo':'quarterly']=s.source;
    result.financialStatementsV2=active;
    result.financialAnalysisV2=buildFinancialAnalysis(active);
  }
  const asOf=[bank.periodTo,...(result.financialStatementsV2??[]).map(s=>s.period.asOf??''),...bki.map(b=>b.report.reportDate),...documents.map(d=>d.observedAt)].sort().at(-1)!;
  if(bki.length||documents.length){
    if(bank.creditHistory&&manifest.bki)bki.push({report:bank.creditHistory,source:manifest.bki});
    bki.sort((a,b)=>a.report.reportDate.localeCompare(b.report.reportDate)||a.source.sourceId.localeCompare(b.source.sourceId));
    const latest=bki.at(-1);
    if(latest){result.creditHistory=latest.report;manifest.bki=latest.source;}
    result.creditPortfolioV1=buildCreditPortfolio({companyInn:bank.companyInn,asOfDate:asOf,previousPortfolio:bank.creditPortfolioV1,documents,paymentObservations:bank.debtPaymentObservationsV1,creditHistorySnapshots:bki.map(b=>adaptUploadedBki(b.report,{companyInn:bank.companyInn,source:b.source}))});
  }
  Object.assign(result,reconciliationForAnalysis(result));
  Object.assign(result,buildRiskShadow({analysis:result,asOfDate:asOf}));
  return withRefreshedIntegrity(result);
}
