/** Isolated element-routing contract for the real ClientOverview function.
 * JSX creation and imported children are explicit stand-ins. No DOM, React
 * lifecycle, child rendering, scoring, database or provider is exercised here.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function freeze(value) {
 if (value && typeof value === 'object') {
  Object.values(value).forEach(freeze);
  Object.freeze(value);
 }
 return value;
}

function loadOverview(source) {
 const compiled = ts.transpileModule(source, {
  fileName: 'client-launch-overview.tsx', reportDiagnostics: true,
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
 });
 const errors = compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
 assert.deepEqual(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], 'valid TSX');
 const child = name => Object.assign(() => {throw Error('CHILD_RENDER_OUT_OF_SCOPE:' + name);}, {displayName: name});
 const ExecutiveOverview = child('ExecutiveOverview'), ClientDecisionRoute = child('ClientDecisionRoute');
 const unused = () => {throw Error('HELPER_EXECUTION_OUT_OF_SCOPE');};
 const jsx = (type, props, key) => ({type, props: props ?? {}, key});
 const modules = {
  'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: Symbol('Fragment')},
  './banking-ledger': {BankingSnapshot: child('BankingSnapshot')},
  './data-panel': {concentrationPercent: unused, factValue: unused},
  './client-insights': {CashTrend: child('CashTrend'), ExecutiveOverview, Panel: child('Panel')},
  './client-decision-route': {ClientDecisionRoute},
  './presentation': {date: unused, money: unused},
  './credit-depth': {sourceState: unused},
 };
 const exports = {};
 const context = vm.createContext({exports, require(name) {
  assert.ok(Object.hasOwn(modules, name), 'unexpected overview dependency: ' + name);
  return modules[name];
 }});
 new vm.Script(compiled.outputText, {filename: 'client-launch-overview.tsx'}).runInContext(context, {timeout: 1000});
 assert.equal(typeof exports.ClientOverview, 'function');
 return {render: exports.ClientOverview, ExecutiveOverview, ClientDecisionRoute};
}

function elements(node) {
 if (Array.isArray(node)) return node.flatMap(elements);
 if (!node || typeof node !== 'object' || !('type' in node)) return [];
 return [node, ...elements(node.props.children)];
}

export function assertClientOverviewRouting(source) {
 const {render, ExecutiveOverview, ClientDecisionRoute} = loadOverview(source);
 const choose = () => {}, retry = () => {};
 const basic = {bankingFacts: {marker: 'unchanged-canonical-bank-facts'}};
 // An entitlement is not a computed report. Missing or unavailable FULL must
 // retain the basic route, including an already-entitled user's failed read.
 for (const model of [
  {basic, entitlement: 'BASIC', fullAvailability: 'LOCKED'},
  {basic, entitlement: 'BASIC', full: null, fullAvailability: 'LOCKED'},
  {basic, entitlement: 'FULL', fullAvailability: 'UNAVAILABLE'},
  {basic, entitlement: 'FULL', full: null, fullAvailability: 'UNAVAILABLE'},
 ]) {
  freeze(model);
  const before = JSON.stringify(model), result = render(freeze({model, choose, retry}));
  assert.equal(result?.type?.name, 'FreeOverview', 'no full model: use FreeOverview');
  assert.equal(result.props.model, model, 'FREE receives the original model');
  assert.equal(result.props.retry, retry, 'FREE retains retry');
  assert.equal(elements(result).filter(n => n.type === ExecutiveOverview || n.type === ClientDecisionRoute).length, 0, 'no paid children in FREE route');
  assert.equal(JSON.stringify(model), before, 'FREE must not mutate the model');
 }
 const model = freeze({basic, entitlement: 'FULL', fullAvailability: 'READY',
  full: {report: {marker: 'unchanged-client-report'}, canonical: {prescoreIndex: {value: 512}}}});
 const before = JSON.stringify(model), result = render(freeze({model, choose, retry}));
 const nodes = elements(result);
 const paid = nodes.filter(n => n.type === ExecutiveOverview || n.type === ClientDecisionRoute);
 assert.deepEqual(paid.map(n => n.type), [ExecutiveOverview, ClientDecisionRoute], 'FULL includes exactly one overview and decision route, in order');
 assert.ok(!nodes.some(n => n.type?.name === 'FreeOverview'), 'FULL must not use FreeOverview');
 for (const node of paid) {
  assert.equal(node.props.model, model, 'FULL children receive the same canonical model');
  assert.equal(node.props.choose, choose, 'FULL children retain navigation');
 }
 assert.equal(paid[0].props.retry, retry, 'executive overview retains retry');
 assert.equal(JSON.stringify(model), before, 'FULL must not mutate the model');
}
