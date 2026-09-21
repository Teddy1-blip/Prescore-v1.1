import assert from 'node:assert/strict';
// Independent fixture arithmetic in integer kopecks: no parser/classifier/metric engine imports.
export function conflictOracle(statements,companyInn){
 const groups=new Map();
 for(const source of statements)for(const block of source.text.split('СекцияДокумент=').slice(1)){
  const fields=Object.fromEntries(block.split('КонецДокумента')[0].split(/\r?\n/).slice(1).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
  if(fields['ПолучательИНН']!==companyInn)continue;
  assert.match(fields['НазначениеПлатежа'],/товар/i); // Scope: this synthetic sales-only bundle, not a production classifier.
  const key=JSON.stringify(['Номер','Дата','ПлательщикСчет','ПолучательСчет'].map(k=>fields[k]));
  assert.match(fields['Сумма'],/^\d+\.\d{2}$/);const cents=BigInt(fields['Сумма'].replace('.',''));
  const values=groups.get(key)??new Set();values.add(cents);groups.set(key,values);
 }
 let subtotal=0n;const conflicts=[];
 for(const [key,values]of groups){if(values.size>1)conflicts.push({key,values:[...values].map(n=>Number(n)/100).sort((a,b)=>a-b)});else subtotal+=[...values][0];}
 return {subtotal:Number(subtotal)/100,conflicts};
}
export function assertIsolatedConflict(bundle,result){
 const m=bundle.input.analysis.metricsV2,c=m.conflicts,expected=conflictOracle(bundle.statements,bundle.input.analysis.companyInn);
 assert.equal(expected.conflicts.length,1);assert.equal(expected.subtotal,11800000);
 assert.equal(c.groups.length,1);assert.equal(c.groups[0].variants.length,2);
 assert.deepEqual(c.groups[0].variants.map(v=>v.observations[0].amount).sort((a,b)=>a-b),expected.conflicts[0].values);
 assert.ok(c.groups[0].variants.every(v=>v.observations.every(t=>t.sourceId&&t.rawReference)));
 assert.equal(c.undisputedOperatingReceipts,expected.subtotal);
 assert.equal(m.operating.operatingCashReceipts.value,null);assert.equal(m.operating.operatingCashReceipts.status,'UNKNOWN');
 assert.equal(m.operating.fullMonthOperatingAverage.value,null);
 const d=result.debtCapacity;
 for(const view of [d.recurringView,d.nearTerm30dView]){assert.equal(view.operatingAmount,null);assert.equal(view.prudentialTotalMonthlyDebtService,null);assert.equal(view.maximumPolicyMonthlyDebtService,null);}
 assert.equal(d.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential,null);assert.equal(d.headlineCapacity.monthlyIncrementalDebtServiceCapacity.maximumPolicy,null);
 for(const s of d.scenarioResults)for(const k of ['prudentialMonthlyPaymentCapacity','maximumPolicyMonthlyPaymentCapacity','prudentialPrincipalEquivalent','maximumPolicyPrincipalEquivalent'])assert.equal(s[k],null);
 assert.equal(d.bankConflict.undisputedOperatingReceipts,expected.subtotal);
 assert.ok(result.riskAssessment.summary.dataReviewRequired);assert.equal(result.model.hero.globalStop,false);
 assert.ok(result.creditPortfolio.obligations.length);assert.equal(result.creditPortfolio.obligations[0].currentTerms.scheduledPaymentAmount.value,100000);assert.equal(m.debtService.debtServiceCashOutflow.value,1200000);
 assert.match(result.model.capacity.text,/Конфликт версий операции/);
 assert.ok(result.model.capacity.details.some(f=>f.metrics.some(v=>v.bindingCode==='UNDISPUTED_OPERATING_SUBTOTAL'&&v.value===expected.subtotal)));
}
