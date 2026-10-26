/** Build-only checks; never called by the application startup or migration CLI. */
import {readdirSync, existsSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const BUILD_GATE_VERSION = 'PRESCORE-RECOVERY-BUILD-GATE-1';
const prohibited = [
  'DATABASE_URL', 'AUTH_SECRET', 'SMTP_PASSWORD', 'CHECKO_API_KEY',
  'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'TBANK_PASSWORD', 'TBANK_TERMINAL_KEY',
  'AMVERA_PASSWORD', 'BILLING_FAKE_SECRET',
];

export function assertBuildEnvironment(env) {
  if (env.NODE_ENV === 'production') throw Error('BUILD_GATE_NOT_RUNTIME');
  if (env.PRESCORE_RUNTIME_MODE && !['test', 'development'].includes(env.PRESCORE_RUNTIME_MODE)) {
    throw Error('BUILD_GATE_NOT_RUNTIME');
  }
  if (prohibited.some(key => Boolean(env[key]))) throw Error('BUILD_GATE_LIVE_CREDENTIALS_FORBIDDEN');
  if (env.BILLING_LIVE_ENABLED === 'true'
    || (env.BILLING_PROVIDER && env.BILLING_PROVIDER !== 'DISABLED')
    || (env.AI_PROVIDER && !['disabled', 'local'].includes(env.AI_PROVIDER))) {
    throw Error('BUILD_GATE_LIVE_PROVIDER_FORBIDDEN');
  }
}

export function verificationPlan(root, outputDirectory) {
  for (const file of ['package-lock.json', '.next/BUILD_ID', '.next/standalone/server.js']) {
    if (!existsSync(join(root, file))) throw Error('BUILD_GATE_BUILD_REQUIRED');
  }
  const tests = readdirSync(join(root, 'tests'), {withFileTypes: true})
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map(entry => join('tests', entry.name)).sort();
  if (tests.length === 0) throw Error('BUILD_GATE_TESTS_REQUIRED');
  return [
    {id: 'REGRESSION', command: process.execPath,
      args: ['--experimental-strip-types', '--test', '--test-concurrency=1', ...tests]},
    {id: 'CREDIT_LAB', command: process.execPath,
      args: ['--experimental-strip-types', 'scripts/credit-lab-business.mjs', outputDirectory]},
    {id: 'LINT', command: 'npm', args: ['run', 'lint']},
    {id: 'ARTIFACT', command: process.execPath, args: ['scripts/platform/validate-artifact.mjs']},
    {id: 'PDF_RUNTIME', command: process.execPath, args: ['scripts/platform/pdf-artifact-smoke.mjs']},
  ];
}

/** Sequential checks bound memory use. A failed/missing command never becomes a pass. */
export function executeVerification(plan, {root, env, run = spawnSync, emit = console.log}) {
  const checks = [];
  for (const step of plan) {
    emit(JSON.stringify({event: 'BUILD_CHECK_STARTED', stage: step.id}));
    let result;
    try {
      result = run(step.command, step.args, {cwd: root, env, stdio: 'inherit', shell: false});
    } catch {
      result = {status: null, error: true};
    }
    const passed = result?.status === 0 && !result.error && !result.signal;
    checks.push({stage: step.id, status: passed ? 'PASSED' : 'FAILED',
      exitCode: Number.isInteger(result?.status) ? result.status : null});
    emit(JSON.stringify({event: passed ? 'BUILD_CHECK_PASSED' : 'BUILD_CHECK_FAILED', ...checks.at(-1)}));
    if (!passed) return {status: 'FAILED', checks};
  }
  return {status: plan.length > 0 ? 'PASSED' : 'FAILED', checks};
}

export function main({root = process.cwd(), env = process.env} = {}) {
  assertBuildEnvironment(env);
  // Evidence stays in this disposable build directory, not in a live database.
  const outputDirectory = join(root, '.next', 'recovery-credit-lab');
  const reportFile = join(root, '.next', 'standalone', 'lib', 'release', 'build-verification.json');
  const plan = verificationPlan(root, outputDirectory);
  const base = {version: BUILD_GATE_VERSION,
    lockSha256: createHash('sha256').update(readFileSync(join(root, 'package-lock.json'))).digest('hex'),
    scope: 'BUILD_REGRESSION_ONLY', browserAccepted: false, liveAccepted: false};
  mkdirSync(dirname(reportFile), {recursive: true});
  writeFileSync(reportFile, JSON.stringify({...base, status: 'RUNNING', checks: []}, null, 2) + '\n');
  const result = executeVerification(plan, {root, env: {...env, NEXT_TELEMETRY_DISABLED: '1'}});
  writeFileSync(reportFile, JSON.stringify({...base, ...result}, null, 2) + '\n');
  console.log(JSON.stringify({event: 'RECOVERY_BUILD_GATE', status: result.status, checks: result.checks.length}));
  return result.status === 'PASSED' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== '--build-only' || process.argv.length !== 3) throw Error('BUILD_GATE_EXPLICIT_BUILD_REQUIRED');
    process.exitCode = main();
  } catch (error) {
    const allowed = new Set(['BUILD_GATE_NOT_RUNTIME', 'BUILD_GATE_LIVE_CREDENTIALS_FORBIDDEN',
      'BUILD_GATE_LIVE_PROVIDER_FORBIDDEN', 'BUILD_GATE_BUILD_REQUIRED', 'BUILD_GATE_TESTS_REQUIRED',
      'BUILD_GATE_EXPLICIT_BUILD_REQUIRED']);
    const code = error instanceof Error && allowed.has(error.message) ? error.message : 'BUILD_GATE_FAILED';
    console.error(JSON.stringify({event: 'RECOVERY_BUILD_GATE', status: 'FAILED', code}));
    process.exitCode = 1;
  }
}
