import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

const developmentPreviewMeta =
 /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test('standalone server renders development preview metadata without legacy dist', {timeout:60000}, async t => {
 // npm test builds Next first. Exercise the same server.js used by Docker CMD,
 // with no database/SMTP credentials and no external network calls.
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
 const port=probe.address().port;
 await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
 const server=spawn(process.execPath,['server.js'],{
  cwd:fileURLToPath(new URL('../.next/standalone/',import.meta.url)),
  env:{PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',PORT:String(port),HOSTNAME:'127.0.0.1'},
  stdio:['ignore','pipe','pipe'],
 });
 t.after(async()=>{
  if(server.exitCode!==null||server.signalCode!==null)return;
  const exited=once(server,'exit');server.kill('SIGTERM');
  const timer=setTimeout(()=>server.kill('SIGKILL'),5000);
  try{await exited;}finally{clearTimeout(timer);}
 });
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('STANDALONE_START_TIMEOUT')),30000);
  let output='';
  server.stdout.on('data',chunk=>{output+=String(chunk);if(output.includes('Ready')){clearTimeout(timer);resolve();}});
  server.on('error',error=>{clearTimeout(timer);reject(error);});
  server.on('exit',code=>{clearTimeout(timer);reject(Error('STANDALONE_EARLY_EXIT_'+code));});
 });
 const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type')??'',/^text\/html\b/i);
 const html=await response.text();
 assert.match(html,developmentPreviewMeta);
 assert.match(html,/<html[^>]*lang="ru"/);
 assert.match(html,/Прескор/);
 assert.match(html,/<body[^>]*class="prescore-v2"/);
});
