// Usage: node scripts/qa/approved-client-visual.mjs original.html Prescore_Client.html output-directory
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const [original, preview, output] = process.argv.slice(2);
if (!output) throw Error('Expected the original HTML, built React HTML and output directory');
const screens = [
  ['overview', 'home', 'Ваша финансовая картина'],
  ['finance', 'banking', 'Движение денег'],
  ['credit', 'analysis', 'Кредитный профиль'],
  ['counterparties', 'counterparties', 'Расчёты с покупателями'],
  ['funding', 'financing', 'Финансирование бизнеса'],
  ['applications', 'applications', 'Ваши заявки'],
  ['documents', 'documents', 'Данные компании'],
  ['actions', 'actions', 'Что сделать дальше'],
  ['billing', 'billing', 'Подписка компании'],
];
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    ...(process.env.QA_HEADLESS_SHELL === '1' ? ['--no-zygote', '--single-process'] : []),
  ],
});
const page = await browser.newPage(),
  records = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = (f) => pathToFileURL(path.resolve(f)).href;
const previewPage = async (key) => {
  await page.goto(base(preview) + '#view=' + key);
  await page.locator('.approved-client .card,.approved-client .client-hero').first().waitFor();
};
try {
  for (const [size, width, height] of [
    ['desktop', 1440, 1100],
    ['mobile', 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [side, file] of [
      ['reference', original],
      ['candidate', preview],
    ]) {
      await fs.mkdir(path.join(output, side), { recursive: true });
      for (const [ref, view, title] of screens) {
        await page.goto(base(file) + '#' + (side === 'reference' ? ref : 'view=' + view));
        await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          full: document.documentElement.scrollWidth,
          top: Math.round(document.querySelector('.filters').getBoundingClientRect().bottom),
          cards: document.querySelectorAll('.card').length,
        }));
        assert.equal(geometry.full, width, side + ' ' + view + ' ' + size);
        await page.screenshot({
          path: path.join(output, side, size + '-' + view + '.png'),
          animations: 'disabled',
        });
        records.push({ side, size, key: view, h1: title, ...geometry });
      }
    }
  }
  await previewPage('home');
  const menu = page.getByRole('button', { name: 'Открыть меню' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.closest('nav') !== null);
  await page.keyboard.press('Escape');
  assert.equal(await menu.evaluate((n) => n === document.activeElement), true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const nav = (name) =>
    page
      .getByRole('navigation', { name: 'Разделы кабинета' })
      .getByRole('link', { name, exact: true })
      .click();
  await nav('Контрагенты');
  const table = page.getByRole('table', { name: 'Реестр покупателей' }),
    row = table.locator('tbody tr').first();
  const cells = row.getByRole('cell'),
    amount = await cells.nth(1).innerText(),
    due = await cells.nth(2).innerText();
  await row.getByRole('button').click();
  await page.getByLabel('Обещанная дата оплаты').fill('2026-11-28');
  await page.getByRole('button', { name: 'Зафиксировать обещание' }).click();
  assert.equal(await cells.nth(4).innerText(), '2026-11-28');
  const task = page.getByRole('checkbox').first();
  await task.setChecked(!(await task.isChecked()));
  assert.equal(await cells.nth(1).innerText(), amount);
  assert.equal(await cells.nth(2).innerText(), due);
  await page.getByLabel('Компания', { exact: true }).selectOption('service');
  await page.waitForFunction(() =>
    document.querySelector('tbody tr td:last-child')?.textContent?.includes('Не зафиксировано'),
  );
  await page.getByLabel('Компания', { exact: true }).selectOption('trade');
  await page.getByText('2026-11-28', { exact: true }).waitFor();
  await page.getByLabel('Период', { exact: true }).selectOption('1');
  await nav('Финансы');
  await page.getByRole('heading', { name: 'Месячные итоги' }).waitFor();
  assert.equal(await page.getByRole('table', { name: 'Месячные итоги' }).locator('tbody tr').count(), 1);
  await page.getByRole('button', { name: 'Бухгалтерская отчётность', exact: true }).click();
  await page.getByRole('table', { name: 'Бухгалтерская отчётность' }).waitFor();
  await nav('Финансирование');
  await page.getByRole('button', { name: 'Подготовить запрос' }).last().click();
  assert.equal(await page.getByLabel('Цель / продукт').inputValue(), 'Лизинг');
  await page.getByLabel('Сумма, ₽').fill('100001');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await page.getByRole('table', { name: 'Заявки компании' }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { level: 1, name: 'Финансирование бизнеса' }).waitFor();
  await page.goForward();
  await page.getByRole('table', { name: 'Заявки компании' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Соберём первое обращение' }).waitFor();
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'screens.json'), JSON.stringify(records, null, 2));
  console.log(
    '36 browser screenshots. Standalone file, keyboard, isolated promises/tasks, amounts/due dates, company, period, BFO, product draft and browser history passed.',
  );
} finally {
  await browser.close();
}
