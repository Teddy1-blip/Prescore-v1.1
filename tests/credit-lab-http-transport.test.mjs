import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import fs from 'node:fs';
import {postLoopbackJson} from './fixtures/loopback-json.mjs';

async function withServer(handler, run) {
  const sockets = new Set();
  let connections = 0, requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    Promise.resolve(handler(req, res)).catch(() => res.destroy());
  });
  server.on('connection', socket => {
    connections++; sockets.add(socket); socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/api/analysis`;
  try { await run({url, server, counts: () => ({connections, requests})}); }
  finally {
    const closed = new Promise(resolve => server.close(resolve));
    for (const socket of sockets) socket.destroy();
    await closed;
  }
}
const read = async req => {const chunks=[]; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks);};
const send = (res, status, body) => {res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(body));};
const post = (url, body = {statements:[]}) => postLoopbackJson(url, body, 'TRANSPORT_TEST');

for (const status of [200, 400, 401, 403, 409, 500]) test(`real HTTP preserves status ${status} and decoded response`, async () => {
  await withServer(async (req,res) => {
    assert.equal(req.method,'POST'); assert.equal(req.headers.connection,'close');
    assert.deepEqual(JSON.parse(await read(req)),{statements:[{text:'synthetic',fileName:'sample.txt'}]});
    send(res,status,{status,marker:'unchanged'});
  },async ({url,counts}) => {
    assert.deepEqual(await post(url,{statements:[{text:'synthetic',fileName:'sample.txt'}]}),{status,body:{status,marker:'unchanged'}});
    assert.deepEqual(counts(),{requests:1,connections:1});
  });
});

test('24 sequential uploads each use one fresh socket and one POST', async () => {
  await withServer(async(req,res)=>{await read(req);send(res,200,{ok:true});},async({url,counts})=>{
    for(let i=1;i<=24;i++) assert.equal((await postLoopbackJson(url,{statements:[]},`CL-RU-BUS-${String(i).padStart(3,'0')}`)).status,200);
    assert.deepEqual(counts(),{requests:24,connections:24});
  });
});

test('large synthetic body is delivered byte-for-byte, without truncation or retry',async()=>{
  const payload={statements:[{fileName:'large-synthetic.txt',text:'synthetic operation line\n'.repeat(50000)}]};
  const expected=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await withServer(async(req,res)=>send(res,200,{hash:createHash('sha256').update(await read(req)).digest('hex')}),async({url,counts})=>{
    assert.equal((await post(url,payload)).body.hash,expected);assert.equal(counts().requests,1);
  });
});

test('upload survives synchronous fixture work beyond the server idle timeout',async()=>{
  await withServer(async(req,res)=>{await read(req);send(res,200,{ok:true});},async({url,server,counts})=>{
    server.keepAliveTimeout=5000;
    for(let i=0;i<3;i++) await post(url);
    // The actual runtime test computes loadBusiness synchronously before upload.
    // Block this test's event loop, not an external server or the live app.
    const until=performance.now()+6500;while(performance.now()<until){ /* Simulate CPU-bound fixture preparation. */ }
    assert.deepEqual(await post(url),{status:200,body:{ok:true}});
    assert.deepEqual(counts(),{requests:4,connections:4});
  });
});

test('socket loss rejects once with safe transport cause; POST is never replayed',async()=>{
  await withServer(async(req,res)=>{await read(req);res.destroy();},async({url,counts})=>{
    await assert.rejects(post(url),e=>{
      assert.match(e.message,/case=TRANSPORT_TEST phase=REQUEST status=NONE code=(UND_ERR_SOCKET|ECONNRESET)/);
      assert.equal(e.cause,undefined);return true;
    });
    assert.equal(counts().requests,1);
  });
});

test('malformed JSON is a failure, not a substituted successful result',async()=>{
  await withServer(async(req,res)=>{await read(req);res.end('PRIVATE_SYNTHETIC_RESPONSE');},async({url,counts})=>{
    await assert.rejects(post(url),e=>{assert.match(e.message,/phase=RESPONSE_JSON status=200/);assert.doesNotMatch(e.message,/PRIVATE_SYNTHETIC_RESPONSE/);return true;});
    assert.equal(counts().requests,1);
  });
});

test('truncated response fails while reading body and is not replayed',async()=>{
  await withServer(async(req,res)=>{
    await read(req);res.writeHead(200,{'content-type':'application/json','content-length':'1000'});res.write('{"ok":');setTimeout(()=>res.destroy(),20);
  },async({url,counts})=>{
    await assert.rejects(post(url),/phase=RESPONSE_BODY status=200/);assert.equal(counts().requests,1);
  });
});

test('redirect is rejected rather than following another endpoint',async()=>{
  await withServer(async(req,res)=>{await read(req);res.writeHead(307,{location:'/other'});res.end();},async({url,counts})=>{
    await assert.rejects(post(url),/phase=REQUEST status=NONE/);assert.equal(counts().requests,1);
  });
});
for(const target of ['https://127.0.0.1:1234/api','http://example.invalid:1234/api','http://localhost:1234/api','http://user:pass@127.0.0.1:1234/api','http://127.0.0.1:1234/api?secret=1']) test('reject non-isolated target '+target.replace(/user:pass@/,'[credentials]@'),async()=>{
  await assert.rejects(post(target),/CREDIT_LAB_HTTP_LOOPBACK_ONLY/);
});
test('diagnostic labels cannot contain source data',async()=>{
  await assert.rejects(postLoopbackJson('http://127.0.0.1:1234/api',{},'PRIVATE SYNTHETIC DOCUMENT'),/^Error: CREDIT_LAB_HTTP_LABEL_INVALID$/);
});
test('real integration still runs every case and checks SQL, FULL, ownership and truncation',()=>{
  const source=fs.readFileSync('tests/credit-lab-runtime.test.mjs','utf8');
  for(const text of ['for(const c of businessCatalog())','postLoopbackJson(url,{statements},label)','upload(b.statements,c.caseId)','saved.metricsV2,b.full.metricsV2','saved.transactions.length,10000',"status,'LOCKED'","status,'NOT_FOUND'","status,'READY'"]) assert.ok(source.includes(text),text);
  assert.doesNotMatch(source,/test\.skip|t\.skip|test\.only|t\.only|\.retry\(|setTimeout/);
});
