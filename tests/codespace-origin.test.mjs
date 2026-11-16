import assert from 'node:assert/strict';
import test from 'node:test';
import {codespaceBrowserOrigin} from '../lib/platform/codespace-origin.ts';

const domain = 'sample-dev-4189.app.github.dev';
const env = {NODE_ENV:'development', PRESCORE_RUNTIME_MODE:'development', CODESPACES:'true', CODESPACE_NAME:'sample-dev', PRESCORE_BASE_URL:'https://' + domain};
const tunnel = {host:'localhost:4189', origin:'http://localhost:4189', referer:'https://' + domain + '/login', 'x-forwarded-host':domain, 'x-forwarded-proto':'https', 'sec-fetch-site':'same-origin'};

test('restores the configured origin for the exact HTTPS Codespaces development tunnel', () => {
  assert.equal(codespaceBrowserOrigin(new Headers(tunnel), env), env.PRESCORE_BASE_URL);
});

test('rejects mismatched ports, domains, origins, missing browser context and other runtime modes', () => {
  for (const changes of [
    {host:'localhost:4190'}, {origin:'https://elsewhere.example'}, {'x-forwarded-host':'another-4189.app.github.dev'},
    {'x-forwarded-host':domain + '.example'}, {'x-forwarded-proto':'http'}, {'sec-fetch-site':'cross-site'},
    {'sec-fetch-site':'same-site'}, {referer:'https://another.example/dashboard'}, {referer:''}, {referer:'http://localhost:4189/login'},
  ]) assert.equal(codespaceBrowserOrigin(new Headers({...tunnel,...changes}), env), null);
  for (const changes of [{CODESPACES:'false'}, {NODE_ENV:'production'}, {PRESCORE_RUNTIME_MODE:'release-candidate'}, {CODESPACE_NAME:'other'}])
    assert.equal(codespaceBrowserOrigin(new Headers(tunnel), {...env,...changes}), null);
});
