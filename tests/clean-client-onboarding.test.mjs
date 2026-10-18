import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('new CLIENT starts clean and never substitutes the first historical analysis',()=>{
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 const presentation=fs.readFileSync('app/components/workspace/presentation.tsx','utf8');
 assert.match(client,/\[selectedId,setSelectedId\]=useState\(''\)/,'selection must start empty');
 assert.doesNotMatch(client,/analyses\s*\[\s*0\s*\]/,'historical analysis must never be selected implicitly');
 assert.match(client,/const wanted=q\.get\('analysisId'\)\?\?client;const id=wanted\?\?''/,'only an explicit analysisId or broker client scope may select a dossier');
 assert.match(client,/Выберите сохранённый анализ явно/);
 assert.match(client,/Предыдущий результат не открывается автоматически/);
 assert.match(client,/другой анализ автоматически не подставляется/);
 assert.match(presentation,/Загрузить банковскую выписку/);
 assert.match(presentation,/Новый анализ начинается с выписки/);
});
