import type { AnalysisSourceManifest, SourceEnvelope } from "../contracts/sources.ts";
import type { FinancialStatementSnapshot } from "../contracts/financial-statements.ts";

export function financialSources(manifest?: Partial<AnalysisSourceManifest>): SourceEnvelope[] {
  return [...new Map([manifest?.bfo, manifest?.quarterly, ...(manifest?.financialUploads ?? [])]
    .filter((source): source is SourceEnvelope => !!source).map(source => [source.sourceId, source])).values()];
}
export function activeFinancialSnapshots(snapshots: FinancialStatementSnapshot[], manifests: Array<Partial<AnalysisSourceManifest> | undefined>) {
  const sources = manifests.flatMap(financialSources);
  return [...new Map(snapshots.filter(snapshot => sources.some(source => source.status === 'READY'
    && source.sourceType === snapshot.sourceType && source.companyInn === snapshot.companyInn
    && source.sourceId === snapshot.sourceId && (!source.contentHash || source.contentHash === snapshot.source.contentHash)))
    .map(snapshot => [snapshot.snapshotId, snapshot])).values()];
}
