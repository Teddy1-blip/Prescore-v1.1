import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertBuildEnvironment, verificationPlan, executeVerification} from '../scripts/qa/recovery-build-gate.mjs';

const gate = fileURLToPath(new URL('../scripts/qa/recovery-build-gate.mjs', import.meta.url));
const disposable = () => mkdtempSync(join(tmpdir(), 'prescore-gate-test-'));
function fixture(root, tests = ['z.test.mjs', 'a.test.mjs']) {
  mkdirSync(join(root, '.next/standalone'), {recursive: true});
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'package-lock.json'), '{}');
  writeFileSync(join(root, '.next/BUILD_ID'), 'test-only');
  writeFileSync(join(root, '.next/standalone/server.js'), '// synthetic build marker');
  for (const name of tests) writeFileSync(join(root, 'tests', name), '');
}

test('safe build environment is accepted without inventing a runtime mode', () => {
  assert.doesNotThrow(() => assertBuildEnvironment({}));
  assert.doesNotThrow(() => assertBuildEnvironment({PRESCORE_RUNTIME_MODE: 'test', AI_PROVIDER: 'disabled', BILLING_PROVIDER: 'DISABLED'}));
});
for (const env of [{NODE_ENV: 'production'}, {PRESCORE_RUNTIME_MODE: 'release-candidate'}, {PRESCORE_RUNTIME_MODE: 'production'}]) {
  test(`runtime is rejected: ${JSON.stringify(env)}`, () => assert.throws(() => assertBuildEnvironment(env), /BUILD_GATE_NOT_RUNTIME/));
}
for (const key of ['DATABASE_URL', 'AUTH_SECRET', 'CHECKO_API_KEY', 'DEEPSEEK_API_KEY', 'TBANK_PASSWORD']) {
  test(`${key} is not accepted into build-time checks`, () => assert.throws(() => assertBuildEnvironment({[key]: 'secret-value'}), /BUILD_GATE_LIVE_CREDENTIALS_FORBIDDEN/));
}
test('live providers are forbidden', () => {
  for (const env of [{BILLING_LIVE_ENABLED: 'true'}, {BILLING_PROVIDER: 'TBANK'}, {AI_PROVIDER: 'deepseek'}]) {
    assert.throws(() => assertBuildEnvironment(env), /BUILD_GATE_LIVE_PROVIDER_FORBIDDEN/);
  }
});
test('actual Next build and packaged server are prerequisites', () => {
  const root = disposable();
  try {assert.throws(() => verificationPlan(root, join(root, 'out')), /BUILD_GATE_BUILD_REQUIRED/);}
  finally {rmSync(root, {recursive: true, force: true});}
});
test('all top-level test files are selected deterministically and serially', () => {
  const root = disposable();
  try {
    fixture(root);
    mkdirSync(join(root, 'tests/not-a-file.test.mjs'));
    const plan = verificationPlan(root, join(root, 'out'));
    assert.deepEqual(plan.map(step => step.id), ['REGRESSION', 'CREDIT_LAB', 'LINT', 'ARTIFACT', 'PDF_RUNTIME']);
    assert.ok(plan[0].args.includes('--test-concurrency=1'));
    assert.deepEqual(plan[0].args.slice(3), ['tests/a.test.mjs', 'tests/z.test.mjs']);
    assert.equal(plan[1].args.at(-1), join(root, 'out'));
  } finally {rmSync(root, {recursive: true, force: true});}
});
test('empty test directory fails closed', () => {
  const root = disposable();
  try {fixture(root, []); assert.throws(() => verificationPlan(root, join(root, 'out')), /BUILD_GATE_TESTS_REQUIRED/);}
  finally {rmSync(root, {recursive: true, force: true});}
});
test('real child failure stops following commands', () => {
  const root = disposable(), marker = join(root, 'must-not-exist');
  try {
    const result = executeVerification([
      {id: 'FIRST', command: process.execPath, args: ['-e', 'process.exit(7)']},
      {id: 'SECOND', command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`]},
    ], {root, env: {}, emit() {}});
    assert.deepEqual(result, {status: 'FAILED', checks: [{stage: 'FIRST', status: 'FAILED', exitCode: 7}]});
    assert.throws(() => readFileSync(marker), {code: 'ENOENT'});
  } finally {rmSync(root, {recursive: true, force: true});}
});
test('success requires every real child to pass', () => {
  const result = executeVerification(['A', 'B'].map(id => ({id, command: process.execPath, args: ['-e', 'process.exit(0)']})), {root: tmpdir(), env: {}, emit() {}});
  assert.equal(result.status, 'PASSED'); assert.equal(result.checks.length, 2);
});
test('missing executable, thrown runner, signal and empty plan are never success', () => {
  const plan = [{id: 'ONE', command: process.execPath, args: []}];
  for (const run of [() => ({status: null, error: true}), () => {throw Error('private error');}, () => ({status: 0, signal: 'SIGTERM'})]) {
    assert.equal(executeVerification(plan, {root: tmpdir(), env: {}, run, emit() {}}).status, 'FAILED');
  }
  assert.equal(executeVerification([], {root: tmpdir(), env: {}, emit() {}}).status, 'FAILED');
});
test('CLI refuses implicit invocation and does not leak secret values', () => {
  const implicit = spawnSync(process.execPath, [gate], {encoding: 'utf8', env: {}});
  assert.equal(implicit.status, 1); assert.match(implicit.stderr, /BUILD_GATE_EXPLICIT_BUILD_REQUIRED/);
  const secret = spawnSync(process.execPath, [gate, '--build-only'], {encoding: 'utf8', env: {DATABASE_URL: 'private-password'}});
  assert.equal(secret.status, 1); assert.match(secret.stderr, /LIVE_CREDENTIALS_FORBIDDEN/);
  assert.ok(!secret.stderr.includes('private-password'));
});

test('Docker runs mandatory verification before runtime without changing the startup command', () => {
  const docker = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const [build, runtime] = docker.split('FROM node:22-bookworm-slim AS runtime');
  assert.ok(build.includes('npm run build && node scripts/release/package-runtime.mjs'));
  assert.ok(build.includes('node scripts/qa/recovery-build-gate.mjs --build-only'));
  assert.ok(!runtime.includes('recovery-build-gate'));
  assert.ok(runtime.includes('CMD ["node","--experimental-strip-types","scripts/release/start.mjs"]'));
});

function commandFixture(root, failure) {
  fixture(root, ['sample.test.mjs']);
  writeFileSync(join(root, 'tests/sample.test.mjs'), failure ? 'process.exit(9);' : '');
  mkdirSync(join(root, 'scripts/platform'), {recursive: true});
  writeFileSync(join(root, 'scripts/credit-lab-business.mjs'), '');
  writeFileSync(join(root, 'scripts/platform/validate-artifact.mjs'), '');
  writeFileSync(join(root, 'scripts/platform/pdf-artifact-smoke.mjs'), '');
  writeFileSync(join(root, 'package.json'), JSON.stringify({private: true, scripts: {lint: 'node -e "process.exit(0)"'}}));
}
for (const failure of [false, true]) test(`CLI records ${failure ? 'failure' : 'success'} with explicit non-browser acceptance`, () => {
  const root = disposable();
  try {
    // Synthetic commands test orchestration, NOT the application build or credit engine.
    commandFixture(root, failure);
    const result = spawnSync(process.execPath, [gate, '--build-only'], {
      cwd: root, encoding: 'utf8', env: {PATH: process.env.PATH, HOME: root, NEXT_TELEMETRY_DISABLED: '1'},
    });
    assert.equal(result.status, failure ? 1 : 0, result.stdout + result.stderr);
    const report = JSON.parse(readFileSync(join(root, '.next/standalone/lib/release/build-verification.json'), 'utf8'));
    assert.equal(report.status, failure ? 'FAILED' : 'PASSED');
    assert.equal(report.checks.length, failure ? 1 : 5);
    assert.equal(report.browserAccepted, false);
    assert.equal(report.liveAccepted, false);
    assert.equal(report.scope, 'BUILD_REGRESSION_ONLY');
    assert.match(report.lockSha256, /^[a-f0-9]{64}$/);
  } finally {rmSync(root, {recursive: true, force: true});}

});
