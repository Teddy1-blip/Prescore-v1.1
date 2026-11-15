import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landing = readFileSync('app/components/landing-v3/landing.tsx', 'utf8');
const referral = readFileSync('app/ref/[code]/page.tsx', 'utf8');
const publicPage = readFileSync('app/financing/page.tsx', 'utf8');
const agentApi = readFileSync('app/api/agent/route.ts', 'utf8');

test('landing offers a public financing enquiry separately from the analysis login', () => {
  assert.match(landing, /href="\/financing">Оставить заявку на финансирование/);
  assert.match(landing, /href=\{configuredAppLink\('\/login'\)\}>Финансовый анализ/);
  assert.match(landing, /Обсудить финансирование/);
});

test('brand-first financing route reuses owner intake without a new data pipeline', () => {
  assert.match(publicPage, /import ReferralPage from/);
  assert.match(publicPage, /return <ReferralPage \/>/);
  assert.match(referral, /params\?\.code \|\| "AGENT-ANTON-001"/);
});

test('owner referral form is branded as Prescore and never forces paid FULL after enquiry', () => {
  assert.match(referral, /directPrescore = code === "AGENT-ANTON-001"/);
  assert.match(referral, /'ФИНАНСИРОВАНИЕ БИЗНЕСА · ПРЕСКОР'/);
  assert.match(referral, /directPrescore \? '\/' : '\/checkout'/);
  assert.match(referral, /Передача данных кредиторам потребует отдельного согласия/);
});

test('public financing enquiry reuses a consent-gated lead persistence path', () => {
  assert.match(referral, /fetch\("\/api\/agent"/);
  assert.match(referral, /source: "Реферальная ссылка"/);
  assert.match(agentApi, /const publicReferral =/);
  assert.match(agentApi, /body\.consent !== true/);
  assert.match(agentApi, /INSERT INTO agent_leads/);
});
