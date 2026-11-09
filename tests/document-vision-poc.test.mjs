import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocument } from '../lib/document-poc/extract.ts';
import { configuredVisionProvider, DeepSeekProvider } from '../lib/ai/providers/index.ts';
import { createCanvas } from '@napi-rs/canvas';
import { syntheticAgreement } from '../scripts/document-poc.mjs';
const scan = syntheticAgreement();
const financial = ['Бухгалтерский баланс', 'Организация: Учебная компания', 'ИНН: 7707083893', 'Отчётная дата: 31.12.2025', 'Отчётный период: 2025', 'Предыдущая дата: 31.12.2024', 'Единица измерения: тыс. ₽', 'Активы | 1600 | 1500 | 1200', 'Баланс | 1700 | 1500 | 1200', 'Деньги | 1250 | | 15'];
const agreement = ['Кредитный договор', 'Кредитор: Тестовый банк', 'Заёмщик: Учебная компания', 'Номер договора: QA-01', 'Дата договора: 01.10.2026', 'Валюта: RUB', 'Сумма кредита: 50 000 ₽', 'Тип ставки: переменная', 'Формула ставки: ключевая ставка + 2 п.п.', 'Поручительство: нет', 'Ковенант: DSCR не менее 1,25 ежеквартально', 'Ковенант: поддерживать число учебных площадок', 'График платежей', 'Дата | Основной долг | Проценты | Комиссии | Итого', '10.11.2026 | 100 | 10 | 0 | 110'];
function provider(lines) {
  return {
    extractVision: async () => JSON.stringify({
      lines: lines.map(text => typeof text === 'string' ? {
        text,
        confidence: 'HIGH'
      } : text)
    })
  };
}
const read = lines => extractDocument(scan, {
  vision: provider(lines),
  allowVision: true
});
test('BFO has bound row values, current and comparative periods, units and provenance', async () => {
  const r = await read(financial.slice(0, -1)),
    row = r.result.rows[0];
  assert.equal(r.validation, 'PASS');
  assert.equal(r.result.metadata.inn.value, '7707083893');
  assert.deepEqual([row.line_code.value, row.current_period_value.value, row.previous_period_value.value, row.period.value, row.previous_period.value, row.unit.value], ['1600', 1500, 1200, '2025-12-31', '2024-12-31', 'тыс. ₽']);
  assert.equal(row.source_page, 1);
  assert.equal(row.document_id, r.document_id);
  for (const f of [row.line_code,row.current_period_value,row.previous_period_value,row.period,row.previous_period,row.unit]) {
    assert.equal(f.source_page, 1);
    assert.equal(f.document_id, r.document_id);
    assert.equal(f.extractor_version, r.extractor_version);
  }
  const blank = (await read(financial)).result.rows.at(-1);
  assert.equal(blank.current_period_value.value, null);
  assert.equal(blank.previous_period_value.value, 15);
});
test('financial validation rejects invalid codes, duplicate rows, conflicting periods and arithmetic', async () => {
  for (const [lines, code] of [[[...financial, 'Строка | 1999 | 1 | 2'], 'UNKNOWN_LINE_CODE'], [[...financial, financial.at(-1)], 'DUPLICATE_LINE'], [financial.map(s => s.replace('1700 | 1500', '1700 | 9500')), 'BALANCE_RECONCILIATION_MISMATCH'], [financial.map(s => s.replace('31.12.2024', '31.12.2026')), 'PERIOD_ORDER']]) {
    const r = await read(lines);
    assert.equal(r.validation, 'INVALID');
    assert.ok(r.issues.some(x => x.code === code));
  }
});
test('missing date, unknown units and low confidence stay unconfirmed', async () => {
  const r = await read(financial.filter(s => !s.startsWith('Отчётная дата')).map(s => s.includes('1600') ? {
    text: s,
    confidence: 'LOW'
  } : s.replace('тыс. ₽', '?')));
  assert.equal(r.validation, 'REVIEW');
  assert.equal(r.result.metadata.reporting_date.value, null);
  assert.equal(r.result.metadata.unit.value, null);
  assert.equal(r.result.rows[0].current_period_value.value, null);
  assert.equal(r.result.rows[0].current_period_value.status, 'REVIEW');
});
test('agreement distinguishes committed amounts, limit and rate; known/unmapped covenants and simple schedule', async () => {
  const r = await read(agreement),
    a = r.result;
  assert.equal(a.type, 'CreditAgreementExtractionV1');
  assert.equal(r.validation, 'REVIEW');
  assert.equal(a.terms.credit_amount.value, 50000);
  assert.equal(a.terms.credit_limit.value, null);
  assert.equal(a.terms.rate_type.value, 'VARIABLE');
  assert.equal(a.terms.interest_rate.value, null);
  assert.equal(a.terms.guarantor_presence.value, false);
  assert.deepEqual(a.covenants.map(c => c.covenant_code.value), ['DSCR', 'UNMAPPED_COVENANT']);
  assert.equal(a.covenants[0].threshold.value, 1.25);
  assert.equal(a.covenants[0].deadline_frequency.value, 'ежеквартально');
  assert.match(a.covenants[1].condition.source_text, /площадок/);
  assert.equal(a.terms.schedule_presence.value, true);
  assert.deepEqual(a.schedule.pages, [1]);
  assert.equal(a.schedule.rows[0].fees.value, 0);
  assert.equal(a.schedule.rows[0].total.value, 110);
});
test('malformed provider JSON, unavailable, failure, timeout and disabled state never produce data', async () => {
  for (const [fn, code] of [[async () => '{', 'VISION_SCHEMA_INVALID'], [async () => '{"lines":[{"text":"55","confidence":1}]}', 'VISION_SCHEMA_INVALID'], [async () => {
    throw Error('PRIVATE');
  }, 'VISION_PROVIDER_FAILED'], [() => new Promise(() => {}), 'VISION_TIMEOUT']]) {
    const r = await extractDocument(scan, {
      allowVision: true,
      timeoutMs: 20,
      vision: {
        extractVision: fn
      }
    });
    assert.equal(r.result, null);
    assert.ok(r.issues.some(x => x.code === code));
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE/);
  }
  let called = false;
  const r = await extractDocument(scan, {
    vision: {
      extractVision: async () => {
        called = true;
      }
    }
  });
  assert.equal(called, false);
  assert.equal(r.result, null);
});
test('DeepSeek sends only one allowed image to the configured host, uses the Vision model, and never follows redirects', async () => {
  let body;
  const client = new DeepSeekProvider({
    apiKey: 'fixture',
    model: 'fixture-vision',
    baseUrl: 'https://api.deepseek.com'
  }, async (url, ops) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(ops.redirect, 'error');
    body = JSON.parse(ops.body);
    return Response.json({
      choices: [{
        message: {
          content: '{"lines":[]}'
        }
      }]
    });
  });
  await client.extractVision({
    mime: 'image/png',
    bytes: scan
  }, new AbortController().signal);
  assert.equal(body.model, 'fixture-vision');
  assert.match(body.messages[1].content[0].image_url.url, /^data:image\/png;base64,/);
  assert.equal(configuredVisionProvider({
    AI_PROVIDER: 'local',
    DEEPSEEK_API_KEY: 'test',
    DEEPSEEK_VISION_MODEL: 'test'
  }), null);
  assert.throws(() => configuredVisionProvider({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test',
    DEEPSEEK_VISION_MODEL: 'test',
    DEEPSEEK_BASE_URL: 'https://elsewhere.invalid'
  }));
});
// Minimal synthetic two-page PDF. The second page has no usable text layer.
function pdfFixture() {
  const stream = 'BT /F1 12 Tf 20 150 Td (CREDIT AGREEMENT) Tj 0 -22 Td (Borrower: Synthetic Example) Tj ET';
  const raster = createCanvas(520, 140),
    ctx = raster.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 520, 140);
  ctx.fillStyle = 'black';
  ctx.font = '32px DejaVu Sans';
  ctx.fillText('Credit limit: 1200', 12, 70);
  const jpeg = raster.toBuffer('image/jpeg').toString('latin1'),
    draw = 'q 280 0 0 90 10 60 cm /Scan Do Q';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 200] /Resources << /XObject << /Scan 8 0 R >> >> /Contents 7 0 R >>', '<< /Length ' + draw.length + ' >>\nstream\n' + draw + '\nendstream', '<< /Type /XObject /Subtype /Image /Width 520 /Height 140 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n' + jpeg + '\nendstream'];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, o] of objs.entries()) {
    offsets.push(pdf.length);
    pdf += i + 1 + ' 0 obj\n' + o + '\nendobj\n';
  }
  const pos = pdf.length;
  pdf += 'xref\n0 9\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n' + pos + '\n%%EOF';
  return Buffer.from(pdf, 'latin1');
}
test('mixed PDF reuses existing text extraction; only the second page is rendered and OCRed', async () => {
  let calls = 0;
  const r = await extractDocument(pdfFixture(), {
    allowVision: true,
    vision: {
      extractVision: async image => {
        calls++;
        assert.equal(image.bytes[0], 137);
        return provider(['Credit limit: 1200']).extractVision();
      }
    }
  });
  assert.deepEqual(r.pages.map(p => p.method), ['TEXT', 'VISION']);
  assert.equal(calls, 1);
  assert.equal(r.result.terms.borrower.source_page, 1);
  assert.equal(r.result.terms.credit_limit.source_page, 2);
});
test('Synthetic financial Vision smoke verifies the fields and returns only safe receipt data',async()=>{
  const {financialSmoke}=await import('../scripts/document-poc.mjs');
  const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'fake-unit-test-key',DEEPSEEK_VISION_MODEL:'mock-vision'};
  let called=0;
  const invoke=async(url,opts)=>{
    called++;assert.equal(url,'https://api.deepseek.com/chat/completions');
    const payload=JSON.parse(opts.body);assert.match(payload.messages[1].content[0].image_url.url,/^data:image\/png;base64,/);
    const lines=['Бухгалтерский баланс','Отчётная дата: 31.12.2024','Отчётный период: 2024','Предыдущая дата: 31.12.2023','Единица измерения: тыс. ₽','Строка | Код | 2024 | 2023','Активы | 1600 | 12345 | 9800','Баланс | 1700 | 12345 | 9800'];
    return Response.json({choices:[{message:{content:await provider(lines).extractVision()}}]});
  };
  const pass=await financialSmoke(env,invoke);assert.equal(called,1);assert.equal(pass.status,'PASS');assert.equal(pass.http,200);assert.equal(pass.fields.length,2);assert.doesNotMatch(JSON.stringify(pass),/fake-unit-test-key|base64/);
  const fail=await financialSmoke(env,async()=>new Response('',{status:403}));assert.equal(fail.status,'FAIL');assert.equal(fail.http,403);assert.equal(fail.fields.length,0);
  assert.equal((await financialSmoke({},invoke)).status,'BLOCKED');assert.equal(called,1);
});
