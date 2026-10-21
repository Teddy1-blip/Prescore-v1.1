/** Temporary staging-only access; never grants or records a payment. */
const stagingOrigins = new Set([
  'https://prescore-staging-dorogovab.amvera.io',
  'https://prescore-staging-dorogovab.msk1.amvera.tech',
]);

export function stagingFullAccessEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.PRESCORE_STAGING_FREE_FULL !== '1' || env.PRESCORE_RUNTIME_MODE !== 'release-candidate') return false;
  try {
    const url = new URL(env.PRESCORE_BASE_URL ?? '');
    return stagingOrigins.has(url.origin)
      && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
