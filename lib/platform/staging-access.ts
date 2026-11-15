import { createHash } from 'node:crypto';

/** Temporary staging-only access; never grants or records a payment. */
const stagingOrigins = new Set([
  'https://prescore-staging-dorogovab.amvera.io',
  'https://prescore-staging-dorogovab.msk1.amvera.tech',
]);

function isStagingRuntime(env: Record<string, string | undefined> = process.env): boolean {
  if (env.PRESCORE_RUNTIME_MODE !== 'release-candidate') return false;
  try {
    const url = new URL(env.PRESCORE_BASE_URL ?? '');
    return stagingOrigins.has(url.origin)
      && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function stagingFullAccessEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PRESCORE_STAGING_FREE_FULL === '1' && isStagingRuntime(env);
}

// This shortcut is a staging fixture for the explicitly designated account.
// Caller supplies the identity from the authenticated session.
const testOwnerDigest = 'e09c8a4d4160ec955944d7eb375f19026e192caadb29736516b2bc3207d98f2d';
export function stagingOwnerWorkspace(email: string, env: Record<string, string | undefined> = process.env): boolean {
  return isStagingRuntime(env) && createHash('sha256').update(email.trim().toLowerCase()).digest('hex') === testOwnerDigest;
}
