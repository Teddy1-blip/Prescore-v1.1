/** Temporary staging-only access; never grants or records a payment. */
export function stagingFullAccessEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PRESCORE_STAGING_FREE_FULL === '1'
    && env.PRESCORE_BASE_URL?.replace(/\/$/, '') === 'https://prescore-staging-dorogovab.amvera.io';
}
