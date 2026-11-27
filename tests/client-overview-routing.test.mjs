import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertClientOverviewRouting} from './fixtures/client-overview-contract.mjs';
const source = fs.readFileSync('app/components/workspace/client-launch-overview.tsx', 'utf8');
const guard = 'if (!props.model.full) return <FreeOverview {...props}/>;';
const executive = '<ExecutiveOverview {...props}>';
const decision = '<ClientDecisionRoute model={props.model} choose={props.choose}/>';
function change(from, to) {
 assert.equal(source.split(from).length - 1, 1, 'mutation must change exactly one known source fragment');
 return source.replace(from, to);
}

test('real ClientOverview preserves FREE/FULL routing and original props inside a Fragment', () => {
 assertClientOverviewRouting(source);
});
test('routing contract accepts an equivalent container without depending on return spelling', () => {
 const wrapper = source.match(/return\s*<>\s*(<ExecutiveOverview \{\.\.\.props\}>[\s\S]*?<\/ExecutiveOverview>)\s*<\/>;/);
 assert.ok(wrapper, 'find the FULL overview wrapper independently of whitespace');
 assert.equal(source.match(/return\s*<>\s*<ExecutiveOverview \{\.\.\.props\}>/g)?.length, 1);
 assertClientOverviewRouting(source.replace(wrapper[0], `return <section>${wrapper[1]}</section>;`));
});
for (const [name, from, to] of [
 ['missing FULL guard', guard, ''],
 ['reversed FULL guard', guard, guard.replace('!props.model.full', 'props.model.full')],
 ['always FREE', guard, guard.replace('if (!props.model.full) ', '')],
 ['missing executive overview', executive, ''],
 ['executive only mentioned in a comment', executive, '{/* <ExecutiveOverview {...props}/> */}'],
 ['missing decision route', decision, ''],
 ['duplicate executive overview', executive, `${executive}${executive}`],
 ['duplicate decision route', decision, `${decision}${decision}`],
 ['cloned model in executive', executive, '<ExecutiveOverview {...props} model={{...props.model}}/>'],
 ['cloned model in decision route', decision, '<ClientDecisionRoute model={{...props.model}} choose={props.choose}/>'],
 ['lost decision navigation', decision, '<ClientDecisionRoute model={props.model}/>'],
 ['lost executive callbacks', executive, '<ExecutiveOverview model={props.model}/>'],
 ['lost FREE props', guard, guard.replace('{...props}', 'model={props.model} retry={props.retry}')],
 ['mutation of canonical input', executive, '<ExecutiveOverview {...props} model={(props.model.full.canonical.prescoreIndex.value=999, props.model)}/>'],
]) test('routing guard rejects ' + name, () => {
 assert.throws(() => assertClientOverviewRouting(change(from, to)));
});
