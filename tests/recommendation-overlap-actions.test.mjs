import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './fixtures/action-plan/builders.mjs';
import { buildActionPlan } from '../lib/credit-engine/action-plan/engine.ts';
import { matchRecommendationTriggers } from '../lib/credit-engine/recommendations/triggers.ts';
import { RECOMMENDATION_REGISTRY } from '../lib/credit-engine/recommendations/registry.ts';

const receiptsRule = 'RISK-CF-OPERATING-RECEIPTS-DECLINE';
const annualRule = 'RISK-FIN-REVENUE-DECLINE';
const cashActions = ['EXPLAIN_OPERATING_RECEIPTS', 'RECONCILE_RECEIPTS_WITH_REVENUE',
  'DOCUMENT_CUSTOMER_PAYMENT_DELAYS', 'VERIFY_RECEIPTS_PERIOD_COVERAGE'];
const overlap = {FIN_ANNUAL_REVENUE_CHANGE: -30, BANK_OPERATING_TREND: -40, BANK_COVERAGE_ADEQUATE: true};

test('overlapping declines keep one score and four traceable bank actions in the plan', () => {
  const x = scenario({values: overlap});
  const scored = x.prescoreIndex.contributions.filter(c => [annualRule, receiptsRule].includes(c.riskCode));
  assert.deepEqual(scored.map(c => c.riskCode), [annualRule]);
  const evaluation = x.riskAssessment.evaluations.find(e => e.ruleCode === receiptsRule);
  assert.equal(evaluation.suppressedBy, scored[0].riskFindingId);
  const plan = buildActionPlan(x);
  for (const code of cashActions) {
    const actions = x.recommendationSet.recommendations.filter(r => r.definitionCode === code);
    assert.equal(actions.length, 1);
    const [action] = actions;
    assert.deepEqual(action.riskFindingIds, [scored[0].riskFindingId]);
    assert.deepEqual(action.currentState, [{sourceCode: receiptsRule, value: -40}]);
    const facts = x.riskAssessment.facts.filter(f => action.riskFactIds.includes(f.factId));
    assert.deepEqual(facts.map(f => f.semanticCode).sort(), ['BANK_COVERAGE_ADEQUATE', 'BANK_OPERATING_TREND']);
    assert.ok(facts.every(f => f.sourceIds.some(id => action.sourceIds.includes(id))));
    assert.ok(!x.recommendationSet.suppressedRecommendationCodes.includes(code));
    const items = plan.items.filter(i => i.recommendationCode === code);
    assert.equal(items.length, 1);
    assert.equal(items[0].horizon, 'DAY_30');
  }
});

test('cash-flow actions require a triggered, attributable bank observation', () => {
  for (const overrides of [{BANK_OPERATING_TREND: null}, {BANK_OPERATING_TREND: 10}, {BANK_COVERAGE_ADEQUATE: false}]) {
    const x = scenario({values: {...overlap, ...overrides}});
    assert.ok(!buildActionPlan(x).items.some(i => cashActions.includes(i.recommendationCode)));
  }
  const x = scenario({values: overlap});
  const rule = RECOMMENDATION_REGISTRY.definitions.find(d => d.code === cashActions[0]);
  const fact = x.riskAssessment.facts.find(f => f.semanticCode === 'BANK_OPERATING_TREND');
  fact.factId += '-unrelated';
  assert.deepEqual(matchRecommendationTriggers(x, rule), []);
});

test('proxy and equity share a finding while reported net assets still require their own source', () => {
  const x = scenario({values: {FIN_EQUITY: -100, FIN_REPORTED_NET_ASSETS: null, FIN_NET_ASSETS_PROXY: -100}});
  const equity = x.riskAssessment.findings.find(f => f.code === 'RISK-FIN-EQUITY-NON-POSITIVE');
  const check = x.recommendationSet.recommendations.find(r => r.definitionCode === 'OBTAIN_REPORTED_NET_ASSETS');
  assert.deepEqual(check.riskFindingIds, [equity.findingId]);
  assert.equal(check.actionability, 'VERIFY_FIRST');
  assert.ok(!x.recommendationSet.recommendations.some(r => r.definitionCode === 'VERIFY_REPORTED_NET_ASSETS'));
  assert.ok(!x.prescoreIndex.contributions.some(c => c.riskCode === 'RISK-FIN-NET-ASSETS-PROXY-NEGATIVE'));
});
