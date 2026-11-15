import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('CLIENT has no visible history and opens an owned company dossier by default',()=>{
 const client=fs.readFileSync('app/components/workspace/client.tsx','utf8');
 const presentation=fs.readFileSync('app/components/workspace/presentation.tsx','utf8');
 assert.match(client,/\[selectedId,setSelectedId\]=useState\(''\)/,'selection state starts neutral before owner summary loads');
 assert.match(client,/resolveClientSelection\(q,directory,rows,remembered\)/,'the current owner directory resolves versions within the company');
 assert.doesNotMatch(client,/Версия анализа|Последние активные анализы|Тестовые данные · \{qaAnalyses|pc-test-history/,'CLIENT must not expose analysis history');
 assert.match(client,/Этот анализ больше недоступен/,'an explicit unavailable dossier fails visibly instead of substituting another one');
 assert.match(presentation,/Загрузить банковскую выписку/);
 assert.match(presentation,/Введите ИНН для просмотра публичных сведений/);
 assert.doesNotMatch(presentation,/Новый анализ начинается с выписки/);
});
