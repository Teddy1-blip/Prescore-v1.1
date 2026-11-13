import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBusiness} from '../lib/credit-engine/credit-lab/business-corpus.mjs';
import {checkoStatusText} from '../lib/external/checko-summary.ts';
import {normalizeProfile} from '../lib/external/checko-profile.ts';
import {buildCanonicalCreditAnalysis} from '../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../lib/credit-engine/production/public-model.ts';
import {bankCoverageGaps} from '../lib/credit-engine/credit-assessment/coverage.ts';
const fixtures=[
 ['A',1,null,'Поступления превысили списания'],
 ['B',12,'RISK-CF-DEBT-SERVICE-BURDEN','Нагрузка обслуживания долга'],
 ['C',3,'RISK-CF-OPERATING-RECEIPTS-DECLINE','Снижение операционных поступлений'],
 ['D',5,'RISK-CF-CUSTOMER-CONCENTRATION','Концентрация поступлений'],
 ['E',11,null,'Неполное покрытие банковского периода'],
 ['F',17,'GLOBAL_STOP','ликвидац'],
];
const profiles=new Map();
for(const [name,num,expected,headline] of fixtures){
 const x=loadBusiness('CL-RU-BUS-'+String(num).padStart(3,'0')).input,a=x.analysis;
 delete a.financialStatementsV2;delete a.financialAnalysisV2;delete a.creditHistory;delete a.creditPortfolioV1;
 delete a.sourceManifest.bfo;delete a.sourceManifest.bki;delete x.financingCase;delete x.scenarios;
 const at=a.metricsV2.period.to;
 const data={company:{data:{ИНН:a.companyInn,ДатаСвед:at,Статус:{Наим:name==='F'?'В процессе ликвидации':'Действует'}}}};
 x.companyProfile=normalizeProfile(a.companyInn,data,{},at);
 const c=buildCanonicalCreditAnalysis(x),r=publicCanonicalModel(c.model,c);
 profiles.set(name,{c,r});
 test('Bank + Checko / '+name+' · '+headline,()=>{
  assert.equal(c.prescoreIndex.value,null);assert.equal(c.financialAnalysis,undefined);assert.equal(c.creditPortfolio.obligations.length,0);
  assert.match(r.hero.headline,new RegExp(headline,'i'));assert.match(r.hero.summary,/₽/);
  assert.ok(r.checko.rows.some(v=>v.label==='Юридический статус'&&v.sourceId));
  const risks=c.riskAssessment.findings.filter(f=>f.scope==='CREDIT_RISK');
  if(expected==='GLOBAL_STOP'){assert.equal(r.hero.globalStop,true);assert.equal(r.productFit.primary.length+r.productFit.other.length,0);}
  else {assert.ok(r.productFit.other.some(p=>p.fit==='Условно подходит'));if(expected)assert.ok(risks.some(f=>f.code===expected));else assert.equal(risks.length,0);}
  assert.ok(r.expertise.memoIds.length);assert.ok(r.expertise.items.every(i=>i.claimIds.length&&i.sourceReferenceIds.length));
  assert.ok(c.creditAssessment.bankObservations.every(o=>o.sourceIds.length&&o.period.asOf&&o.value!==null));
  assert.ok(r.actionPlan.horizons.length===3);assert.ok(r.recommendations.primary.every(a=>c.explainability.claims.some(cl=>cl.claimId===a.claimId)));
  if(name==='E')assert.ok(bankCoverageGaps(a).every(g=>g.month&&g.bank&&g.sourceIds.length));
  if(expected&&expected!=='GLOBAL_STOP')assert.ok(c.recommendationSet.recommendations.some(rec=>risks.some(f=>rec.riskFindingIds.includes(f.findingId))));
 });
}
test('The six businesses receive distinct opinions grounded in their own evidence',()=>{
 assert.equal(new Set([...profiles.values()].map(({r})=>r.hero.headline)).size,6);
 assert.equal(new Set([...profiles.values()].map(({r})=>r.expertise.items.find(i=>i.id===r.expertise.memoIds[0]).interpretation)).size,6);
 const clean=profiles.get('A').r.productFit.other.find(p=>p.family==='CREDIT_LINE').purpose;
 assert.notEqual(profiles.get('B').r.productFit.other.find(p=>p.family==='CREDIT_LINE').purpose,clean);
});

test('Checko distinguishes a failed dossier checksum from provider and configuration states', () => {
  assert.match(checkoStatusText('FAILED', '9900002001'), /Контрольная цифра ИНН/);
  assert.match(checkoStatusText('FAILED', ''), /нужны 10 цифр/);
  assert.equal(checkoStatusText('FAILED', '7707083893'), 'Ошибка получения сведений');
  assert.equal(checkoStatusText('NOT_CONFIGURED', '9900002001'), 'Источник не настроен');
});
