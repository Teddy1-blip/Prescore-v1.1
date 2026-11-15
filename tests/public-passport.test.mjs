import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPassport} from '../lib/workspace/public-passport.ts';

const inn='7701234567';
const company={name:'ООО «Тестовый пример»',ogrn:'1234567890123',status:'Действует',
  region:'Москва',registrationDate:'2018-05-01',okved:'46.90'};
const base={company,fetchedAt:'2026-11-15T00:00:00.000Z'};

test('No Checko data creates an INN-only passport without invented financial figures or bank decisions',()=>{
 const view=publicPassport(null,inn,false,false);
 assert.equal(view.company.inn,inn);
 assert.equal(view.checkoDate,null);
 assert.equal(view.attention.length,0);
 assert.equal(view.actions.length,2);
 assert.ok(view.actions.every(x=>!x.title.includes('отказ')));
 assert.ok(!JSON.stringify(view).includes('одобрен'));
});

test('Unavailable legal coverage cannot be shown as a verified absence of risk',()=>{
 const view=publicPassport({...base,publicRisks:{enforcementDetected:null,legalEventsDetected:null}},inn,true,true);
 assert.equal(view.attention.length,0);
 assert.equal(view.company.ogrn,'1234567890123');
 assert.equal(view.contracts,null);
 assert.equal(view.actions.length,1);
 assert.match(view.publicExpertise,/Паспорт компании сформирован/);
});

test('Verified Checko signals create source-dated attention without declaring a bank rejection',()=>{
 const view=publicPassport({...base,publicRisks:{enforcementDetected:true,legalEventsDetected:true},
   legal:{legalCases:2,enforcements:1},contracts:{totalCount:7}},inn,true,true);
 assert.equal(view.attention.length,2);
 assert.equal(view.contracts,7);
 assert.ok(view.attention.every(x=>x.evidence==='Checko · 2026-11-15'));
 assert.ok(view.attention.every(x=>!/откажут|отклонено|банк отказ/i.test(x.detail)));
 assert.equal(view.actions[0].title,'Уточнить публичные события');
});

test('Public recommendations request only the missing sources and never create dummy balances',()=>{
 const view=publicPassport(base,inn,false,true);
 assert.equal(view.actions.length,1);
 assert.match(view.actions[0].detail,/банковск/i);
 assert.equal(JSON.stringify(view).includes('0 ₽'),false);
});
