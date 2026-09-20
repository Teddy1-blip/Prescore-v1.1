import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalDocumentStorage} from '../lib/storage/documents.ts';
import {safeReturnPath} from '../lib/auth/contracts.ts';
import {DeepSeekProvider,generateWithFallback,minimizeQuestion,configuredProvider} from '../lib/ai/providers/index.ts';
import {validateExport} from '../lib/db/import-validation.ts';

test('redirects stay on the application origin and avoid auth loops',()=>{
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/login','/logout','/api/auth/sign-in'])assert.equal(safeReturnPath(value),'/dashboard');
 assert.equal(safeReturnPath('/agent?view=clients'),'/agent?view=clients');
});
test('document lifecycle, metadata, size and traversal protections',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prescore-storage-'));const storage=new LocalDocumentStorage(root,10);
 try{
  const m=await storage.put(new TextEncoder().encode('hello'),'text/plain');
  assert.equal(m.sizeBytes,5);assert.equal(await storage.exists(m.key),true);
  assert.equal(new TextDecoder().decode(await storage.get(m.key)),'hello');
  assert.deepEqual(await storage.metadata(m.key),m);
  await assert.rejects(storage.get('../private'),/STORAGE_KEY_INVALID/);
  await assert.rejects(storage.put(new Uint8Array(11),'text/plain'),/METADATA/);
  await assert.rejects(storage.put(new Uint8Array(1),'text/html'),/METADATA/);
  await storage.delete(m.key);assert.equal(await storage.exists(m.key),false);
  await storage.delete(m.key);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('storage does not follow a symlinked storage root',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prescore-links-'));
 try{await symlink(root,join(root,'alias'));const s=new LocalDocumentStorage(join(root,'alias'));await assert.rejects(s.put(new Uint8Array(1),'text/plain'),/SYMLINK/);}
 finally{await rm(root,{recursive:true,force:true});}
});
const config={apiKey:'synthetic-key',model:'configured-model',baseUrl:'https://api.deepseek.com'};
test('provider minimizes every message including history and keeps model configurable',async()=>{
 let body;
 const provider=new DeepSeekProvider(config,async(url,init)=>{body=JSON.parse(init.body);assert.equal(init.redirect,'error');return Response.json({choices:[{message:{content:'Supported answer'}}],usage:{prompt_tokens:5,completion_tokens:2}});});
 assert.deepEqual(await provider.generate([{role:'assistant',content:'test@example.com 40702810000000000001 +7 (999) 111-22-33'}]),{text:'Supported answer',inputTokens:5,outputTokens:2});
 assert.equal(body.model,config.model);assert.doesNotMatch(body.messages[0].content,/test@example|40702810000000000001|999/);
 assert.doesNotMatch(minimizeQuestion('ИНН 7701234567'),/7701234567/);
});
for(const [name,request]of Object.entries({timeout:async()=>{throw Error('secret-connection-string');},unavailable:async()=>new Response('',{status:503}),invalid:async()=>Response.json({choices:[]}),promise:async()=>Response.json({choices:[{message:{content:'Банк точно одобрит'}}]})})){
 test(`provider ${name} returns deterministic fallback without operational error details`,async()=>{
  const r=await generateWithFallback(new DeepSeekProvider(config,request),[],()=> 'Local facts');
  assert.equal(r.text,'Local facts');assert.equal(r.mode,'rules');assert.equal(r.failure,'AI_PROVIDER_UNAVAILABLE');
 });
}
test('provider missing configuration and nonofficial endpoint fail safely',async()=>{
 assert.equal(configuredProvider({}),null);
 assert.throws(()=>new DeepSeekProvider({...config,baseUrl:'https://evil.example'}),/ENDPOINT/);
 assert.equal((await generateWithFallback(null,[],()=> 'Local facts')).mode,'rules');
});
test('provider smoke checks JSON response and reports safe unavailability',async()=>{
 const ok=new DeepSeekProvider(config,async()=>Response.json({choices:[{message:{content:'{"ok":true}'}}]}));
 assert.deepEqual(await ok.health(),{available:true,reason:null});
 const bad=new DeepSeekProvider(config,async()=>new Response('',{status:401}));
 assert.deepEqual(await bad.health(),{available:false,reason:'AI_SMOKE_UNAVAILABLE'});
});
test('data import rejects malformed rows without leaking row contents',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../lib/db/catalog.json',import.meta.url),'utf8'));
 const tables=Object.fromEntries(catalog.map(t=>[t.table,[]]));
 assert.equal(validateExport({tables}).valid,true);
 assert.equal(validateExport({tables:{...tables,analyses:null}}).valid,false);
 assert.equal(validateExport({tables:{...tables,analyses:[null]}}).valid,false);
 const report=validateExport({tables:{...tables,analyses:[{id:'a',owner_email:'private@example.com'},{id:'a',owner_email:''}]}});
 assert.ok(report.errors.some(x=>x.startsWith('DUPLICATE_ID')));assert.ok(report.errors.some(x=>x.startsWith('OWNERSHIP_MISSING')));
 assert.doesNotMatch(JSON.stringify(report.errors),/private@example/);
});
