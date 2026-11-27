import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clientNavigationHref,resolveClientSelection} from '../lib/workspace/client-navigation.ts';

const query = (href) => new URLSearchParams(href.split('?')[1] || '');

test('a dossier-only client never turns its dossier ID into an analysis ID', () => {
  const q = query(clientNavigationHref(
    '?dossierId=company-123&analysisId=stale-analysis&bankMonth=2026-08&cashMonth=2026-08',
    'bfo', 'company-123', 'company-123',
  ));
  assert.equal(q.get('dossierId'), 'company-123');
  assert.equal(q.has('analysisId'), false);
  assert.equal(q.has('bankMonth'), false);
  assert.equal(q.has('cashMonth'), false);
  assert.equal(q.get('view'), 'bfo');
});

test('a selected existing analysis retains the real analysis ID, not an old dossier', () => {
  const q = query(clientNavigationHref('?dossierId=old&from=client', 'banking', 'analysis-42'));
  assert.equal(q.get('analysisId'), 'analysis-42');
  assert.equal(q.has('dossierId'), false);
  assert.equal(q.get('view'), 'banking');
  assert.equal(q.get('from'), 'client');
});

test('an owned company and its independent bank version survive navigation',()=>{
 const q=query(clientNavigationHref('?view=home','banking','analysis-42','company-123'));
 assert.equal(q.get('dossierId'),'company-123');assert.equal(q.get('analysisId'),'analysis-42');
 const upload=query(clientNavigationHref('?view=home','upload','analysis-42','company-123'));
 assert.equal(upload.get('dossierId'),'company-123');assert.equal(upload.has('analysisId'),false);
});

test('company selection is independent of bank history and rejects crossed identifiers',()=>{
 const companies=[{id:'a',inn:'ONE'},{id:'b',inn:'TWO'}];
 const bank=[{id:'old',companyInn:'ONE',periodTo:'2024-01-01'},{id:'new',companyInn:'ONE',periodTo:'2024-12-31'},{id:'qa',historyPurpose:'QA',companyInn:'ONE',periodTo:'2025-01-01'}];
 const resolve=(q,remembered='')=>resolveClientSelection(new URLSearchParams(q),companies,bank,remembered);
 assert.deepEqual(resolve(''),{dossier:companies[0],version:'new'});
 assert.deepEqual(resolve('','b'),{dossier:companies[1],version:''});
 assert.deepEqual(resolve('analysisId=old'),{dossier:companies[0],version:'old'});
 assert.throws(()=>resolve('dossierId=b&analysisId=old'));
 assert.throws(()=>resolve('dossierId=other'));
 assert.deepEqual(resolve('client=delegated'),{dossier:undefined,version:'delegated'});
});
test('source refresh adopts the analysis created for a dossier without a selected analysis',()=>{
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 assert.match(client,/const refreshed=await loadOperations\(\)/);
 assert.match(client,/if\(!selectedId&&dossierId\)/);
 assert.match(client,/latestCompanyVersion\(refreshed,dossierInn\)/);
 assert.match(client,/onSourceChanged=\{selectedId\|\|dossierId\?refreshSource:undefined\}/);
});
test('without a company neither phantom ID is serialized', () => {
  const q = query(clientNavigationHref('?analysisId=stale&dossierId=stale', 'home'));
  assert.equal(q.has('analysisId'), false);
  assert.equal(q.has('dossierId'), false);
  assert.equal(q.get('view'), 'home');
});

test('the existing Finance page owns one canonical ledger and does not add a second cash chart', () => {
  const client = fs.readFileSync('app/components/workspace/client.tsx', 'utf8');
  const approved = fs.readFileSync('app/components/workspace/approved/pages.tsx', 'utf8');
  assert.equal((client.match(/<BankingLedger\b/g) || []).length, 1);
  assert.equal((client.match(/<CashTrend\b/g) || []).length, 0);
  assert.match(approved, /<CashCards data=\{d\} go=\{go\}/);
  assert.match(client, /from '\.\/approved\/live-shell'/);
});
