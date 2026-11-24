import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {extractXlsxSheets,extractXlsxRows,extractXlsxText} from '../lib/credit-engine/server/document-extraction.ts';
const namespaced='<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>'
 +'<x:row r="5"><x:c r="B5" t="s"><x:v>0</x:v></x:c><x:c r="H5" t="str"><x:v>Сумма по кредиту</x:v></x:c></x:row>'
 +'<x:row r="7"><x:c r="B7" t="str"><x:v>2025-05-01</x:v></x:c><x:c r="H7" t="str"><x:v>100.50</x:v></x:c></x:row></x:sheetData></x:worksheet>';
const plain='<worksheet><sheetData><row r="2"><c r="C2" t="str"><v>Счет</v></c><c r="G2" t="str"><v>600.25</v></c></row></sheetData></worksheet>';
const bytes=zipSync({'xl/worksheets/sheet1.xml':strToU8(namespaced),'xl/worksheets/sheet2.xml':strToU8(plain),
 'xl/sharedStrings.xml':strToU8('<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:si><x:t>Дата проводки</x:t></x:si></x:sst>')});
test('XLSX extraction handles namespace-prefixed row, cell, value and shared strings',()=>{
 const sheets=extractXlsxSheets(bytes);
 assert.equal(sheets.length,2);assert.deepEqual(sheets[0].rowNumbers,[5,7]);
 assert.equal(sheets[0].rows[0][1],'Дата проводки');
 assert.equal(sheets[0].rows[0][7],'Сумма по кредиту');
 assert.equal(sheets[0].rows[1][7],'100.50');
});
test('XLSX extraction preserves separate accounts and actual source row numbers',()=>{
 const sheets=extractXlsxSheets(bytes);
 assert.equal(sheets[1].sheet,'sheet2.xml');assert.deepEqual(sheets[1].rowNumbers,[2]);
 assert.equal(sheets[1].rows[0][2],'Счет');assert.equal(sheets[1].rows[0][6],'600.25');
});
test('Existing flattened XLSX extraction remains stable for older clients',()=>{
 const sheets=extractXlsxSheets(bytes);
 assert.equal(extractXlsxRows(bytes).length,3);
 assert.equal(extractXlsxText(bytes),sheets.flatMap(s=>s.rows).map(r=>r.join('\t')).join('\n'));
});
