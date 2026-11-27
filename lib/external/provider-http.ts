export async function boundedBytes(response: Response, maximum: number) {
  if (!response.ok || !response.body) throw Error('PROVIDER_RESPONSE_FAILED');
  if (Number(response.headers.get('content-length')) > maximum) {
    await response.body.cancel();
    throw Error('PROVIDER_SIZE_LIMIT');
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maximum) {
        await reader.cancel();
        throw Error('PROVIDER_SIZE_LIMIT');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
