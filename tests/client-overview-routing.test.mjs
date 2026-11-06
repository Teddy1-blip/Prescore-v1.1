import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertClientOverviewRouting} from './fixtures/client-overview-contract.mjs';
const source = fs.readFileSync('app/components/workspace/client-launch-overview.tsx', 'utf8');
const guard = 'if (!props.model.full) return <FreeOverview model={props.model} retry={props.retry}/>;';
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
 const from = `return <>\n    ${executive}\n      ${decision}\n    </ExecutiveOverview>\n  </>;`;
 const to = `return <section>\n    ${executive}\n      ${decision}\n    </ExecutiveOverview>\n  </section>;`;
 assertClientOverviewRouting(change(from, to));
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
 ['lost FREE retry', guard, guard.replace(' retry={props.retry}', '')],
 ['FREE model substitution', guard, guard.replace('model={props.model}', 'model={{...props.model}}')],
 ['mutation of canonical input', executive, '<ExecutiveOverview {...props} model={(props.model.full.canonical.prescoreIndex.value=999, props.model)}/>'],
]) test('routing guard rejects ' + name, () => {
 assert.throws(() => assertClientOverviewRouting(change(from, to)));
});
