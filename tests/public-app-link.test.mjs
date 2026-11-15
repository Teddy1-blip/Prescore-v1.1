import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAppLink } from '../lib/launch/public-app-link.ts';
test('preserves same-origin links for staging and development by default', () => {
 assert.equal(publicAppLink('/login'), '/login');
 assert.equal(publicAppLink('/agent'), '/agent');
});
test('routes customer and partner entry to app.prescore.ru on configured public landing', () => {
 assert.equal(publicAppLink('/login?returnTo=%2Fdashboard','https://app.prescore.ru'), 'https://app.prescore.ru/login?returnTo=%2Fdashboard');
 assert.equal(publicAppLink('/agent','https://app.prescore.ru'), 'https://app.prescore.ru/agent');
 assert.equal(publicAppLink('/checkout','https://app.prescore.ru'), 'https://app.prescore.ru/checkout');
});
test('rejects unsafe origins and paths', () => {
 for (const origin of ['http://app.prescore.ru','https://evil.example/path','https://user:pw@app.prescore.ru','https://app.prescore.ru:444','https://app.prescore.ru?foo']) assert.throws(()=>publicAppLink('/login', origin),/INVALID_PUBLIC_APP_ORIGIN/);
 for(const path of ['//evil.example','/api/billing','/logout','/agent//evil','/login\\foo']) assert.throws(()=>publicAppLink(path,'https://app.prescore.ru'),/INVALID_PUBLIC_APP_PATH/);
});
