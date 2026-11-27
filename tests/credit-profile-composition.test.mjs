import test from 'node:test';
import assert from 'node:assert/strict';
import { composeCreditProfile } from '../lib/credit-engine/compose-profile.ts';
import { analyzeBankStatement } from '../lib/prescore.ts';
import { buildCreditPortfolio } from '../lib/credit-engine/credit-portfolio/resolver.ts';
import { block2StatementFixture } from './fixtures/block2-statements.mjs';
import { bki, finances, profile } from './fixtures/credit-lab/builders.mjs';

function realisticInputs() {
  const analysis = analyzeBankStatement(block2StatementFixture());
  const companyProfile = profile();
  companyProfile.inn = analysis.companyInn;
  companyProfile.fetchedAt = analysis.metricsV2.period.to;
  companyProfile.financialAnalysisV2 = finances();
  analysis.creditHistory = bki({ subjectInn: analysis.companyInn });
  analysis.creditPortfolioV1 = buildCreditPortfolio({
    companyInn: analysis.companyInn,
    asOfDate: analysis.metricsV2.period.to,
    creditHistorySnapshots: [],
    paymentObservations: [],
  });
  return { analysis, companyProfile };
}

test('bank-statement metrics use declared statement coverage and compose all shadow engines', () => {
  const { analysis, companyProfile } = realisticInputs();
  const originalScore = analysis.score;
  const originalTransactions = structuredClone(analysis.transactions);

  assert.deepEqual(
    [analysis.metricsV2.period.from, analysis.metricsV2.period.to],
    [analysis.sourceManifest.bankStatements[0].periodFrom, analysis.sourceManifest.bankStatements[0].periodTo],
  );
  const result = composeCreditProfile(analysis, companyProfile);

  assert.equal(result.mode, 'SHADOW');
  assert.equal(result.status, 'COMPLETE');
  for (const key of [
    'riskAssessmentV1', 'contextAssessmentV1', 'prescoreIndexV1', 'financingReadinessV1',
    'creditAssessmentV1', 'debtCapacityV1', 'productSelectionV1', 'recommendationSetV1',
    'actionPlanV1', 'explainabilityV1',
  ]) assert.ok(result[key], `${key} should be connected`);
  assert.equal(analysis.score, originalScore);
  assert.deepEqual(analysis.transactions, originalTransactions);
});

test('missing bank metrics leave capacity downstream unavailable with an explicit warning', () => {
  const { analysis, companyProfile } = realisticInputs();
  delete analysis.metricsV2;

  const result = composeCreditProfile(analysis, companyProfile);

  assert.equal(result.mode, 'SHADOW');
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.debtCapacityV1, undefined);
  assert.ok(result.warnings.includes('DEBT_CAPACITY_BANK_METRICS_UNAVAILABLE'));
  assert.equal(result.productSelectionV1, undefined);
});
