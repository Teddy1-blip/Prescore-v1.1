// Isolated browser acceptance of the source forms, reload and role-specific projections.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { corporation } from '../../tests/fixtures/stage4-external.mjs';
import { statementFixture } from '../../tests/fixtures/block1-statements.mjs';

const out = path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'stage4-external-')));
fs.mkdirSync(out, { recursive: true });
const listener = createServer().listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = 'http://127.0.0.1:' + port;
const server = spawn(
  process.execPath,
  ['--experimental-strip-types', 'scripts/qa/workspace-harness.mjs', path.join(out, 'harness'), String(port)],
  { env: { ...process.env, PRESCORE_QA_EXTERNAL: '1' }, stdio: ['ignore', 'pipe', 'inherit'] },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Workspace startup timed out')), 60000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Workspace QA listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Workspace exited'));
    });
    server.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  browser = await chromium.launch({
    executablePath: process.env.QA_CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const response = await page.request.post(base + '/api/analysis', {
    data: { statements: [{ fileName: 'synthetic.txt', text: statementFixture({ inn: corporation }) }] },
  });
  assert.equal(response.status(), 200);
  const {
    analysis: { id },
  } = await response.json();
  assert.equal((await page.request.get(base + '/__qa/assign?id=' + id + '&full=1')).status(), 200);
  const clientUrl = base + '/dashboard?view=documents&analysisId=' + id;
  const brokerUrl = base + '/agent?view=dossier&analysisId=' + id + '&dossierView=documents';
  const region = (p) => p.getByRole('region', { name: 'Внешние источники' });
  const calls = async () => await (await page.request.get(base + '/__qa/external-calls')).json();
  await page.goto(clientUrl);
  await region(page).getByRole('button', { name: 'Обновить сведения Checko' }).waitFor();
  assert.equal((await calls()).length, 0);
  await region(page).getByRole('button').click();
  await region(page).getByText('Синтетический поставщик', { exact: true }).waitFor();
  assert.equal((await calls()).length, 10);
  await page.reload();
  const broker = await browser.newContext();
  await broker.addCookies([{ name: 'qa-role', value: 'broker', url: base }]);
  const bp = await broker.newPage();
  bp.on('pageerror', (e) => errors.push(e.message));
  await bp.goto(brokerUrl);
  const proofs = [];
  for (const width of [1440, 390]) {
    const facts = [];
    for (const [role, p] of [
      ['client', page],
      ['broker', bp],
    ]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const card = region(p);
      await card.getByText('Синтетический поставщик', { exact: true }).waitFor();
      for (const title of [
        'Компания и реестр',
        'Суды и реестры',
        'Госзакупки',
        'Реестр недобросовестных поставщиков',
      ])
        assert.equal(await card.getByRole('heading', { name: title }).count(), 1);
      for (const title of [
        'Исполнительные производства',
        'Арбитражные дела',
        'Проверки',
        'Записи контрактов',
        'Состояние методов Checko',
      ]) {
        const detail = card
          .locator('details')
          .filter({ has: p.locator('summary').filter({ hasText: new RegExp('^' + title) }) });
        if (!(await detail.evaluate((e) => e.open))) await detail.locator('summary').click();
      }
      const text = await card.innerText();
      for (const pattern of [
        /Прямой ЕИС · не настроен/,
        /Провайдер Checko · первоисточник ЕИС/,
        /Проверки · Ошибка получения/,
        /А-СИН-001/,
        /СИН-44-1/,
        /Всего по ответам · 11/,
        /Текущий статус неизвестен/,
      ])
        assert.match(text, pattern);
      assert.equal(await card.getByRole('button').count(), role === 'broker' ? 0 : 1);
      const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(scrollWidth <= width + 1, 'overflow ' + role + ' ' + scrollWidth + '/' + width);
      await card.screenshot({ path: path.join(out, role + '-' + width + '.png') });
      facts.push(text.replace('Обновить сведения Checko', '').trim());
      proofs.push({ role, width, scrollWidth, receiptCount: (await calls()).length });
    }
    assert.equal(facts[0], facts[1]);
  }
  assert.equal((await calls()).length, 10);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, 'checks.json'),
    JSON.stringify({ proofs, providerMethods: await calls(), liveDirectEis: 'NOT_CONFIGURED' }, null, 2),
  );
  console.log(JSON.stringify(proofs));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
