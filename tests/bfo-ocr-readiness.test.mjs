import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFields} from '../lib/document-poc/review-fields.ts';
const ocrPage=(text)=>({page:1,logicalPage:1,segment:'FULL',method:'OCR',text});
test('a financial OCR variant disagreement blocks READY even if the displayed totals agree',()=>{
 const page=ocrPage('Бухгалтерский баланс\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384\nБАЛАНС | 1600 | 100 | 80\nБАЛАНС | 1700 | 100 | 80');
 const report=reviewFields('synthetic:bfo:conflicting-pass',[page],1,'BFO','SINGLE',
  ['OCR_FINANCIAL_PASS_CONFLICT:1']);
 assert.equal(report.status,'INCOMPLETE');
 assert.ok(report.issues.includes('BFO_OCR_PASS_DISAGREEMENT'));
 assert.equal(report.fields.find(f=>f.key==='1600')?.value,'100','retain printed evidence for reviewer');
});
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

test('mismatched printed balance totals cannot be presented as a complete BFO review',()=>{
 const page=ocrPage('Бухгалтерский баланс\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384\nБАЛАНС | 1600 | 100 | 80\nБАЛАНС | 1700 | 120 | 80');
 const report=reviewFields('synthetic:balance:conflict',[page],1,'BFO','SINGLE');
 assert.equal(report.status,'INCOMPLETE');
 assert.ok(report.issues.includes('BALANCE_RECONCILIATION_MISMATCH'));
 assert.ok(report.issues.includes('BFO_INTEGRITY_REVIEW_REQUIRED'));
 const a=report.fields.find(f=>f.key==='1600'),b=report.fields.find(f=>f.key==='1700');
 assert.deepEqual([a?.value,b?.value],['100','120'],'readable source facts remain visible');
 assert.deepEqual([a?.status,b?.status],['REVIEW','REVIEW'],'not silently trusted');
});
test('reconciled printed balance totals remain visible as individually read source values',()=>{
 const page=ocrPage('Бухгалтерский баланс\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384\nБАЛАНС | 1600 | 100 | 80\nБАЛАНС | 1700 | 100 | 80');
 const report=reviewFields('synthetic:balance:aligned',[page],1,'BFO','SINGLE');
 assert.equal(report.status,'READY_FOR_REVIEW');
 assert.equal(report.fields.find(f=>f.key==='1600')?.value,'100');
 assert.equal(report.fields.find(f=>f.key==='1600')?.status,'READ');
 assert.equal(report.issues.includes('BFO_INTEGRITY_REVIEW_REQUIRED'),false);
});

test('unbound continuation table on a scanned financial page blocks complete BFO review',()=>{
 const first=ocrPage('Бухгалтерский баланс\nна 31 декабря 2025 г.\nЕдиница измерения: тыс. руб. по ОКЕИ 384\nБАЛАНС | 1600 | 100 | 80\nБАЛАНС | 1700 | 100 | 80');
 const result=reviewFields('synthetic:unbound-continuation',[first],1,'BFO','SINGLE',
  ['OCR_FINANCIAL_ROWS_UNBOUND:1']);
 assert.equal(result.status,'INCOMPLETE');
 assert.ok(result.issues.includes('BFO_CONTINUATION_ROWS_UNBOUND'));
 assert.equal(result.fields.find(f=>f.key==='1600')?.value,'100');
});
