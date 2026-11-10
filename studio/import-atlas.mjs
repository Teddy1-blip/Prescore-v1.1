import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {BASE} from './methodology.mjs';
const atlas=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(atlas.metadata.version!=='0.1'||atlas.metadata.commit_sha!==BASE)throw Error('Несовместимая версия атласа');
const rows=Object.values(atlas).filter(Array.isArray).flat();
if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Повторный ID');
fs.writeFileSync(new URL('data/atlas.json.gz',import.meta.url),gzipSync(JSON.stringify(atlas),{level:9}));
