/** Public marketing CTA navigation. Do not change app auth origin or payment callbacks. */
const allowedPath = /^\/(?:login|dashboard|agent|checkout|billing)(?:\/|\?|#|$)/;
export function publicAppLink(path: string, configuredOrigin?: string): string {
  if (!allowedPath.test(path) || path.includes('\\') || path.includes('//') || /[\r\n]/.test(path)) {
    throw new Error('INVALID_PUBLIC_APP_PATH');
  }
  if (!configuredOrigin) return path;
  let parsed: URL;
  try { parsed = new URL(configuredOrigin); }
  catch { throw new Error('INVALID_PUBLIC_APP_ORIGIN'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.port) {
    throw new Error('INVALID_PUBLIC_APP_ORIGIN');
  }
  return parsed.origin + path;
}
export function configuredAppLink(path: string): string {
  return publicAppLink(path, process.env.NEXT_PUBLIC_PRESCORE_APP_ORIGIN);
}
