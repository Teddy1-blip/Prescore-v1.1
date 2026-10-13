import type { AnalysisSourceManifest, SourceEnvelope } from "../contracts/sources.ts";
import type { FinancialStatementSnapshot } from "../contracts/financial-statements.ts";

export function financialSources(manifest?: Partial<AnalysisSourceManifest>): SourceEnvelope[] {
  // Current envelopes supersede historical upload descriptors for the same content.
  return [...new Map([...(manifest?.financialUploads ?? []), manifest?.bfo, manifest?.quarterly]
    .filter((source): source is SourceEnvelope => !!source).map(source => [source.sourceId, source])).values()];
}
export function currentFinancialSnapshots(snapshots: FinancialStatementSnapshot[], manifests: Array<Partial<AnalysisSourceManifest> | undefined>) {
  const sources = [...new Map(manifests.flatMap(financialSources).map(s => [s.sourceId, s])).values()];
  return [...new Map(snapshots.flatMap(snapshot => {
    const source = sources.find(s => s.sourceType === snapshot.sourceType && s.companyInn === snapshot.companyInn
      && s.sourceId === snapshot.sourceId && (!s.contentHash || s.contentHash === snapshot.source.contentHash));
    return source ? [{...snapshot, source}] : [];
  }).map(snapshot => [snapshot.snapshotId, snapshot])).values()];
}
export function activeFinancialSnapshots(snapshots: FinancialStatementSnapshot[], manifests: Array<Partial<AnalysisSourceManifest> | undefined>) {
  return currentFinancialSnapshots(snapshots, manifests).filter(s => s.source.status === 'READY');
}
