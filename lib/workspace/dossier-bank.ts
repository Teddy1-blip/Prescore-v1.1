import {ledgerObservations} from './ledger-observations.ts';
import {analysisForStorage,analyzeBankStatements,type AnalysisResult} from '../prescore.ts';
import type {SourceRow} from './dossier-sources.ts';
import {activeFinancialSnapshots,financialSources} from '../credit-engine/financial-analysis/source-selection.ts';
import {buildFinancialAnalysis} from '../credit-engine/financial-analysis/engine.ts';
import {adaptUploadedBki} from '../credit-engine/credit-portfolio/bki-adapter.ts';
import {verifiedCreditDocument} from './contract-portfolio.ts';
import {buildCreditPortfolio} from '../credit-engine/credit-portfolio/resolver.ts';
import {withRefreshedIntegrity} from '../credit-engine/source-foundation.ts';
import {reconciliationForAnalysis} from '../credit-engine/reconciliation/integration.ts';
import {buildRiskShadow} from '../credit-engine/risk/integration.ts';
import {
  ACCOUNT_51_FALLBACK_WARNING,
  BANK_XLSX_ADAPTER_WARNING,
  account51ToStatementInput,
  bankXlsxToStatementInputs,
  reconcileBankWithAccount51,
} from './bank-sources-adapter.ts';

export function withDossierSources(bank:AnalysisResult, rows:SourceRow[]):AnalysisResult {
  if(!rows.length)return bank;
  if(rows.some(r=>r.payload.envelope.companyInn!==bank.companyInn))throw Error('SOURCE_COMPANY_MISMATCH');
  const hasRealBankMetrics=Boolean(bank.metricsV2 && !bank.warnings?.includes(ACCOUNT_51_FALLBACK_WARNING));
  const xlsxInputs=!hasRealBankMetrics
    ? rows.flatMap(row=>row.payload.bankXlsxReview?.sheets.some(s=>s.entries?.length)
      ? bankXlsxToStatementInputs({
          sheets:row.payload.bankXlsxReview.sheets,
          companyInn:bank.companyInn,
          companyName:bank.companyName,
          fileName:row.payload.envelope.fileName??'bank.xlsx',
          sourceId:row.id,
          contentHash:row.payload.envelope.contentHash,
        })
      : [])
    : [];
  const account51Inputs=!bank.metricsV2 && !xlsxInputs.length
    ? rows.flatMap(row=>{
        if(!row.payload.account51 || !row.payload.account51Operations?.length)return [];
        const input=account51ToStatementInput({
          card:{
            periodFrom:row.payload.account51.from,
            periodTo:row.payload.account51.to,
            openingBalance:row.payload.account51.opening,
            closingBalance:row.payload.account51.closing,
            operations:row.payload.account51Operations,
          },
          companyInn:bank.companyInn,
          companyName:bank.companyName,
          fileName:row.payload.envelope.fileName??'account51.xlsx',
          sourceId:row.id,
          contentHash:row.payload.envelope.contentHash,
        });
        return input?[input]:[];
      })
    : [];
  const account51Cards=rows.flatMap(r=>r.payload.account51?[r.payload.account51]:[]);
  const ledger=ledgerObservations(rows,bank.companyInn);
  const financial=rows.flatMap(row=>[
    ...(row.payload.snapshot?[row.payload.snapshot]:[]),
    ...(row.payload.financialHistory??[]),
    ...(row.payload.publicProfile?.financialStatementsV2??[]),
  ]);
  if(financial.some(s=>s.companyInn!==bank.companyInn||s.source.companyInn!==bank.companyInn))throw Error('SOURCE_COMPANY_MISMATCH');
  const bki=rows.flatMap(r=>r.payload.bki?.affectsCompanyDebt?[{report:r.payload.bki,source:r.payload.envelope}]:[]);
  const documents=rows.flatMap(row=>verifiedCreditDocument(row,bank.companyInn)??[]);
  if(!financial.length&&!bki.length&&!documents.length&&!ledger.length&&!xlsxInputs.length&&!account51Inputs.length&&!account51Cards.length)return bank;

  let base:AnalysisResult=bank;
  const adaptedInputs=xlsxInputs.length?xlsxInputs:account51Inputs;
  if(adaptedInputs.length){
    const isAccount51Fallback=!xlsxInputs.length;
    const warningCode=isAccount51Fallback?ACCOUNT_51_FALLBACK_WARNING:BANK_XLSX_ADAPTER_WARNING;
    const warningNote=isAccount51Fallback
      ? 'Расчёт банковских метрик выполнен по карточке счёта 51 из 1С (fallback), а не по банковской выписке.'
      : 'Банковские метрики рассчитаны по выписке СберБизнес XLSX через адаптер 1С.';
    const computed=analysisForStorage(analyzeBankStatements(adaptedInputs));
    const computedStatements=(computed.sourceManifest?.bankStatements??[]).map(s=>({
      ...s,
      warnings:[...new Set([...s.warnings,warningNote])],
    }));
    const preservedExternal=(bank.sourceManifest?.external??[]).filter(s=>!adaptedInputs.some(i=>i.sourceId===s.sourceId||s.sourceId===i.sourceId?.replace(/:sheet:\d+$/,'')));
    const warnings=[...new Set([
      ...(bank.warnings??[]).filter(w=>isAccount51Fallback||w!==ACCOUNT_51_FALLBACK_WARNING),
      ...computed.warnings,
      warningCode,
    ])];
    base={
      ...computed,
      id:bank.id,
      createdAt:bank.createdAt,
      companyName:bank.companyName&&!bank.companyName.startsWith('Компания ИНН ')?bank.companyName:computed.companyName,
      warnings,
      checkoAttempt:bank.checkoAttempt,
      legalRegistryV1:bank.legalRegistryV1,
      financingRequestV1:bank.financingRequestV1,
      financialStatementsV2:bank.financialStatementsV2,
      financialAnalysisV2:bank.financialAnalysisV2,
      creditHistory:bank.creditHistory,
      creditPortfolioV1:bank.creditPortfolioV1,
      sourceManifest:{
        ...(bank.sourceManifest??{}),
        ...(computed.sourceManifest??{}),
        bankStatements:computedStatements,
        external:preservedExternal,
      },
    };
  }

  const manifest={...base.sourceManifest,bankStatements:base.sourceManifest?.bankStatements??[]};
  const contributingIds=new Set([
    ...documents.map(doc=>doc.sourceId),
    ...ledger.flatMap(observation=>observation.evidence.map(e=>e.sourceId))
  ]);
  if(contributingIds.size){
    const receipts=new Map((manifest.external??[]).map(source=>[source.sourceId,source]));
    for(const row of rows){
      if(contributingIds.has(row.id)){
        // This receipt describes the accepted observations, not the unreviewed remainder of the file.
        receipts.set(row.id,{...row.payload.envelope,status:'READY'});
      }
    }
    manifest.external=[...receipts.values()].sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
  }
  const result:AnalysisResult={...base,sourceManifest:manifest};
  if(financial.length){
    manifest.financialUploads=[...new Map([...financialSources(manifest),...financial.map(s=>s.source)].map(s=>[s.sourceId,s])).values()];
    const replacements=new Set(financial.map(s=>s.snapshotId));
    const active=activeFinancialSnapshots([...(base.financialStatementsV2??[]).filter(s=>!replacements.has(s.snapshotId)),...financial],[manifest]);
    for(const s of active)manifest[s.sourceType==='BFO'?'bfo':'quarterly']=s.source;
    result.financialStatementsV2=active;
    result.financialAnalysisV2=buildFinancialAnalysis(active);
  }
  const asOf=[base.periodTo,base.creditPortfolioV1?.asOfDate??'',base.creditHistory?.reportDate??'',...ledger.map(o=>o.observedAt??''),...(result.financialStatementsV2??[]).map(s=>s.period.asOf??''),...bki.map(b=>b.report.reportDate),...documents.map(d=>d.observedAt)].sort().at(-1)!;
  if(bki.length||documents.length||ledger.length){
    const revisedIds=new Set(documents.map(d=>d.sourceId));
    const prior=base.creditPortfolioV1;
    const previousPortfolio=prior&&revisedIds.size?{...prior,observationHistory:prior.observationHistory.filter(o=>!o.evidence.some(e=>revisedIds.has(e.sourceId??'')))}:prior;
    if(base.creditHistory&&manifest.bki)bki.push({report:base.creditHistory,source:manifest.bki});
    bki.sort((a,b)=>a.report.reportDate.localeCompare(b.report.reportDate)||a.source.sourceId.localeCompare(b.source.sourceId));
    const latest=bki.at(-1);
    if(latest){result.creditHistory=latest.report;manifest.bki=latest.source;}
    result.creditPortfolioV1=buildCreditPortfolio({companyInn:base.companyInn,asOfDate:asOf,previousPortfolio,documents,observations:ledger,paymentObservations:base.debtPaymentObservationsV1,creditHistorySnapshots:bki.map(b=>adaptUploadedBki(b.report,{companyInn:base.companyInn,source:b.source}))});
  }
  if(account51Cards.length && result.metricsV2 && !result.warnings.includes(ACCOUNT_51_FALLBACK_WARNING)){
    const recs=account51Cards.map(card=>reconcileBankWithAccount51(result.metricsV2,card));
    result.account51Reconciliation=recs;
    const recWarnings=recs.flatMap(r=>r.warnings);
    if(recWarnings.length)result.warnings=[...new Set([...result.warnings,...recWarnings])];
  }
  Object.assign(result,reconciliationForAnalysis(result));
  Object.assign(result,buildRiskShadow({analysis:result,asOfDate:asOf}));
  return withRefreshedIntegrity(result);
}
