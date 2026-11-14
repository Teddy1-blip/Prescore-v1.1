// Exercise the built dashboard against native auth, application APIs and an isolated migrated PostgreSQL.
import assert from 'node:assert/strict';
import {dossierBrowser} from './dossier-browser.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { chromium } from 'playwright';
import { corpusFiles } from '../../lib/credit-engine/credit-lab/business-corpus.mjs';
const sectionRoutes = [
  'home',
  'bfo',
  'calendar',
  'analyst',
  'banking',
  'analysis',
  'obligations',
  'counterparties',
  'financing',
  'applications',
  'documents',
  'actions',
  'billing',
];
const origin = process.env.PRESCORE_BASE_URL,
  db = new URL(process.env.DATABASE_URL);
if (
  process.env.RC_TEST_DATABASE !== 'true' ||
  db.hostname !== '127.0.0.1' ||
  !db.pathname.startsWith('/prescore_rc') ||
  !origin?.startsWith('http://127.0.0.1:')
)
  throw Error('Isolated local RC database required');
const pool = new pg.Pool({ connectionString: db.href }),
  out = path.resolve(process.argv[2]),
  checks = [];
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    ...(process.env.QA_HEADLESS_SHELL === '1' ? ['--no-zygote', '--single-process'] : []),
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } }),
  page = await ctx.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(18000);
const roleName = 'approved' + randomUUID().slice(0, 6),
  password = 'Local-demo-' + randomUUID();
const ownerRole = roleName + 'owner',
  partnerRole = roleName + 'partner';
const cookies = {};
async function req(endpoint, role, body, method) {
  const multipart = body instanceof FormData;
  const r = await fetch(origin + endpoint, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    redirect: 'manual',
    headers: {
      origin,
      ...(cookies[role] ? { cookie: cookies[role] } : {}),
      ...(body === undefined || multipart ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  return r;
}
async function json(endpoint, role, body, status = 200) {
  const r = await req(endpoint, role, body);
  assert.equal(
    r.status,
    status,
    endpoint + ' ' + r.status + ' ' + (r.status === status ? '' : (await r.text()).slice(0, 240)),
  );
  assert.match(r.headers.get('content-type') ?? '', /json/, endpoint + ' expected JSON');
  const data = await r.text();
  assert.ok(data.length, endpoint + ' returned an empty body');
  return JSON.parse(data);
}
async function login(role) {
  const r = await req('/api/auth/sign-in/email', role, { email: role + '@rc.test', password });
  assert.equal(r.status, 200, 'login');
  cookies[role] = r.headers
    .getSetCookie()
    .map((s) => s.split(';')[0])
    .join('; ');
}
async function signup(role) {
  const email = role + '@rc.test';
  await json('/api/auth/sign-up/email', role, {
    email,
    password,
    name: 'Учебная компания',
    callbackURL: '/login',
  });
  const mail = (
    await pool.query('SELECT body FROM rc_mailbox WHERE recipient=$1 ORDER BY created_at DESC LIMIT 1', [
      email,
    ])
  ).rows[0];
  assert.equal(new URL(mail.body).origin, origin);
  const verified = await fetch(mail.body, { redirect: 'manual' });
  assert.equal(verified.status, 302);
  await login(role);
}
async function signInAsRole(role) {
  await ctx.clearCookies();
  if (cookies[role])
    await ctx.addCookies(
      cookies[role].split('; ').map((item) => ({
        url: origin,
        name: item.slice(0, item.indexOf('=')),
        value: item.slice(item.indexOf('=') + 1),
        httpOnly: true,
        sameSite: 'Lax',
      })),
    );
}
function ok(label) {
  checks.push(label);
  console.log('PASS ' + label);
}
const nav = (name) =>
  page.getByRole('navigation', { name: 'Разделы кабинета' }).getByRole('link', { name, exact: true });
const waitModel = () => page.waitForSelector('.approved-client .client-hero');
try {
  await fs.mkdir(out, { recursive: true });
  await signup(ownerRole);
  await page.goto(origin + '/login');
  const loginForm = page.getByRole('form', { name: 'Вход', exact: true });
  await loginForm.getByLabel('Электронная почта').fill(ownerRole + '@rc.test');
  const loginPassword = loginForm.getByLabel('Пароль', { exact: true });
  await loginPassword.fill(password);
  const toggle = loginForm.getByRole('button', { name: 'Показать пароль' });
  await toggle.focus();
  await page.keyboard.press('Space');
  assert.equal(await loginPassword.getAttribute('type'), 'text');
  await loginForm.getByRole('button', { name: 'Скрыть пароль' }).press('Enter');
  assert.equal(await loginPassword.getAttribute('type'), 'password');
  await loginForm.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/dashboard**');
  ok('Вход клиента через форму и управление видимостью пароля с клавиатуры');
  await page.goto(origin + '/dashboard?view=counterparties');
  await page.getByRole('heading', { name: 'Контрагенты', exact: true }).waitFor();
  await page.getByRole('button',{name:'Сохранить компанию в досье'}).waitFor();
  ok('Пустой кабинет и Контрагенты без выписки');
  const files = corpusFiles(),
    dir = 'CL-RU-BUS-001/',
    seed = JSON.parse(Buffer.from(files[dir + 'case.json']).toString('utf8'));
  // Align the synthetic bank fixture with a calendar-year BFO. Preserve its original TXT encoding.
  const annualFiles = seed.bankDocuments.map(d => {
    const original = Buffer.from(files[dir + d.path]).toString('latin1');
    const shifted = original.replace(/(\d{2})\.(\d{2})\.(20\d{2})/g, (_, day, month, year) => {
      const last = new Date(Date.UTC(+year, +month, 0)).getUTCDate();
      const targetEnd = new Date(Date.UTC(+year, +month - 6, 0));
      const targetDay = +day === last ? targetEnd.getUTCDate() : Math.min(+day, targetEnd.getUTCDate());
      return [targetDay, targetEnd.getUTCMonth() + 1, targetEnd.getUTCFullYear()].map(v=>String(v).padStart(2,'0')).join('.');
    });
    return {name: path.basename(d.path), mimeType:'text/plain', buffer:Buffer.from(shifted,'latin1')};
  });
  const statements = annualFiles.map(f => ({fileName:f.name, text:new TextDecoder('windows-1251').decode(f.buffer)}));
  const create = async (statements) => (await json('/api/analysis', ownerRole, { statements })).analysis;
  await page.goto(origin + '/dashboard?view=upload');
  await page.locator('.pc-statement-upload input[type=file]').setInputFiles(annualFiles);
  const accepted = page.waitForResponse(r => new URL(r.url()).pathname === '/api/analysis' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Рассчитать по выбранным файлам' }).click();
  const responseA = await accepted;
  assert.ok(responseA.ok(), 'TXT upload HTTP ' + responseA.status());
  const { analysis: A } = await responseA.json();
  assert.ok(A?.id, 'server analysisId');
  ok('Загрузка синтетической выписки TXT через браузер с выдачей analysisId');
  const B = await create(statements.map((s) => ({ ...s, text: s.text.replaceAll(A.companyInn, '9900002999') })));
  assert.notEqual(B.id, A.id);
  const endpoint = '/api/workspace-model?analysisId=' + A.id;
  const basic = await json(endpoint, ownerRole);
  assert.equal(basic.entitlement, 'BASIC');
  assert.equal(basic.full, undefined);
  await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=home');
  await waitModel();
  assert.match(await page.locator('.client-hero').innerText(), /FULL/);
  await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=actions');
  const basicPlan = page.locator('.approved-canonical-section');
  await basicPlan.locator('.ws-upgrade').waitFor();
  assert.equal(await basicPlan.locator('.pc-timeline').count(), 0);
  await nav('Обзор').click();
  ok('BASIC показывает банковские факты и ограничивает доступ к полному плану');
  await pool.query(
    "UPDATE analysis_entitlements SET tier='FULL',granted_by='TEST_ONLY' WHERE analysis_id=$1",
    [A.id],
  );
  const full = await json(endpoint, ownerRole);
  assert.equal(full.entitlement, 'FULL');
  assert.deepEqual(full.full.report.reconciliation.bankBfo, []);
  await page.reload();
  await waitModel();
  assert.equal(
    (await page.locator('.score-number').innerText()).replace(/\s/g, ''),
    String(full.full.report.index.value?.value ?? '—') + '/1000',
  );
  await nav('Кредитный профиль').click();
  await page
    .getByRole('heading', { name: (full.full.report.index.value?.value ?? '—') + ' / 1000', exact: true })
    .waitFor();
  // The financial diagnosis must be visible to the client and must not impersonate a lender's decision.
  await page.getByRole('heading', { name: 'Финансово-кредитное заключение Prescore', exact: true }).waitFor();
  await page.getByText(/независимая финансовая диагностика компании/).first().waitFor();
  await page.getByRole('heading', { name: 'Направления финансирования', exact: true }).waitFor();
  assert.equal(await page.getByText(/банк откажет|вероятность отказа|заявка отклонена/i).count(), 0);
  const suggested = full.full.report.productFit?.primary ?? [];
  for (const product of suggested.slice(0, 3)) {
    await page.getByRole('heading', { name: product.title, exact: true }).first().waitFor();
  }
  if (!suggested.length) {
    await page.getByText('Уточните цель, сумму и срок финансирования.', { exact: false }).waitFor();
  }
  ok('Заключение отличает Prescore от решения банка и показывает только рассчитанные направления');
  ok('Index совпадает в Обзоре, Кредитном профиле и серверном снимке');
  const names = [
    'Обзор',
    'БФО',
    'Контрагенты',
    'Кредитный портфель',
    'Платёжный календарь',
    'Кредитный профиль',
    'Досье клиента',
    'Финансирование',
    'Кредитный эксперт',
  ];
  for (const name of names) {
    await nav(name).click();
    await page.waitForFunction(
      (n) => document.querySelector('nav a[aria-current=page]')?.textContent === n,
      name,
    );
  }
  await page.goBack();
  await page.getByRole('heading', { name: 'Финансирование бизнеса' }).waitFor();
  await page.goForward();
  await page.getByRole('heading', { name: 'Кредитный эксперт' }).first().waitFor();
  await nav('Подписка').click();
  await page.getByRole('heading', { name: 'Подписка компании' }).first().waitFor();
  ok('Все разделы, глубокие ссылки, Back/Forward');
  await page.getByLabel('Компания', { exact: true }).selectOption(B.id);
  await page.getByLabel('Компания', { exact: true }).selectOption(A.id);
  await nav('Обзор').click();
  await waitModel();
  assert.ok(page.url().includes(A.id));
  ok('Смена A → B → A');
  const fault = (url) =>
    url.pathname === '/api/workspace-model' && url.searchParams.get('analysisId') === A.id;
  let started, release, finished;
  const delayed = new Promise((r) => (started = r)),
    gate = new Promise((r) => (release = r)),
    served = new Promise((r) => (finished = r));
  const delayedResponse = async (route) => {
    try {
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
} finally {
      finished();
    }
  };
  await page.getByLabel('Компания', { exact: true }).selectOption(B.id);
  await waitModel();
  await page.route(fault, delayedResponse);
  await page.getByLabel('Компания', { exact: true }).selectOption(A.id);
  await delayed;
  await page.getByLabel('Компания', { exact: true }).selectOption(B.id);
  await waitModel();
  release();
  await served;
  await page.unroute(fault, delayedResponse);
  assert.match(await page.locator('.client-hero').innerText(), /FULL/);
  assert.equal((await page.locator('.score-number').innerText()).replace(/\s/g, ''), '—/1000');
  ok('Задержанный ответ FULL-компании не меняет выбранный BASIC-кабинет');
  const failModel = (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  await page.route(fault, failModel);
  await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=home');
  await page.getByRole('button', { name: 'Повторить', exact: true }).waitFor();
  await page.unroute(fault, failModel);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await waitModel();
  assert.equal(
    (await page.locator('.score-number').innerText()).replace(/\s/g, ''),
    String(full.full.report.index.value?.value ?? '—') + '/1000',
  );
  ok('Временный отказ модели и повторная загрузка с сервера');
  await nav('Кредитный портфель').click();
  await page.getByRole('heading', {name:'Обслуживание долга по выпискам'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('analysisId'), A.id);
  await page.reload();
  await page.getByRole('heading', {name:'Обязательства по договорам'}).waitFor();
  ok('Прямой переход и reload открывают DebtPortfolio выбранной компании');
  const months = full.basic.bankingFacts.monthly ?? [];
  if (months.length) {
    const month = months.at(-1).month;
    await page.getByLabel('Период', { exact: true }).selectOption(month);
    await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=banking&bankMonth=' + month);
    await page.getByRole('heading', { name: 'Месячные итоги' }).waitFor();
    assert.equal(await page.getByRole('table', { name: 'Месячные итоги' }).locator('tbody tr').count(), 1);
    await page.reload();
    await page.waitForFunction(
      (m) => document.querySelector('select[aria-label="Период"]')?.value === m,
      month,
    );
    ok('Банковский период сохраняется после reload');
  }
  await page.getByRole('button', { name: 'Подготовить заявку', exact: false }).first().click();
  await page.getByRole('spinbutton', { name: 'Сумма, ₽' }).fill('453210');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await page.getByRole('table', { name: 'Заявки компании' }).waitFor();
  let ws = await json('/api/workspace', ownerRole);
  const deal = ws.deals.find((d) => d.analysisId === A.id && d.amount === 453210);
  assert.ok(deal);
  await json('/api/workspace', ownerRole, { type: 'deal', deal });
  ws = await json('/api/workspace', ownerRole);
  assert.equal(ws.deals.filter((d) => d.id === deal.id).length, 1);
  await page.reload();
  await page.getByRole('table', { name: 'Заявки компании' }).waitFor();
  await page.getByLabel('Компания', { exact: true }).selectOption(B.id);
  await page.getByRole('heading', { name: 'Соберём первое обращение' }).waitFor();
  ok('Заявка в PostgreSQL, повтор запроса, reload и изоляция компании');
  await page.getByLabel('Компания', { exact: true }).selectOption(A.id);
  await nav('Досье клиента').click();
  for (const id of ['source-bfo', 'source-quarterly', 'source-bki'])
    await page.locator('form#' + id).waitFor({ state: 'visible' });
  const quarter =
    'Бухгалтерская отчетность за Январь - Март 2026 г.\nОрганизация ООО Синтетическая компания\nИНН ' +
    A.companyInn +
    '\nЕдиница измерения: тыс. руб.\nОборотные активы 1200 600\nБАЛАНС 1600 1000\nКапитал и резервы 1300 500\nДолгосрочные обязательства 1400 200\nКраткосрочные обязательства 1500 300\nКредиторская задолженность 1520 200\nВыручка 2110 1200\nЧистая прибыль 240';
  const form = page.locator('form#source-quarterly');
  await form
    .locator('input[type=file]')
    .setInputFiles({ name: 'synthetic-quarter.csv', mimeType: 'text/csv', buffer: Buffer.from(quarter) });
  await form.getByRole('checkbox').check();
  const response = page.waitForResponse(
    (r) => r.url().includes('/api/source-documents') && r.request().method() === 'POST',
  );
  await form.locator('button[type=submit],button:not([type])').last().click();
  assert.ok((await response).ok());
  await form
    .getByText(/Документ добавлен/)
    .first()
    .waitFor();
  await nav('БФО').click();
  await page.getByRole('heading', { name: 'Бухгалтерская финансовая отчётность', exact: true }).first().waitFor();
  const updated = await json(endpoint, ownerRole);
  assert.ok(updated.full.report.financialAnalysis?.history.length);
  await page.locator('.pc-metric-group summary').first().click();
  await page.getByRole('table', { name: 'Финансовые показатели' }).first().waitFor();
  ok('Загрузка квартального CSV и обновление БФО на соседней вкладке');
  await nav('Досье клиента').click();
  const bfoForm = page.locator('form#source-bfo');
  const annual = quarter.replace('за Январь - Март 2026 г.', 'за 2025 год')
    + '\nДенежные средства и денежные эквиваленты 1250 850\nДебиторская задолженность 1230 320';
  await bfoForm.locator('input[type=file]').setInputFiles({name:'synthetic-annual.csv',mimeType:'text/csv',buffer:Buffer.from(annual)});
  await bfoForm.getByRole('checkbox').check();
  const saved = page.waitForResponse(r=>new URL(r.url()).pathname==='/api/source-documents' && r.request().method()==='POST');
  await bfoForm.locator('button[type=submit],button:not([type])').last().click();
  assert.ok((await saved).ok(), 'BFO upload');
  await bfoForm.getByText(/Документ добавлен/).first().waitFor();
  const combined = (await json(endpoint,ownerRole)).full.report;
  const rows = combined.reconciliation.bankBfo;
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>row.difference!==null && row.bank.sourceIds.length && row.accounting.sourceIds.length));
  const revenue = rows.find(row=>row.accounting.label.includes('2110'));
  assert.equal(revenue.accounting.value,1200000);
  assert.equal(revenue.difference,Math.abs(revenue.bank.value-1200000));
  assert.ok(revenue.context.some(f=>f.value===320000 && f.period.asOf==='2025-12-31'));
  assert.equal(rows.find(row=>row.accounting.label.includes('1250')).accounting.value,850000);
  await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=banking');
  await page.getByRole('link', {name:/Сверка выписок и БФО/}).click();
  const comparison = page.getByTestId('bank-bfo');
  await comparison.waitFor();
  const normalized = text => text.replace(/\s+/g,' ').trim();
  const displayed = normalized(await comparison.innerText());
  const factLines = locator => locator.locator('h2,h3,dt,dd,article > p').allTextContents();
  const financeLines = await factLines(comparison);
  await comparison.screenshot({path:path.join(out,"bank-bfo-synthetic.png")});
  for(const row of rows) for(const fact of [row.bank,row.accounting]) {
    assert.ok(displayed.includes(fact.sourceIds[0]));
    assert.ok(displayed.includes(normalized(new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(fact.value))));
  }
  await nav('Кредитный профиль').click();
  await page.getByRole('button',{name:'Сверка',exact:true}).click();
  assert.equal(normalized(await comparison.innerText()),displayed);
  const creditTabs=page.getByRole('navigation',{name:'Разделы анализа'});
  for(const [tab,heading] of [
    ['Стоп-факторы и риски', 'Что мешает рассчитать Prescore Index'],
    ['Долговая ёмкость','Основания и ограничения долговой ёмкости'],
    ['Рекомендации','Приоритетные рекомендации'],
  ]) {
    await creditTabs.getByRole('button',{name:tab,exact:true}).click();
    await page.getByRole('heading',{name:heading,exact:true}).waitFor();
  }
  await nav('Обзор').click();
  await page.getByText('Не подтверждён юридический статус компании', {exact:false}).first().waitFor();
  await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=actions');
  for(const horizon of combined.actionPlan.horizons) {
    const block=page.locator('.pc-panel').filter({has:page.getByRole('heading',{name:new RegExp(horizon.title)})});
    await block.first().waitFor();
    assert.equal(await block.locator('.pc-timeline > li').count(),horizon.items.length);
    for (const item of horizon.items) {
      assert.ok(await block.locator('[id="'+item.id+'"]').count());
    }
  }
  await page.locator('.pc-timeline').getByRole('button',{name:'Почему?'}).first().click();
  await page.getByRole('dialog',{name:'Основания вывода'}).waitFor();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  ok('Канонические причины отсутствующего Index, риски, долговая ёмкость и все пункты 7/30/60 со связанным основанием');
  const printPath = '/dashboard/report-v2?' + new URLSearchParams({analysisId:A.id,snapshotId:combined.meta.snapshot.snapshotId,print:'1'});
  const printPage = await ctx.newPage();
  await printPage.goto(origin+printPath);
  await printPage.getByRole('button',{name:'Печать / сохранить PDF'}).waitFor({state:'visible'});
  await printPage.getByText(/Контрольная цифра ИНН в досье неверна/).waitFor();
  await printPage.emulateMedia({media:'print'});
  const printed = printPage.getByTestId('bank-bfo');
  await printed.waitFor();
  assert.deepEqual(await factLines(printed),financeLines);
  const pdf = await printPage.pdf({path:path.join(out,'synthetic-client-report.pdf'),format:'A4',printBackground:true});
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  await printPage.close();
  ok('Выписки → годовая БФО: суммы и источники совпадают в Финансах, Кредитном профиле и печатном снимке PDF');
  await pool.query("UPDATE analysis_entitlements SET tier='FREE' WHERE analysis_id=$1",[A.id]);
  assert.equal((await json(endpoint,ownerRole)).full,undefined);
  assert.doesNotMatch(await (await req(printPath,ownerRole)).text(), /data-testid="bank-bfo"/);
  await pool.query("UPDATE analysis_entitlements SET tier='FULL' WHERE analysis_id=$1",[A.id]);
  ok('BASIC не раскрывает сверку и сохранённый полный выпуск');
  await nav('Досье клиента').click();
  await page.getByRole('button', { name: 'Новый анализ по выпискам' }).click();
  await page.locator('input[type=file]').first().waitFor({ state: 'attached' });
  assert.ok(!new URL(page.url()).searchParams.has('analysisId'));
  ok('Из существующего досье доступен новый анализ по выпискам');
  const screenshotDir = path.join(out, 'integrated');
  await fs.mkdir(screenshotDir, { recursive: true });
  for (const [size, width, height] of [
    ['desktop', 1440, 1100],
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const key of sectionRoutes) {
      await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=' + key);
      if (key === 'analyst') await page.getByRole('heading', { name: 'Кредитный аналитик Prescore' }).waitFor();
      else await page.locator('.approved-client .client-hero,.approved-client .card,.approved-client .pc-panel').first().waitFor();
      await page.waitForFunction(
        () => document.querySelector("select[aria-label='Период']")?.options.length > 1,
      );
      if (key === 'billing')
        await page.getByRole('heading', { name: 'Подписка компании', exact: true }).first().waitFor();
      const layout = await page.evaluate(() => {
        const width = document.documentElement.scrollWidth;
        const viewport = innerWidth;
        if (width <= viewport) return { width, viewport, outside: [] };
        const outside = Array.from(document.querySelectorAll('main *')).filter((element) => {
          if (element.getBoundingClientRect().right <= viewport + 1) return false;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)
              && parent.getBoundingClientRect().right <= viewport + 1) return false;
          }
          return true;
        }).slice(0, 10).map((el) => el.tagName + '.' + el.className);
        return { width, viewport, outside };
      });
      assert.ok(layout.width <= layout.viewport, 'overflow ' + size + ' ' + key + ' ' + JSON.stringify(layout));
      if (key === 'home') {
        const height = await page.locator('.client-hero').evaluate((el) => el.getBoundingClientRect().height);
        assert.ok(
          height < (size === 'desktop' ? 500 : 650),
          'public landing styles changed the dashboard hero: ' + height,
        );
      }
      await page.screenshot({
        path: path.join(screenshotDir, size + '-' + key + '.png'),
        animations: 'disabled',
      });
    }
  }
  const mobileMenu = page.getByRole('button', { name: 'Открыть меню' });
  await mobileMenu.press('Enter');
  await page.waitForFunction(() => Boolean(document.activeElement?.closest('nav')));
  await page.keyboard.press('Escape');
  assert.ok(await mobileMenu.evaluate((button) => document.activeElement === button));
  await mobileMenu.click();
  await nav('Досье клиента').click();
  await page.locator('form#source-bfo').waitFor({ state: 'visible' });
  ok('Мобильное меню, переход в Документы и возврат фокуса при Escape');
  await page.setViewportSize({ width: 1440, height: 1100 });
  ok(3*sectionRoutes.length+' снимков защищённого кабинета с сервером, без горизонтального переполнения');
  await signup(partnerRole);
  assert.ok([403, 404].includes((await req(endpoint, partnerRole)).status));
  const foreignRevision = await req('/api/workspace-model?'+new URLSearchParams({
    analysisId:A.id,projection:'decision-revision',snapshotId:combined.meta.snapshot.snapshotId,
  }),partnerRole);
  assert.equal(foreignRevision.status,404);
  await signInAsRole(partnerRole);
  await page.goto(origin+printPath);
  // Next can stream its layout with 200 before the protected server page resolves notFound().
  await page.getByRole('heading',{name:'404',exact:true}).waitFor();
  assert.equal(await page.locator('.cr-report, [data-testid="bank-bfo"]').count(),0);
  assert.ok(!(await page.locator('body').innerText()).includes(A.companyName));
  await page.goto(origin+'/dashboard?view=analysis&analysisId='+A.id);
  await page.getByText(/Этот анализ больше недоступен/).waitFor();
  assert.equal(await page.getByTestId('bank-bfo').count(),0);
  ok('Второй авторизованный клиент без выдачи доступа не может прочитать чужой анализ и замороженный PDF');
  await json('/api/agent', partnerRole, { type: 'connect', consent: true, offerAccepted: true }, 201);
  await json(
    '/api/workspace',
    ownerRole,
    {
      type: 'broker-authorization',
      operation: 'grant',
      analysisId: A.id,
      brokerEmail: partnerRole + '@rc.test',
      purpose: 'DOSSIER',
      confirmed: true,
      days: 30,
      requestId: randomUUID(),
    },
    201,
  );
  const shared = await json(endpoint, partnerRole);
  assert.equal(shared.access.readOnly, true);
  await signInAsRole(partnerRole);
  await page.goto(origin + '/dashboard?client=' + A.id + '&from=agent&view=applications');
  await page.getByRole('table', { name: 'Заявки компании' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Подготовить заявку' }).count(), 0);
  assert.equal(
    (await req('/api/workspace', partnerRole, { type: 'deal', deal: { ...deal, id: randomUUID() } })).status,
    403,
  );
  ok('Чужое досье запрещено, согласованный партнёр только читает');
  await signInAsRole(ownerRole);
  await page.goto(origin + '/dashboard?analysisId=' + A.id);
  await waitModel();
  await json('/api/auth/sign-out', ownerRole, {});
  assert.equal((await req(endpoint, ownerRole)).status, 401);
  await page.reload();
  await page.waitForURL('**/login**');
  await login(ownerRole);
  await signInAsRole(ownerRole);
  await page.goto(origin + '/dashboard?analysisId=' + A.id + '&view=applications');
  await page.getByRole('table', { name: 'Заявки компании' }).waitFor();
  ok('Истечение сессии и сохранность после повторного входа');
  assert.deepEqual(errors, []);
  ok('Без ошибок JavaScript');
  await page.setViewportSize({width:1440,height:1100});
  await dossierBrowser({page,pool,out,origin,signup,signInAsRole,roleName,ok});
} finally {
  await fs.writeFile(path.join(out, 'integration.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
  await pool.end();
}
