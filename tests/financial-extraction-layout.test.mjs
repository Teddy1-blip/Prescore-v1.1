import test from 'node:test';
import assert from 'node:assert/strict';
import { financialTableRows } from '../lib/document-poc/financial-layout.ts';
import { financialStatement } from '../lib/document-poc/financial.ts';
import { validation } from '../lib/document-poc/fields.ts';
import { extractDocument } from '../lib/document-poc/extract.ts';
function item(s, x, y, w = s.length * 5) {
  return {
    str: s,
    width: w,
    transform: [9, 0, 0, 9, x, y]
  };
}
const headers = [item('Код строки', 69, 200), item('На 31 декабря', 115, 206), item('2024 г.', 130, 195), item('На 31 декабря', 220, 206), item('2023 г.', 235, 195)];
const meta = ['Бухгалтерский баланс', 'на 31 декабря 2024 г.', 'Отчётный период: 2024', 'Единица измерения: в тыс. рублей      по ОКЕИ 384'];
function inspect(extra, lines = meta) {
  const input = {
    id: 'synthetic',
    issues: [],
    lines: lines.map(text => ({
      text,
      page: 1,
      confidence: 'HIGH'
    })),
    financialTables: financialTableRows([...headers, ...extra], 1)
  };
  const result = financialStatement(input);
  return {
    input,
    result,
    status: validation(input.issues)
  };
}
const row = (code, y, parts) => [item('Статья', 10, y), item(code, 80, y), ...parts.map(([s, x]) => item(s, x, y + 3))];
test('Coordinate columns recover vertically offset values and boxed digits without using a company identity', () => {
  const parts = [['4', 122], ['5', 132], ['6', 142], ['7', 152], ['8', 162], ['3 210', 233]];
  const r = inspect([...row('1600', 165, parts), ...row('1700', 146, parts), item('1', 3, 172), item('2024', 330, 157)]);
  assert.equal(r.status, 'PASS');
  const f = r.result.rows[0];
  assert.equal(f.current_period_value.value, 45678);
  assert.equal(f.current_period_value.confidence, 'MEDIUM');
  assert.equal(f.previous_period_value.value, 3210);
  assert.equal(f.previous_period.value, '2023-12-31');
  assert.equal(f.raw_current, '4 5 6 7 8');
  assert.equal(f.unit.value, 'тыс. ₽');
});
test('Detached digits, uneven pitch, missing current cells, single digits and notes are not strong monetary evidence', () => {
  const r = inspect([...row('1600', 165, [['2', 126], ['5', 141], ['8', 173], ['-17', 237]]), ...row('1700', 146, [['1', 238]]), item('1600', 9, 100), item('4', 14, 100)]);
  assert.equal(r.result.rows.length, 2);
  assert.equal(r.result.rows[0].current_period_value.value, null);
  assert.equal(r.result.rows[0].current_period_value.confidence, 'LOW');
  assert.equal(r.result.rows[0].previous_period_value.value, -17);
  assert.equal(r.result.rows[1].current_period_value.value, null);
  assert.deepEqual([r.result.rows[1].previous_period_value.value, r.result.rows[1].previous_period_value.confidence], [1, 'MEDIUM']);
});
test('Balanced parentheses stay with the proper column; an explicitly blank comparative cell never implies zero', () => {
  const parts = [['(', 105], ['125', 143], [') (', 194], ['-', 245], [')', 285]];
  const r = inspect(row('2110', 165, parts));
  assert.equal(r.result.rows[0].current_period_value.value, -125);
  assert.equal(r.result.rows[0].previous_period_value.value, null);
});
test('Unknown or contradictory metadata and duplicate line codes block PASS', () => {
  const base = [...row('1600', 165, [['1 500', 131], ['1 400', 235]]), ...row('1700', 146, [['1 500', 131], ['1 400', 235]])];
  for (const lines of [meta.filter(x => !x.startsWith('на ')), [...meta, 'на 31 декабря 2023 г.'], [...meta, 'Единица измерения: млн ₽']]) {
    assert.notEqual(inspect(base, lines).status, 'PASS');
  }
  const dup = inspect([...base, ...row('1600', 130, [['999', 131], ['888', 235]])]);
  assert.equal(dup.status, 'INVALID');
  assert.ok(dup.result.rows.filter(r => r.line_code.value === '1600').every(r => r.current_period_value.value === null && r.confidence === 'LOW'));
});
test('Only evidenced periods are used, including an explicitly non-calendar opening date', () => {
  const r = inspect(row('1600', 165, [['10', 131], ['5', 235]]), [...meta.filter(x => !x.startsWith('Отчётный период')), 'за 10.11.2023 - Декабрь 2024 г.']);
  assert.deepEqual([r.result.metadata.period_start.value, r.result.metadata.period_end.value], ['2023-11-10', '2024-12-31']);
});
test('Real PDF byte path keeps blank columns and numbers displaced from the code baseline', async () => {
  const ops = [];
  const at = (x, y, s) => ops.push('BT /F1 10 Tf ' + x + ' ' + y + ' Td (' + s + ') Tj ET');
  at(20, 380, 'BALANCE SHEET');
  at(20, 363, 'Reporting date: 2024-12-31');
  at(20, 348, 'Reporting period: 2024');
  at(20, 332, 'Unit: 384');
  at(78, 294, 'Line code');
  at(135, 294, 'Current 31.12.2024');
  at(245, 294, 'Previous 31.12.2023');
  for (const [code, y] of [['1600', 272], ['1700', 248]]) {
    at(20, y, 'Total assets');
    at(82, y, code);
    [...'34567'].forEach((s, i) => at(143 + 14 * i, y + 3, s));
    at(258, y + 3, '12 500');
  }
  const stream = ops.join('\n'),
    objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 390 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream'];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [i, obj] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += i + 1 + ' 0 obj\n' + obj + '\nendobj\n';
  }
  const start = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.map(x => String(x).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF';
  const r = await extractDocument(Buffer.from(pdf));
  assert.equal(r.validation, 'PASS', JSON.stringify(r.issues));
  assert.deepEqual(r.result.rows.map(row => [row.current_period_value.value, row.previous_period_value.value]), [[34567, 12500], [34567, 12500]]);
});

test('Raw unit survives extraction and amounts are never silently rescaled; conflicting word and OKEI are rejected',()=>{
  const entries=[...row('1600',165,[['785',135],['700',238]]),...row('1700',146,[['785',135],['700',238]])];
  for(const [printed,unit] of [['руб. по ОКЕИ 383','₽'],['млн ₽ по ОКЕИ 385','млн ₽'],['тыс. руб. по ОКЕИ 384','тыс. ₽']]){
    const r=inspect(entries,[...meta.slice(0,-1),'Единица измерения: '+printed]);
    assert.equal(r.status,'PASS');assert.equal(r.result.metadata.unit.value,unit);assert.equal(r.result.metadata.raw_unit.value,printed);
    assert.equal(r.result.rows[0].current_period_value.value,785);
  }
  const r=inspect(entries,[...meta.slice(0,-1),'Единица измерения: млн ₽ по ОКЕИ 384']);
  assert.notEqual(r.status,'PASS');assert.equal(r.result.metadata.unit.value,null);assert.equal(r.result.rows[0].current_period_value.value,null);
});
