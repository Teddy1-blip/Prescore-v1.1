/** Test-only HTTP transport. No pooling across synchronous fixture preparation,
 * no request replay and no external destinations. Still uses a real HTTP socket.
 */
const safeCodes = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT',
  'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT', 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH',
  'UND_ERR_RES_CONTENT_LENGTH_MISMATCH',
]);
function failure(error, label, phase, status) {
  let code = 'UNCLASSIFIED';
  for (let e = error, depth = 0; e && depth < 4; e = e.cause, depth++) {
    if (safeCodes.has(e.code)) { code = e.code; break; }
  }
  // Do not attach raw cause/message: the test runner would print it, including
  // any response body or supplied document accidentally present in that error.
  return new Error(`CREDIT_LAB_HTTP_FAILURE case=${label} phase=${phase} status=${status ?? 'NONE'} code=${code}`);
}
export async function postLoopbackJson(target, value, label) {
  if (typeof label !== 'string' || !/^(?:CL-RU-BUS-\d{3}|PRECHECK_(?:UNAUTHORIZED|EMPTY)|TRANSPORT_TEST)$/.test(label)) {
    throw new Error('CREDIT_LAB_HTTP_LABEL_INVALID');
  }
  const url = new URL(target);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash) {
    throw new Error('CREDIT_LAB_HTTP_LOOPBACK_ONLY');
  }
  const body = JSON.stringify(value);
  let phase = 'REQUEST', status;
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'error',
      headers: {'content-type': 'application/json', connection: 'close'},
      body,
    });
    status = response.status;
    phase = 'RESPONSE_BODY';
    const text = await response.text();
    phase = 'RESPONSE_JSON';
    return {status, body: JSON.parse(text)};
  } catch (error) {
    throw failure(error, label, phase, status);
  }
}
