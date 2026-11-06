import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {extractCsvText,extractXlsxText} from '../lib/credit-engine/server/document-extraction.ts';
import {parseQuarterlyReportText} from '../lib/quarterly-report.ts';
import {financialText} from './fixtures/polish-sources.mjs';

function parsed(row) {
  return parseQuarterlyReportText(financialText('9999999999').replace('Выручка 2110 1200',row),'sample.csv').financialMetadataV2;
}
for (const [label,row,expected] of [
  ['absent current column','Выручка;2110;;233',null],
  ['malformed current column','Выручка;2110;12z09;233',null],
  ['quoted comma decimal','"Выручка",2110,"120,25",48',120.25],
  ['explicit zero','Выручка;2110;0;233',0],
  ['bad PDF cell','Выручка 2110 абв  233',null]
]) test(label,()=>{
  const m=parsed(extractCsvText(strToU8(row)));
  assert.equal(m.rawLines['2110'],expected);assert.ok(!m.labelValues['2110']);
});
for(const blank of ['', '<c r="C2"/>']) test('XLSX missing current position '+(blank?'explicit':'omitted'),()=>{
  const rows='<row r="2"><c r="A2" t="inlineStr"><is><t>Выручка</t></is></c><c r="B2"><v>2110</v></c>'+blank+'<c r="D2"><v>529</v></c></row>';
  const text=extractXlsxText(zipSync({'xl/worksheets/sheet1.xml':strToU8('<worksheet>'+rows+'</worksheet>')}));
  assert.equal(text,'Выручка\t2110\t\t529');assert.equal(parsed(text).rawLines['2110'],null);
});
test('simplified reporting codes are never monetary amounts or proof of aggregate liabilities',()=>{
  const source=financialText('9999999999').replace('Капитал и резервы 1300 600','Капитал и резервы     1370      621       499')
    .replace('Долгосрочные обязательства 1400 100','Другие долгосрочные обязательства    1450    11      12');
  const meta=parseQuarterlyReportText(source,'test.pdf').financialMetadataV2;
  assert.equal(meta.labelValues['1300'].rawValue,621);assert.ok(!meta.labelValues['1400']);
});
