/** Codespaces rewrites same-origin browser requests to its loopback upstream.
 * Restore the configured origin only for a proven request from our private dev port.
 */
export function codespaceBrowserOrigin(headers: Headers, env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV !== 'development' || env.PRESCORE_RUNTIME_MODE !== 'development' || env.CODESPACES !== 'true') return null;
  const name = env.CODESPACE_NAME;
  const base = env.PRESCORE_BASE_URL;
  if (!name || !/^[a-z0-9-]+$/.test(name) || !base) return null;
  const host = headers.get('x-forwarded-host');
  const local = headers.get('host');
  const port = /^localhost:([1-9]\d{0,4})$/.exec(local ?? '')?.[1];
  if (!port || Number(port) > 65535 || host !== name + '-' + port + '.app.github.dev' || base !== 'https://' + host) return null;
  if (headers.get('x-forwarded-proto') !== 'https' || headers.get('sec-fetch-site') !== 'same-origin') return null;
  const upstreamOrigin = 'http://' + local;
  if (headers.get('origin') !== upstreamOrigin) return null;
  try {
    const from = new URL(headers.get('referer') ?? '').origin;
    return from === base ? base : null;
  } catch {
    return null;
  }
}
