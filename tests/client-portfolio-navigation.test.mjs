import assert from 'node:assert/strict';
import test from 'node:test';
import { clientNavigation, pages } from '../app/components/workspace/approved/types.ts';

test('client navigation exposes the existing credit portfolio page', () => {
  assert.ok(clientNavigation.includes('obligations'));
  assert.equal(pages.obligations[0], 'Кредитный портфель');
});
