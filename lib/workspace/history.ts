// Release metadata for the owner's three protected staging fixtures.
// Applied only AFTER the existing owner/assigned-broker access check. This
// designation changes presentation, never ownership, payload, tier or ACTIVE.
const protectedStagingQa = new Set([
  '36527dc1-d7db-4fef-bd47-719a451b4d58',
  '992ab9e3-672e-4adf-955e-9a2c40e3ece3',
  '7ec7daeb-dfef-4f1f-9c9d-15ea86fe864c',
]);
export function historyPurpose(id: string): 'WORK' | 'QA' {
  const staging = process.env.PRESCORE_RUNTIME_MODE === 'release-candidate'
    && process.env.PRESCORE_BASE_URL === 'https://prescore-staging-dorogovab.msk1.amvera.tech';
  return staging && protectedStagingQa.has(id) ? 'QA' : 'WORK';
}
export function withHistoryPurpose<T extends {id: string}>(analysis: T) {
  return {...analysis, historyPurpose: historyPurpose(analysis.id)};
}
