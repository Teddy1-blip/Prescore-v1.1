import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarSheet,mapSheetRow} from '../lib/workspace/calendar-sheet.ts';
import {settlementPositions} from '../lib/workspace/settlement-positions.ts';

const rows=calendarSheet('Назначение\tСумма\tКогда\nАренда\t12 300,45\t27.11.2026\nИтого за ноябрь\t12300\t2026-11-30\nШтраф\t100\t31.11.2026');
const mapping={header:0,date:2,amount:1,purpose:0,direction:'OUT'};
test('Mapped schedule imports dated line with cents and stable evidence',()=>{
 assert.deepEqual(mapSheetRow(rows,mapping,1,'График'),{date:'2026-11-27',amount:12300.45,purpose:'Аренда',direction:'OUT',certainty:'DECLARED',source:'График · строка 2'});
 assert.equal(mapSheetRow(rows,mapping,0,'График'),null);assert.equal(mapSheetRow(rows,mapping,2,'График'),null);assert.equal(mapSheetRow(rows,mapping,3,'График'),null);
 assert.equal(mapSheetRow(rows,{...mapping,date:1},1,'График'),null);
});
test('A reviewed absolute payment date binds only to the same contract and party',()=>{
 const row={account:'62.01',party:'Учебный покупатель',contract:'У-01',debit:100,credit:0,asOf:'2026-11-01',row:2};
 const osv={id:'1',kind:'COUNTERPARTIES',payload:{envelope:{},ledger:[row]}};
 const field=value=>({value,page:3,fragment:value});
 const doc=(name,terms)=>({id:'2',kind:'COMMERCIAL_DOCUMENT',documentId:'2',payload:{envelope:{fileName:'Договор'},verified:{contract_number:field('У-01'),customer:field(name),FINAL_PAYMENT:field(terms)}}});
 assert.equal(settlementPositions([osv,doc(row.party,'до 27.11.2026')])[0].due,'2026-11-27');
 assert.equal(settlementPositions([osv,doc(row.party,'30 дней после подписания акта')])[0].due,undefined);
 assert.equal(settlementPositions([osv,doc('Другая организация','до 27.11.2026')])[0].due,undefined);
 assert.ok(settlementPositions([{...osv,payload:{...osv.payload,ledger:[{...row,due:'2026-11-28'}]}},doc(row.party,'до 27.11.2026')])[0].conflict);
});
