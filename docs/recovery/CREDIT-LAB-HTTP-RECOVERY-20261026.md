# Credit Lab HTTP transport recovery

Date: 2026-10-26. Recovery parent: `ac60892bf818302654514a70b8b66a1769b877f5`.
Staging source: `3112d16e101d0268abd0b516923cde564b5869e1`.
Issue #11 observation: Amvera revision `176c9d1…`, 6640 pass / 2 fail.
Scope: test transport and documentation only. Full build/live acceptance pending.

## Observed versus reproduced

The observed failures are one `TypeError: fetch failed` on the case 024 upload and its parent `subtestsFailed`. The build log contains no underlying socket error code; an Amvera-specific root cause, OOM or timeout is NOT established.

The test awaits 24 sequential HTTP uploads to a disposable loopback server. Between uploads, `loadBusiness` synchronously parses/calculates the next expected fixture, while client and server share the event loop. The original helper uses pooled fetch connections. The initial 401/400 response bodies are not consumed.

A real local HTTP replay executes the EXACT original upload declaration, extracted from the verified test blob `3a183626c82ce642e875c8e3bf0181dc07427557`. Three requests prime the connections, then 6.5 seconds of synchronous fixture work exceeds the server's 5-second keep-alive timeout. The fourth upload fails with `TypeError: fetch failed`, cause `ECONNRESET`; only 3 requests reached the server across 2 connections. With the new helper, all 4 requests reach the server exactly once across 4 connections. No client/server network calls are mocked in this replay.

This proves a transport failure mode in the harness and its correction locally. It does NOT prove that the hidden cause in Amvera was ECONNRESET; the new safe diagnostic will identify another transport cause if it remains.

## Correction

`postLoopbackJson` is confined to tests. It sends one POST using `Connection: close`, consumes every response body (including 401/400), preserves HTTP status and parsed JSON, rejects redirects/non-loopback destinations, and never retries or replays POST. It does not change timeouts, resource limits or calculation inputs. Real socket loss, malformed/truncated responses and HTTP errors are not converted into success.

On failure, the helper reports the synthetic case ID, phase (request/body/JSON), HTTP status where available, and an allowlisted transport cause. It does not print response/document contents, URLs, credentials or raw exception causes.

The integration continues to execute the real upload route, SQL persistence in PGlite, ownership, FREE/FULL authorization, all 24 business cases, canonical output and the 10000-row display truncation guard. Existing economic and access assertions remain unchanged. The payload still contains the complete statement; transport tests include a large byte-exact synthetic body.

## Executed evidence

Node 22.16.0 / bundled Undici 6.21.2. No downloaded dependencies required for the transport tests.

- `node --test tests/credit-lab-http-transport.test.mjs`: **20 passed, 0 failed, 0 skipped**.
- Tests use real loopback HTTP, including 24 sequential uploads, the synchronous stall, a large request, forced connection loss, truncated response, invalid JSON, rejected redirect, preserved 200/400/401/403/409/500 statuses and restricted destinations.
- Original upload declaration replay: `fetch failed / ECONNRESET`, 3 accepted requests / 2 connections. Patched replay: success, 4 accepted requests / 4 connections. No hidden retry.
- `node --check` passes for all three changed/new JavaScript files.
- Original runtime test was reconstructed from the supplied historical bundle plus exact known source edits, then verified against the CURRENT GitHub blob above before patching. The historical tree is not a commit parent.

Not executed locally: full current PGlite/React/runtime integration, Next build, complete regression, later Credit Lab/lint/artifact/PDF gates or authenticated browser. The local npm probe returned `EAI_AGAIN registry.npmjs.org`; those dependencies were not installed. No success for CL-RU-BUS-024 in Amvera is claimed yet.

## Delivery and acceptance

Continue through the existing recovery -> staging -> Amvera webhook. Keep mandatory build gates and all existing expectations. Do not change Docker, runtime code, formulas, baselines, database, domain, providers, payment settings or paid Actions. No new applications or branches.

Work must collect the final result of the next exact source revision, all `not ok` entries and the safe transport cause if present. Do not launch duplicate rebuilds, blindly extend timeouts, remove case 024 or ignore a failure. On full success check activation, health/ready and authenticated dashboard separately. The product's 19-block acceptance and prescore.ru work remain open.

Reference for the socket-reuse race: Node.js HTTP docs, request.reusedSocket and server.keepAliveTimeout, https://nodejs.org/api/http.html. Reference for consuming response bodies: https://github.com/nodejs/undici#garbage-collection. These describe the failure class, not the missing cause from the Amvera log.
