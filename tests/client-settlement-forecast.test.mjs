import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementPositions} from '../lib/workspace/settlement-positions.ts';
import {settlementState,settlementEvent,paymentFacts} from '../lib/workspace/settlement-events.ts';
import {calendarEvents,cashForecast} from '../lib/workspace/liquidity-calendar.ts';
import {businessValue} from '../lib/workspace/investment-model.ts';
import {ownerPreviewFullAccess} from '../lib/platform/owner-preview-access.ts';
import {createHash} from 'node:crypto';

const p={id:'buyer',account:'62.01',side:'buyers',partyInn:'9909000011',contract:'Т-1',debit:100,credit:0,asOf:'2026-11-01',references:[],conflict:false};
const bank={id:'b1',date:'2026-11-03',amount:40,direction:'in',inn:p.partyInn,source:'Поручение 7'};
const logged=(kind,fields={})=>({id:'e1',kind,date:'2026-11-03',position:p.id,asOf:p.asOf,note:'Письмо',recordedAt:'2026-11-02T08:00:00Z',...fields});
test('Partial payment consumes one canonical operation and a later OSV absorbs it',()=>{
 const s=settlementState(p,[],[bank]);
 assert.equal(s.dueDate,null);
 const input=settlementEvent({kind:'PAYMENT',position:p.id,asOf:p.asOf,note:'Подтверждено',bankId:bank.id,date:'2000-01-01',amount:999},s);
 assert.equal(input.amount,40);assert.equal(input.date,bank.date);
 const h=[logged('PAYMENT',input)];
 const after=settlementState(p,h,[bank]);assert.equal(after.remaining,60);assert.equal(after.candidates.length,0);
 assert.equal(settlementState({...p,asOf:'2026-11-05',debit:60},h,[bank]).remaining,60);
 assert.equal(settlementState({...p,id:'other'},h,[bank]).candidates.length,0);
});
test('Due date requires evidence; promises never replace contractual due dates',()=>{
 const h=[logged('DUE',{date:'2026-12-01'}),logged('PROMISE',{id:'e2',date:'2026-12-10'})];
 assert.equal(settlementState(p,h,[]).dueDate,'2026-12-01');
 assert.equal(settlementState({...p,asOf:'2026-12-02'},h,[]).dueDate,null);
 assert.equal(settlementEvent({kind:'DUE',position:p.id,asOf:p.asOf,note:'',date:'2026-12-01'},settlementState(p,[],[])),null);
});
test('Multiple dated OSVs do not double count; conflicting balances are retained for review',()=>{
 const source=(id,rows)=>({kind:'COUNTERPARTIES',id,documentId:id,payload:{ledger:rows,envelope:{fileName:id}}});
 const a={...p,party:'Покупатель',row:2},b={...a,asOf:'2026-11-10',debit:80};
 const positions=settlementPositions([source('A',[a]),source('B',[b]),source('C',[b])]);
 assert.equal(positions.length,1);assert.equal(positions[0].debit,80);assert.equal(positions[0].references.length,2);
 const conflicts=settlementPositions([source('A',[b]),source('B',[{...b,debit:75}])]);assert.ok(conflicts.every(r=>r.conflict));
});
test('Unidentified, reversed and internal payments are excluded',()=>{
 const t={canonicalTransactionId:'1',currency:'RUB',date:bank.date,amount:bank.amount,direction:'in',counterpartyInn:p.partyInn,sourceId:'s'};
 assert.equal(paymentFacts([t,{...t,isOwnAccountTransfer:true},{...t,duplicateOfTransactionId:'1'},{...t,possibleReversalOfTransactionId:'1'},{...t,currency:'USD'}]).length,1);
});
const events=[{id:'o',date:'2026-11-12',direction:'OUT',amount:120,type:'Договор',label:'Аренда'},{id:'i',date:'2026-11-11',direction:'IN',amount:50,type:'Ожидаемое поступление',label:'Оплата'}];
test('Forecast preserves known zero, tracks cause and delays only incoming events',()=>{
 assert.equal(cashForecast(events,null,'2026-11-10',30,0,false).minimum,null);
 assert.equal(cashForecast(events,0,'2026-11-10',30,0,false).minimum,-70);
 const stress=cashForecast(events,100,'2026-11-10',30,7,false);
 assert.equal(stress.minimum,-20);assert.equal(stress.firstGap,'2026-11-12');assert.deepEqual(stress.daily[0].items,['Аренда']);
 assert.equal(cashForecast(events,100,'2026-11-10',30,0,false).firstGap,null);
});
test('Replicated next payment, contingencies, conditional scenarios and manual overlaps are excluded',()=>{
 const base={schedule:[{id:'s',obligationId:'o',status:'SCHEDULED',exposure:'FUNDED_DEBT',type:'PAYMENT_DUE',date:'2026-11-12',amount:40,sourceIds:[]}],obligations:[{id:'o',nextDate:'2026-11-12',nextAmount:40,sourceIds:[]},{id:'g',nextDate:'2026-11-13',exposure:'CONTINGENT',nextAmount:33,sourceIds:[]}],sources:[],settlements:[],calendar:[{date:'2026-11-12',amount:40,direction:'OUT',purpose:'Проверить график',source:'план',certainty:'DECLARED'},{date:'2026-11-15',amount:10,direction:'IN',purpose:'Гипотеза',source:'план',certainty:'SCENARIO'}]};
 const all=calendarEvents(base);assert.equal(all.length,3);assert.equal(all.filter(e=>e.ambiguous).length,1);
 assert.equal(cashForecast(all,100,'2026-11-10',30,0,false).rows.length,1);
 assert.equal(cashForecast(all,100,'2026-11-10',30,0,true).rows.length,2);
});
test('DCF sensitivity and equity bridge require explicit assumptions',()=>{
 assert.ok(Math.abs(businessValue([100,100,100],10,0,0).ev-1000)<1e-8);
 assert.equal(businessValue([100],10,10,null),null);assert.equal(businessValue([100],10,0,null).equity,null);
 assert.equal(Math.round(businessValue([100],10,0,100).equity),900);
 assert.ok(businessValue([100],12,0,0).ev<businessValue([100],10,0,0).ev);
});
test('Only designated client on the pinned Codespace gets the preview entitlement',()=>{
 const env={CODESPACES:'true',CODESPACE_NAME:'demo-space',PRESCORE_RUNTIME_MODE:'release-candidate',PRESCORE_BASE_URL:'https://demo-space-4188.app.github.dev',PRESCORE_OWNER_FULL_PREVIEW:'1',PRESCORE_OWNER_PREVIEW_EMAIL_SHA256:createHash('sha256').update('client@example.test').digest('hex')};
 assert.equal(ownerPreviewFullAccess('client@example.test',env),true);assert.equal(ownerPreviewFullAccess('other@example.test',env),false);
 for(const url of ['https://another-space-4188.app.github.dev','https://demo-space-4188.app.github.dev.evil.test','http://demo-space-4188.app.github.dev'])assert.equal(ownerPreviewFullAccess('client@example.test',{...env,PRESCORE_BASE_URL:url}),false);
});
