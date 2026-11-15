import {routeDocument} from '../lib/document-poc/document-routing.ts';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(new URL('../app/api/document-ocr/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ID='12345678-1234-4234-9234-1234567890ab';
function make({user={email:'owner@test.invalid',isAdmin:false},access=true,document={id:ID,fileName:'test.pdf',category:'Контракты, УПД и акты',sizeBytes:4,contentBase64:'',storageKey:'stored'},ocr=null}={}){
 let called=0,scoped=false,args=null;
 const deps={
  '../../../lib/auth/broker-authorizations':{documentAccessSQL:()=>{scoped=true;return 'd.owner_email=actor.email'}},
  '../../../lib/platform/runtime':{getRuntime:()=>({DB:{prepare:(sql)=>({bind:(...params)=>({sql,params})}),batch:async()=>[{results:access?[document]:[]}]}})},
  '../../../lib/storage/documents':{documentStorage:()=>({get:async()=>Buffer.from('FAKE')})},
  '../../../lib/document-poc/local-ocr':{OCR_MAX_BYTES:16*1024*1024,OCR_BATCH_PAGES:3,recognizeLocalDocument:async(bytes,options)=>{called++;args=options;return ocr??{version:'PRESCORE-LOCAL-OCR-0.2',pageCount:32,processedFrom:options.fromPage,processedTo:options.toPage,layout:options.layout,quality:options.quality,pages:[{page:1,logicalPage:1,segment:'LEFT',method:'OCR',text:'Аванс до 15%'}],outboundTransfer:false,creditEngineUpdated:false,warnings:[]}}},
  '../../../lib/document-poc/document-routing':{routeDocument},
  '../../../lib/document-poc/financial-terms':{contractEvidence:()=>[{kind:'ADVANCE',page:1,sourceText:'Аванс до 15%',status:'REVIEW'}]},
  '../api-auth':{requireApiUser:async()=>user,unauthorized:()=>Response.json({error:'auth'},{status:401})},
 };
 const exports={};new Function('exports','require',code)(exports,n=>{if(n in deps)return deps[n];throw Error('UNEXPECTED_IMPORT:'+n)});
 return {POST:exports.POST,counts:()=>({called,scoped,args})};
}
const request=(body={documentId:ID},headers={})=>new Request('https://prescore.test/api/document-ocr',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('requires auth and document owner/grant scope before OCR',async()=>{
 const anon=make({user:null});assert.equal((await anon.POST(request())).status,401);assert.equal(anon.counts().called,0);
 const other=make({access:false});assert.equal((await other.POST(request())).status,404);assert.equal(other.counts().scoped,true);assert.equal(other.counts().called,0);
});
test('never invokes remote provider and preserves private response',async()=>{
 const own=make();const r=await own.POST(request({documentId:ID,fromPage:4,toPage:6,quality:'HIGH',layout:'TWO_UP_ROTATED'}));
 assert.equal(r.status,200);const out=await r.json();assert.equal(out.ocr.outboundTransfer,false);assert.equal(out.ocr.creditEngineUpdated,false);assert.equal(own.counts().called,1);assert.equal(own.counts().args.layout,'TWO_UP_ROTATED');assert.match(r.headers.get('cache-control'),/no-store/);
});
test('cross-origin, invalid IDs and unbounded ranges are rejected',async()=>{
 const r=make();assert.equal((await r.POST(request({documentId:ID},{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await r.POST(request({documentId:'wrong'}))).status,400);
 assert.equal((await r.POST(request({documentId:ID,fromPage:1,toPage:12}))).status,400);
 assert.equal(r.counts().called,0);
});
test('non-pdf or oversized file rejected',async()=>{
 assert.equal((await make({document:{id:ID,fileName:'private.xlsx',sizeBytes:4}}).POST(request())).status,415);
 assert.equal((await make({document:{id:ID,fileName:'private.pdf',sizeBytes:17*1024*1024}}).POST(request())).status,413);
});

test('OCR batch routing does not pretend all 32 sheets were read',async()=>{
 const r=await make().POST(request({documentId:ID,fromPage:1,toPage:1,expectedFamily:'BFO'}));
 const body=await r.json();assert.equal(r.status,200);assert.equal(body.routingScope,'CURRENT_OCR_BATCH');
 assert.equal(body.routing.expectedFamily,'BFO');assert.equal(body.routing.coverage.complete,false);assert.equal(body.routing.parser,null);assert.deepEqual(body.hints,[]);
});
test('invalid requested family is rejected before OCR',async()=>{
 const m=make();const r=await m.POST(request({documentId:ID,expectedFamily:'ALL'}));assert.equal(r.status,400);assert.equal(m.counts().called,0);
});

test('contract filename/category cannot turn a balance sheet into contract hints',async()=>{
 const ocr={version:'test',pageCount:1,processedFrom:1,processedTo:1,pages:[{page:1,logicalPage:1,segment:'FULL',method:'TEXT',text:'Бухгалтерский баланс'}],warnings:[]};
 const m=make({ocr});const r=await m.POST(request({documentId:ID,fromPage:1,toPage:1,expectedFamily:'COMMERCIAL'}));
 const data=await r.json();assert.equal(data.routing.actualFamily,'BFO');assert.equal(data.routing.status,'TYPE_MISMATCH');assert.deepEqual(data.hints,[]);
});
test('family arrays and objects cannot bypass request validation',async()=>{
 for(const expectedFamily of [['BFO'],{value:'BFO'}]){const m=make();assert.equal((await m.POST(request({documentId:ID,expectedFamily}))).status,400);assert.equal(m.counts().called,0);}
});
