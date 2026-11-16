import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('BFO INN entry checks Checko then creates an existing dossier without an undefined action',()=>{
 const code=fs.readFileSync('app/components/workspace/company-sources.tsx','utf8');
 const start=code.indexOf('  async function lookup(){');
 const end=code.indexOf('  return <div className="ws pc-company-sources pc-bfo"',start);
 assert.ok(start>=0&&end>start);
 const entry=code.slice(start,end);
 assert.match(entry,/post\('preview'\)/);
 assert.match(entry,/post\('save',attachPublic\)/);
 assert.match(entry,/attachPublic=!!result\.profile/);
 assert.doesNotMatch(entry,/if\(action===/);
 assert.doesNotMatch(entry,/if\(view==='home'/);
 assert.match(code,/setPreview\(null\).*?placeholder="10 или 12 цифр" disabled=\{busy\}/);
});
