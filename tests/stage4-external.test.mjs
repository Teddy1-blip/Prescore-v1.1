import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { zipSync } from 'fflate';
import { acquireChecko } from '../lib/external/checko-provider.ts';
import { cachedProfile, lifecycleComparison, profileView } from '../lib/external/checko-profile.ts';
import { parseEisRecords, downloadEisArchive, eisArchiveUrl, archiveXml } from '../lib/external/eis.ts';
import { legalFacts } from '../lib/credit-engine/risk/adapters/legal.ts';
import { LEGAL_REGISTRY_VERSION as verifier } from '../lib/legal-registry.ts';
import {
  checkoDouble,
  corporation as inn,
  entrepreneur,
  eisContract,
  eisInclusion,
  eisExclusion,
  eisXml,
} from './fixtures/stage4-external.mjs';
import { createWorkspaceRuntime } from './fixtures/workspace-runtime.mjs';
import { statementFixture } from './fixtures/block1-statements.mjs';
const acquire = (d, id = inn) => acquireChecko(id, 'isolated-fixture', d.fetcher);
const r = (facts, m) => facts.receipts.find((x) => x.method === m);
const sample = {
  inn,
  retrievedAt: '2026-08-01T10:00:00Z',
  completeCurrentRegister: true,
  rnpRegisterScope: '44-ФЗ',
  origin: 'OFFLINE_SAMPLE',
};
test('Checko method identities, upstream domains, legal amounts and Stage 3 canonical BFO', async () => {
  const d = checkoDouble(),
    { profile: p, raw } = await acquire(d),
    f = p.externalFacts;
  assert.deepEqual(
    d.calls.sort(),
    [
      'company',
      'finances',
      'enforcements',
      'inspections',
      'legal-cases',
      'fedresurs',
      'bankruptcy-messages',
      'timeline',
      'contracts:44',
      'contracts:223',
    ].sort(),
  );
  assert.equal(f.identity.registered, '2018-02-01');
  assert.equal(f.identity.informationDate, '2026-08-01');
  assert.equal(f.identity.lifecycle, 'ACTIVE');
  assert.equal(f.identity.capital, 50000);
  assert.equal(f.identity.founders, 1);
  assert.deepEqual(
    f.enforcements.map((v) => [v.state, v.remaining]),
    [
      ['ACTIVE', 6500],
      ['CLOSED', 50000],
    ],
  );
  assert.equal(f.activeEnforcementRub, 6500);
  assert.deepEqual([f.cases[0].role, f.cases[0].amount, f.cases[0].reference], ['DEFENDANT', 52000, 'А-СИН-001']);
  assert.equal(f.messages[0].category, 'CreditorIntentionGoToCourt');
  assert.equal(f.messages[0].classification, 'REVIEW');
  assert.equal(f.changes[0].date, '2026-03-01');
  assert.equal(r(f, 'inspections').status, 'FAILED');
  assert.equal(r(f, 'bankruptcy-messages').status, 'EMPTY');
  assert.equal(r(f, 'rnp').status, 'NOT_REQUESTED');
  assert.ok(f.receipts.every((x) => x.provider === 'CHECKO' && !x.direct));
  assert.equal(r(f, 'enforcements').authority, 'FSSP');
  assert.equal(r(f, 'contracts:44').authority, 'EIS');
  assert.equal(p.sourceManifest.bfo.provider, 'CHECKO');
  assert.equal(p.financialStatementsV2[0].income.REVENUE.value, 810000);
  assert.equal(p.financialAnalysisV2.latestAnnual.profitability.netMargin.value, 0.1);
  assert.equal(profileView(p, 'FULL').finances.cash, null);
  assert.doesNotMatch(raw, /876543210|PRIVATE_PROVIDER_ERROR_META|isolated-fixture/);
  assert.deepEqual(
    [f.procurement.visibleCount, f.procurement.totalCount, f.procurement.totalAmount],
    [3, 11, null],
  );
  assert.equal(f.procurement.items[2].state, 'UNKNOWN');
  assert.equal(f.procurement.items[2].amount, 0);
  assert.equal(f.procurement.activeCount, null);
  assert.equal(f.procurement.topCustomerShare, null);
});
test('Full procurement counts, states and supplier concentration use observed roles and records', async () => {
  const d = checkoDouble({
    partialContracts: false,
    fail: [],
    change: {
      'contracts:223': (b) => {
        Object.assign(b.data.Записи[0], { Постав: [{ ИНН: inn }], Статус: 'На исполнении' });
        return b;
      },
    },
  });
  const {
    profile: { externalFacts: f },
  } = await acquire(d);
  assert.deepEqual(
    [
      f.procurement.complete,
      f.procurement.totalAmount,
      f.procurement.activeCount,
      f.procurement.activeAmount,
      f.procurement.completedCount,
      f.procurement.topCustomerShare,
    ],
    [true, 160000, 2, 120000, 1, 75],
  );
  assert.deepEqual(
    f.procurement.lawSplit.map((x) => [x.law, x.total]),
    [
      ['44-ФЗ', 2],
      ['223-ФЗ', 1],
    ],
  );
  assert.equal(f.inspections[0].violations, null);
  assert.equal(f.inspections[0].title, 'Плановая');
  assert.equal(f.inspections[0].authority, 'Тестовый орган');
});
test('Partial, duplicate, missing and foreign response evidence cannot create confirmed totals', async () => {
  const d = checkoDouble({
    partialContracts: false,
    change: {
      'contracts:44': (b) => {
        b.data.Записи[1] = b.data.Записи[0];
        return b;
      },
      enforcements: (b) => {
        delete b.data.Записи[0].ОстЗадолж;
        return b;
      },
      finances: (b) => ({ ...b, company: { ИНН: entrepreneur } }),
      'legal-cases': (b) => ({ ...b, company: {} }),
    },
  });
  const { profile: p } = await acquire(d);
  assert.equal(p.externalFacts.procurement.complete, false);
  assert.equal(p.externalFacts.activeEnforcementRub, null);
  assert.equal(r(p.externalFacts, 'finances').warnings[0], 'SOURCE_IDENTITY_MISMATCH');
  assert.equal(r(p.externalFacts, 'legal-cases').status, 'FAILED');
  assert.equal(profileView(p, 'FREE').publicRisks.legalEventsDetected, null);
  await assert.rejects(
    acquire(checkoDouble({ change: { company: (b) => ({ ...b, data: { ИНН: entrepreneur } }) } })),
    /IDENTITY_MISMATCH/,
  );
});
test('IP subject binding uses entrepreneur contract and records unsupported methods separately', async () => {
  const d = checkoDouble(),
    { profile: p } = await acquire(d, entrepreneur);
  assert.equal(p.externalFacts.identity.ogrn, '999999999999999');
  assert.equal(p.externalFacts.identity.lifecycle, 'ACTIVE');
  assert.equal(r(p.externalFacts, 'finances').status, 'NOT_REQUESTED');
  assert.ok(!d.calls.includes('company'));
});
test('Old cache provenance corrected without recertifying legacy rows; verified FNS retained on disagreement', async () => {
  const { profile: p } = await acquire(checkoDouble()),
    old = structuredClone(p);
  delete old.externalFacts;
  delete old.finances;
  assert.deepEqual(cachedProfile(JSON.stringify(old), inn).legal, old.legal);
  assert.equal(profileView(cachedProfile(JSON.stringify(old), inn), 'FULL').finances, undefined);
  assert.equal(cachedProfile(JSON.stringify({inn, failureOnly:true}), inn), undefined);
  old.sourceManifest.external = [{ sourceId: 'external:contracts:' + inn, sourceType: 'EIS' }];
  assert.equal(cachedProfile(JSON.stringify(old), inn).sourceManifest.external[0].provider, 'CHECKO');
  assert.equal(cachedProfile(JSON.stringify(old), entrepreneur), undefined);
  const date = p.fetchedAt.slice(0, 10),
    id = 'fns:fixture',
    contentHash = 'fixturehash',
    receipt = {
      id,
      companyInn: inn,
      eligible: true,
      origin: 'CONFIRMED',
      verifier,
      method: 'INDEPENDENT_OFFICIAL_RETRIEVAL',
      officialHost: 'egrul.nalog.ru',
      contentHash,
      informationDate: date,
      receivedAt: date,
      lifecycle: 'TERMINATED',
      reasons: [],
    };
  const a = {
    companyInn: inn,
    legalRegistryV1: { version: verifier, activeSourceId: id, history: [receipt] },
    sourceManifest: {
      external: [{ sourceId: id, companyInn: inn, status: 'READY', contentHash, periodTo: date }],
    },
  };
  p.externalFacts.identity.informationDate = date;
  assert.equal(lifecycleComparison(p.externalFacts, a).status, 'CONFLICT');
  const risk = () =>
    legalFacts({ analysis: a, companyProfile: p, asOfDate: date }, []).find(
      (f) => f.semanticCode === 'LEGAL_LIFECYCLE',
    );
  assert.ok(risk().warnings.includes('LEGAL_LIFECYCLE_SOURCE_CONFLICT'));
  assert.equal(risk().value, null);
  p.externalFacts.identity.informationDate = null;
  assert.equal(risk().value, 'TERMINATED');
});
test('EIS sample contract and linked RNP inclusion/exclusion remain separate from live provider status', () => {
  const v = parseEisRecords(
    [eisContract(), eisInclusion('A'), eisInclusion('B'), eisExclusion('B'), eisInclusion('C', inn, '')],
    sample,
  );
  assert.deepEqual(
    v.rnp.map((x) => [x.number, x.state, x.ended]),
    [
      ['A', 'ACTIVE', null],
      ['B', 'HISTORICAL', '2026-07-16'],
      ['C', 'UNKNOWN', null],
    ],
  );
  assert.equal(v.currentRnp, 'RNP_ACTIVE');
  assert.equal(v.rnp[0].included, null);
  assert.equal(v.rnp[0].plannedEnd, '2027-07-01');
  assert.deepEqual(
    [v.contracts[0].law, v.contracts[0].role, v.contracts[0].state, v.contracts[0].amount],
    ['44-ФЗ', 'SUPPLIER', 'UNKNOWN', 25000],
  );
  assert.ok(
    v.receipts.every((s) => s.provider === 'EIS_DIRECT' && !s.direct && s.warnings.includes('OFFLINE_SAMPLE')),
  );
  assert.equal(
    parseEisRecords([eisInclusion('A')], { ...sample, completeCurrentRegister: false }).rnp[0].state,
    'UNKNOWN',
  );
  assert.throws(() => parseEisRecords([eisContract(entrepreneur)], sample), /IDENTITY/);
  assert.throws(() => parseEisRecords([eisInclusion('A'), eisExclusion('B')], sample), /EXCLUSION_UNBOUND/);
});
test('EIS parser rejects unsupported namespaces, XML entities/depth and unsafe archive transports', async () => {
  const enc = (t) => new TextEncoder().encode(t),
    xml = eisContract(),
    zip = zipSync({ 'record.xml': xml });
  assert.deepEqual(Array.from(archiveXml(zip)[0]), Array.from(xml));
  assert.throws(() => archiveXml(zipSync({ '../record.xml': xml })));
  const broken = zip.slice();
  broken[45] ^= 255;
  assert.throws(() => archiveXml(broken));
  assert.throws(() => archiveXml(zipSync({ 'big.xml': new Uint8Array(2100000) })));
  for (const b of [
    enc('<!DOCTYPE e [<!ENTITY aa SYSTEM "file:///etc/passwd">]><e>&aa;</e>'),
    eisXml('<a>'.repeat(70) + '</a>'.repeat(70)),
    eisXml('<e:unknown/>'),
    enc('<export><contract/></export>'),
  ])
    assert.throws(() => parseEisRecords([b], sample));
  for (const url of [
    'http://zakupki.gov.ru/a',
    'https://zakupki.gov.ru.evil.test/a',
    'https://user@zakupki.gov.ru/a',
    'https://127.0.0.1/a',
    'https://zakupki.gov.ru:444/a',
  ])
    assert.throws(() => eisArchiveUrl(url));
  const url = 'https://int44.zakupki.gov.ru/sample.zip';
  const result = await downloadEisArchive(url, async (u, o) => {
    assert.equal(u, url);
    assert.equal(o.redirect, 'error');
    assert.ok(o.signal);
    return new Response(zip);
  });
  assert.equal(result.length, 1);
  await assert.rejects(
    downloadEisArchive(url, async () => new Response(zip, { headers: { 'Content-Length': 5000000 } })),
    /SIZE_LIMIT/,
  );
});
test('Real dossier route: concurrent acquisition, FREE/FULL parity, read-only broker, cooldown and stale receipts', async () => {
  const fail = ['inspections'],
    d = checkoDouble({ fail }),
    rt = await createWorkspaceRuntime({ checkoFetch: d.fetcher });
  try {
    const res = await rt.request('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements: [{ fileName: 'synthetic.txt', text: statementFixture({ inn }) }] }),
    });
    const { analysis: a } = await res.json(),
      url = '/api/checko?analysisId=' + a.id + '&inn=' + inn;
    assert.equal((await rt.request(url, {}, null)).status, 401);
    assert.equal((await rt.request(url, {}, rt.stranger)).status, 403);
    assert.equal((await rt.request(url.replace(inn, '5032333146'))).status, 403);
    const cached=await (await rt.request(url + '&cacheOnly=1')).json();
    assert.equal(cached.providerStatus, 'READY');
    assert.equal(a.checkoAttempt.status,'PARTIAL');
    assert.equal(d.calls.length, 10);
    const three = await Promise.all(Array.from({ length: 3 }, () => rt.request(url + '&refresh=1')));
    const views = await Promise.all(three.map((v) => v.json()));
    assert.equal(three[0].status, 200, JSON.stringify(views[0]));
    assert.equal(d.calls.length, 10);
    assert.equal(views[0].freeView, true);
    for (const key of ['externalFacts', 'finances', 'legal', 'financialStatementsV2', 'sourceManifest'])
      assert.ok(!(key in views[0]));
    await rt.assign(a);
    assert.equal((await (await rt.request(url, {}, rt.broker)).json()).freeView, true);
    await rt.full(a.id);
    const owner = await (await rt.request(url + '&refresh=1')).json(),
      broker = await (await rt.request(url, {}, rt.broker)).json();
    assert.deepEqual(owner.externalFacts, broker.externalFacts);
    assert.equal(owner.externalFacts.procurement.totalCount, 11);
    assert.equal(owner.directEis.status, 'NOT_CONFIGURED');
    assert.equal((await rt.request(url + '&refresh=1', {}, rt.broker)).status, 403);
    assert.equal(d.calls.length, 10);
    assert.equal(owner.fetchedAt, views[0].fetchedAt);
    assert.doesNotMatch(JSON.stringify(owner), /PRIVATE_PROVIDER_ERROR_META|isolated-fixture|876543210/);
    const sampleRows = parseEisRecords(
      [eisInclusion('CURRENT'), eisInclusion('CLOSED'), eisExclusion('CLOSED')],
      sample,
    );
    const { RnpSection } = rt.load('app/components/workspace/external-sources.tsx');
    const html = renderToStaticMarkup(
      React.createElement(RnpSection, { rows: sampleRows.rnp, receipts: sampleRows.receipts }),
    );
    assert.match(html, /<h4>Действует<\/h4><p>CURRENT/);
    assert.match(html, /<h4>Историческая запись<\/h4><p>CLOSED/);
    const old = await rt.db.prepare('SELECT * FROM checko_profiles WHERE inn=?').bind(inn).first();
    const p = JSON.parse(old.payload);
    p.fetchedAt = new Date(Date.now() - 2 * 86400000).toISOString();
    await rt.pg.query('UPDATE checko_profiles SET payload=$1,fetched_at=$2,updated_at=$2 WHERE inn=$3', [
      JSON.stringify(p),
      p.fetchedAt,
      inn,
    ]);
    fail.push('company');
    for (let i = 0; i < 2; i++) {
      const s = await (await rt.request(url + '&refresh=1')).json();
      assert.equal(s.providerStatus, 'STALE');
      assert.equal(s.fetchedAt, p.fetchedAt);
    }
    assert.equal(d.calls.length, 11);
    const saved = await rt.db.prepare('SELECT raw_payload FROM checko_profiles WHERE inn=?').bind(inn).first();
    assert.equal(saved.raw_payload, old.raw_payload);
  } finally {
    await rt.close();
  }
});
