import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBankStatementMetricsV2} from '../lib/credit-engine/metrics/engine.ts';

// Real metrics engine. Values below are independent daily-ledger oracles, not
// generated expectations. No HTTP, database, React or calculation mocks.
const first='2026-01-01',last='2026-01-03';
function tx(id,direction,amount,date,category='INTERNAL_TRANSFER') {
 return {id,canonicalTransactionId:id,date,amount,direction,account:'40702810000000000001',
  counterparty:'Synthetic counterparty',counterpartyInn:'9900000001',purpose:'synthetic',
  category:'other',sourceId:'source-1',sourceFileName:'synthetic.txt',duplicateStatus:'NOT_DUPLICATE',
  classification:{version:'PRESCORE-TX-CLASSIFIER-2.0.0-SHADOW',family:'OTHER',primaryCategory:category,
   confidence:'HIGH',ruleCode:'SYNTHETIC',evidence:[],alternatives:[],tags:[],requiresReview:false,ambiguityReasons:[]}};
}
function calculate(transactions,openingBalance,endingBalance,extra={}) {
 const source={sourceId:'source-1',sourceType:'BANK_STATEMENT',status:'READY',companyInn:'9900000001',
  receivedAt:'2026-01-04',confidence:100,warnings:[],periodFrom:first,periodTo:last,
  fieldAvailability:{openingBalance:'KNOWN',endingBalance:'KNOWN'}};
 const input={transactions,openingBalance,legacyMetrics:{endingBalance},periodFrom:first,periodTo:last,
  sourceManifest:{bankStatements:[source]},...extra};
 return buildBankStatementMetricsV2(input).metricsV2;
}
const derived=['averageDailyBalance','minimumDailyBalance','lowLiquidityDays','nearZeroBalanceDays','negativeReconstructedBalanceDays'];
function unknownDerived(metrics,warning) {
 for(const key of derived){const v=metrics.liquidity[key];assert.equal(v.value,null,key);assert.equal(v.status,'UNKNOWN',key);assert.equal(v.confidence,'UNKNOWN',key);if(warning)assert.ok(v.warnings.includes(warning),key);}
}
test('own-account incoming affects supplied-account balance but never operating revenue',()=>{
 const m=calculate([tx('own-in','in',1000,first),tx('supplier','out',200,'2026-01-02','SUPPLIER_PAYMENT')],0,800);
 assert.equal(m.liquidity.averageDailyBalance.value,866.67); // [1000,800,800]
 assert.equal(m.liquidity.minimumDailyBalance.value,800);
 assert.equal(m.liquidity.negativeReconstructedBalanceDays.value,0);
 assert.equal(m.cashFlow.grossExternalCashInflow.value,0);
 assert.equal(m.cashFlow.grossExternalCashOutflow.value,200);
 assert.equal(m.operating.operatingCashReceipts.value,0);
 assert.ok(m.liquidity.averageDailyBalance.includedCategories.includes('INTERNAL_TRANSFER'));
 assert.ok(!m.liquidity.averageDailyBalance.excludedCategories?.includes('INTERNAL_TRANSFER'));
});
test('own-account outgoing is not silently removed from the supplied balance perimeter',()=>{
 const m=calculate([tx('own-out','out',800,'2026-01-02'),tx('sale','in',200,last,'SALE_PROCEEDS')],1000,400);
 assert.equal(m.liquidity.averageDailyBalance.value,533.33); // [1000,200,400]
 assert.equal(m.liquidity.minimumDailyBalance.value,200);
 assert.equal(m.operating.operatingCashReceipts.value,200);
 assert.equal(m.cashFlow.grossExternalCashOutflow.value,0);
});
test('matched internal legs cancel within the supplied perimeter',()=>{
 const m=calculate([tx('a','out',500,'2026-01-02'),tx('b','in',500,'2026-01-02')],1000,1000);
 assert.equal(m.liquidity.averageDailyBalance.value,1000);
 assert.equal(m.cashFlow.netExternalCashFlow.value,0);
});
test('internal legs on different posting days retain the interim liquidity movement',()=>{
 const m=calculate([tx('a','out',500,first),tx('b','in',500,last)],1000,1000);
 assert.equal(m.liquidity.averageDailyBalance.value,666.67); // [500,500,1000]
 assert.equal(m.liquidity.minimumDailyBalance.value,500);
 assert.equal(m.cashFlow.netExternalCashFlow.value,0);
});
test('unreconciled ending balance invalidates derived liquidity, not the reported endpoint',()=>{
 const m=calculate([tx('sale','in',100,first,'SALE_PROCEEDS')],0,900);
 unknownDerived(m,'BALANCE_RECONCILIATION_MISMATCH');
 assert.equal(m.liquidity.endingBalance.value,900);
 assert.equal(m.cashFlow.grossExternalCashInflow.value,100);
});
test('genuine reconciled negative balances remain negative rather than clamped to zero',()=>{
 const m=calculate([tx('out','out',150,first,'SUPPLIER_PAYMENT'),tx('in','in',50,'2026-01-02','SALE_PROCEEDS')],100,0);
 assert.equal(m.liquidity.minimumDailyBalance.value,-50);
 assert.equal(m.liquidity.averageDailyBalance.value,-16.67);
 assert.equal(m.liquidity.negativeReconstructedBalanceDays.value,1);
});
test('unknown posting direction is not accepted as a zero cash movement',()=>{
 unknownDerived(calculate([tx('unknown','unknown',100,first,'UNKNOWN_DIRECTION')],1000,1000),'BALANCE_MOVEMENTS_INCOMPLETE');
});
test('out-of-period cash movements cannot be silently discarded even when endpoint matches',()=>{
 unknownDerived(calculate([tx('outside','in',100,'2025-12-31','SALE_PROCEEDS')],1000,1000),'BALANCE_MOVEMENTS_INCOMPLETE');
});
test('period cap never publishes an incomplete 740-day average as the full period',()=>{
 unknownDerived(calculate([],1000,1000,{periodFrom:'2023-01-01',periodTo:'2026-01-03'}),'BALANCE_PERIOD_TOO_LONG');
});
test('missing opening evidence keeps derived balances unknown and preserves reported ending',()=>{
 const m=calculate([],null,1000);unknownDerived(m);assert.equal(m.liquidity.endingBalance.value,1000);
});
test('partial opening evidence cannot become a complete starting balance',()=>{
 const m=calculate([],1000,1000,{sourceManifest:{bankStatements:[{sourceId:'a',sourceType:'BANK_STATEMENT',status:'READY',companyInn:'9900000001',receivedAt:'2026-01-04',warnings:[],fieldAvailability:{openingBalance:'UNKNOWN',endingBalance:'KNOWN'}}]}});
 unknownDerived(m);
});
test('zero operations and explicit balances reconstruct an observed zero-activity period',()=>{
 const m=calculate([],0,0);
 assert.equal(m.liquidity.averageDailyBalance.value,0);
 assert.equal(m.liquidity.minimumDailyBalance.value,0);
 assert.equal(m.liquidity.negativeReconstructedBalanceDays.value,0);
});
