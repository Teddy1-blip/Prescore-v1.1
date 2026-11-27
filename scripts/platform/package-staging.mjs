import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
// Historical recovery utility only; normal deployment is git push origin staging.
// Reproducible source transport only. Does not access Git or upload anything.
const root=process.cwd(),out=path.resolve(root,process.argv[2]||'../amvera-staging-upload');
const roots=['app','lib','public','scripts','tests','docs','types','worker','db','drizzle','examples','build'];
const files=['.openai/hosting.json','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','proxy.ts','eslint.config.mjs','drizzle.config.ts','drizzle.postgres.config.ts','vite.config.ts'];
const excluded=new Set(['node_modules','.git','.next','dist']);
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(excluded.has(e.name)||e.name.startsWith('.env')||/\.(log|tsbuildinfo)$/.test(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile())files.push(p);}}
for(const dir of roots)if(fs.existsSync(dir))walk(dir);
files.sort();fs.mkdirSync(out,{recursive:true});
const result=spawnSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','--null','--verbatim-files-from','--no-recursion','-czf',path.join(out,'source.tar.gz'),'-T','-'],{input:files.join('\0')+'\0',encoding:'utf8'});
if(result.status!==0)throw Error('STAGING_ARCHIVE_FAILED');
const docker=fs.readFileSync('Dockerfile','utf8').replace('COPY package.json package-lock.json ./\nRUN npm ci\nCOPY . .','ADD source.tar.gz ./\nRUN npm ci');
fs.writeFileSync(path.join(out,'Dockerfile'),docker);fs.copyFileSync('amvera.yml',path.join(out,'amvera.yml'));
console.log(JSON.stringify({files:files.length,sha256:createHash('sha256').update(fs.readFileSync(path.join(out,'source.tar.gz'))).digest('hex'),bytes:fs.statSync(path.join(out,'source.tar.gz')).size}));
