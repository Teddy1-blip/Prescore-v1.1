import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
const ocrPage=(text)=>({page:1,logicalPage:1,segment:'FULL',method:'OCR',text});
test('a scanned BFO heading alone never promises extracted balance rows',()=>{
 const report=reviewFields('synthetic:bfo:1',[ocrPage('Бухгалтерский баланс\nна 31 декабря 2025 г.')],1,'BFO','SINGLE');
 assert.equal(report.status,'INCOMPLETE');
 assert.equal(report.fields.filter(f=>/^1[67]00$/.test(f.key)&&f.value!==null).length,0);
 assert.ok(report.issues.includes('BFO_CURRENT_VALUES_UNVERIFIED'));
});
test('a partially recognized scanned BFO remains incomplete without both balance totals',()=>{
 const text='Бухгалтерский баланс\nИНН: 7701234567\nЕдиница измерения: тыс. руб.\nна 31 декабря 2025 г.\nАКТИВ | 1600 | 200 | 180';
 const report=reviewFields('synthetic:bfo:2',[ocrPage(text)],1,'BFO','SINGLE');
 assert.equal(report.status,'INCOMPLETE');
 assert.ok(report.issues.includes('BFO_BALANCE_TOTALS_UNVERIFIED')||report.issues.includes('BFO_CURRENT_VALUES_UNVERIFIED'));
});
