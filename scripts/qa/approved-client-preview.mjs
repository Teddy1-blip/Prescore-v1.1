// Build a portable synthetic workbench from the same React screens the dashboard uses.
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const target = path.resolve(process.argv[2] || 'Prescore_Client.html');
const result = await build({
  entryPoints: ['tests/approved-client/preview.tsx'],
  bundle: true,
  write: false,
  outdir: 'memory',
  minify: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const asset = (type) => result.outputFiles.find((f) => f.path.endsWith(type)).text;
await fs.writeFile(
  target,
  '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prescore · Учебный кабинет</title><style>body{margin:0}' +
    asset('.css') +
    '</style><div id="root"></div><script>' +
    asset('.js').replace(/<\/script/gi, '<\\/script') +
    '</script></html>',
);
console.log(target);
