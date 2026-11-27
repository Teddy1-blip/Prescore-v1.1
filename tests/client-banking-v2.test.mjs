import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {conclusionFixture} from './fixtures/credit-conclusion.mjs';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('T3 / canonical BSM debt and fiscal ratios are read-only BASIC facts',()=>{
 const {input,model}=conclusionFixture(),b=model.basic.bankingFacts;
 assert.equal(b.debtServiceToOperatingReceipts.code,'BSM-DEBT-006');
 assert.equal(b.taxToOperatingCashReceipts.code,'BSM-TAX-006');
 assert.equal(b.debtServiceToOperatingReceipts.value,input.analysis.metricsV2.debtService.debtServiceToOperatingReceipts.value);
 assert.equal(b.taxToOperatingCashReceipts.value,input.analysis.metricsV2.tax.taxToOperatingCashReceipts.value);
 assert.equal(b.taxAndSocialPayments.value,input.analysis.metricsV2.tax.taxAndSocialAmount.value);
 assert.equal(b.debtServiceToOperatingReceipts.unit,'RATIO');
 assert.equal(b.taxToOperatingCashReceipts.unit,'RATIO');
});

test('T3 / Free ledger shows known zero but never an UNKNOWN ratio as cash fact',async()=>{
 const rt=await createWorkspaceRuntime();
 try {
  const {BankingLedger}=rt.load('app/components/workspace/banking-ledger.tsx');
  const basic=structuredClone(conclusionFixture().model);
  delete basic.full;basic.entitlement='BASIC';basic.fullAvailability='LOCKED';
  const b=basic.basic.bankingFacts;
  b.debtServiceToOperatingReceipts={...b.debtServiceToOperatingReceipts,value:0,status:'KNOWN'};
  b.taxToOperatingCashReceipts={...b.taxToOperatingCashReceipts,value:123456789,status:'UNKNOWN'};
  b.taxAndSocialPayments={...b.taxAndSocialPayments,value:0,status:'KNOWN'};
  const before=JSON.stringify(basic);
  const html=renderToStaticMarkup(React.createElement(BankingLedger,{model:basic}));
  assert.match(html,/Доля обслуживания долга/);
  assert.match(html,/0%/);
  assert.doesNotMatch(html,/123.?456.?789/);
  assert.match(html,/Налоги и взносы, всего/);
  assert.match(html,/В том числе лизинг/);
  assert.match(html,/banking-monthly-ledger/);
  assert.match(html,/Остаток кредита на дату подтверждают БКИ или документы кредитора/);
  assert.equal(JSON.stringify(basic),before);
 } finally { await rt.close(); }
});

test('T3 does not duplicate the existing monthly banking ledger',()=>{
 const page=fs.readFileSync('app/components/workspace/approved/pages.tsx','utf8');
 const ledger=fs.readFileSync('app/components/workspace/banking-ledger.tsx','utf8');
 assert.doesNotMatch(page,/title="Месячные итоги"/);
 assert.match(page,/href="#banking-monthly-ledger"/);
 assert.match(ledger,/id="banking-monthly-ledger"/);
});
