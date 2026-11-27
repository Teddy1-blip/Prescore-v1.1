import assert from 'node:assert/strict';
import test from 'node:test';
import {analysisForStorage,analyzeBankStatements} from '../lib/prescore.ts';
import {withDossierSources} from '../lib/workspace/dossier-bank.ts';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {statementFixture} from './fixtures/block1-statements.mjs';

import {restorePortfolioReceipts} from '../lib/workspace/portfolio-receipts.ts';

test('an earlier ledger upload preserves later balances and their sources through the client decision',async()=>{
  const inn='5032333146';
  const bank=analysisForStorage(analyzeBankStatements([{fileName:'synthetic.txt',text:statementFixture({inn})}]));
  for(const source of bank.sourceManifest.bankStatements)source.receivedAt='2026-08-01T12:00:00Z';
  function ledger(id,date,principal){
    return {id,kind:'DEBT_LEDGER',documentId:id,payload:{
      envelope:{sourceId:id,sourceType:'OTHER',companyInn:inn,receivedAt:'2026-11-01T09:00:00Z',status:'READY',warnings:[],confidence:null},
      ledger:[{row:2,account:'66.01',asOf:date,party:'Учебный банк',contract:'T-1',component:'Основной долг',credit:principal,debit:null}]
    }};
  }
  const latest=ledger('debt_ledger:latest','2026-10-31',70000);
  const earlier=ledger('debt_ledger:earlier','2026-09-30',90000);
  const combined=withDossierSources(bank,[earlier,latest]);
  const incremental=withDossierSources(withDossierSources(bank,[latest]),[earlier]);
  for(const input of [combined,incremental,withDossierSources(incremental,[earlier])]){
    const portfolio=input.creditPortfolioV1;
    assert.equal(portfolio.asOfDate,'2026-10-31');
    assert.equal(portfolio.obligations[0].currentPosition.principalOutstanding.value,70000);
    const canonical=buildCanonicalCreditAnalysis({analysis:input});
    assert.equal(canonical.asOfDate,'2026-11-01');
    assert.equal(canonical.creditPortfolio.obligations.length,1);
    assert.equal(canonical.creditPortfolio.obligations[0].positionHistory.find(p=>p.asOf==='2026-10-31').position.principalOutstanding.value,70000);
    assert.deepEqual(canonical.sourceObservations.filter(s=>s.sourceType==='OTHER').map(s=>s.sourceId).sort(),[earlier.id,latest.id]);
  }
  const old=structuredClone(incremental);
  delete old.sourceManifest.external;
  const restored=await restorePortfolioReceipts(old,'owner',async(owner,company,ids)=>{
    assert.equal(owner,'owner');assert.equal(company,inn);assert.deepEqual(ids.sort(),[earlier.id,latest.id]);
    return [earlier.payload.envelope,latest.payload.envelope,{...latest.payload.envelope,sourceId:'unrelated'}];
  });
  assert.equal(old.sourceManifest.external,undefined);
  assert.equal(restored.sourceManifest.external.length,2);
  const legacy=buildCanonicalCreditAnalysis({analysis:restored});
  assert.equal(legacy.asOfDate,'2026-11-01');
  assert.equal(legacy.creditPortfolio.obligations[0].positionHistory.find(p=>p.asOf==='2026-10-31').position.principalOutstanding.value,70000);
});
