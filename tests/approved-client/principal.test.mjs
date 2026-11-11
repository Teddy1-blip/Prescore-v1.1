import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBusiness } from '../../lib/credit-engine/credit-lab/business-corpus.mjs';
import { buildCanonicalCreditAnalysis } from '../../lib/credit-engine/production/orchestrator.ts';
import { analysisV3Presentation } from '../../lib/credit-engine/client-report/analysis-v3.ts';

test('company debt KPI uses only a dated, known BKI principal of the selected debtor', () => {
  const result = buildCanonicalCreditAnalysis(loadBusiness('CL-RU-BUS-001').input);
  const asOf = '2026-03-31',
    inn = result.company.inn;
  const fact = {
    semanticCode: 'BKI_OUTSTANDING_PRINCIPAL',
    sourceType: 'BKI',
    unit: 'RUB',
    status: 'KNOWN',
    value: 0,
    companyInn: inn,
    subjectInn: inn,
    entityScope: 'COMPANY',
    affectsCompanyDebt: true,
    period: { asOf },
  };
  function project(change = {}, entitlement = 'FULL') {
    const canonical = {
      ...result,
      reconciliation: { ...result.reconciliation, findings: [{ leftFacts: [{ ...fact, ...change }] }] },
    };
    return analysisV3Presentation(canonical, { ...result.model, meta: { ...result.model.meta, entitlement } })
      ?.companyPrincipal;
  }
  assert.deepEqual(project(), { value: 0, asOf });
  assert.deepEqual(project({ value: 1234567.89 }), { value: 1234567.89, asOf });
  for (const change of [
    { entityScope: 'GUARANTOR' },
    { subjectInn: 'other' },
    { affectsCompanyDebt: false },
    { status: 'PARTIAL' },
    { value: null },
    { period: { asOf: null } },
    { semanticCode: 'BKI_TOTAL_OUTSTANDING' },
  ])
    assert.equal(project(change), undefined);
  assert.equal(project({}, 'BASIC'), undefined);
});
