import type { AnalysisSourceManifest, SourceEnvelope } from "../contracts/sources.ts";
import type { FinancialStatementSnapshot } from "../contracts/financial-statements.ts";

export function financialSources(manifest?: Partial<AnalysisSourceManifest>): SourceEnvelope[] {
  // Current envelopes supersede historical upload descriptors for the same content.
  return [...new Map([...(manifest?.financialUploads ?? []), manifest?.bfo, manifest?.quarterly]
    .filter((source): source is SourceEnvelope => !!source).map(source => [source.sourceId, source])).values()];
}

export function currentFinancialSnapshots(snapshots: FinancialStatementSnapshot[], manifests: Array<Partial<AnalysisSourceManifest> | undefined>) {
  const sources = [...new Map(manifests.flatMap(financialSources).map((source) => [source.sourceId, source])).values()];
  return [...new Map(snapshots.flatMap((snapshot) => {
    const source = sources.find((candidate) => candidate.sourceType === snapshot.sourceType
      && candidate.companyInn === snapshot.companyInn
      && candidate.sourceId === snapshot.sourceId
      && (!candidate.contentHash || candidate.contentHash === snapshot.source.contentHash));
    return source ? [{ ...snapshot, source }] : [];
  }).map((snapshot) => [snapshot.snapshotId, snapshot])).values()];
}

function sourceAuthority(sourceId: string, manifests: Array<Partial<AnalysisSourceManifest> | undefined>) {
  let authority = 0;
  manifests.forEach((manifest, index) => {
    if (!manifest) return;
    const explicitUpload = manifest.financialUploads?.some((source) => source.sourceId === sourceId) ?? false;
    const currentPointer = manifest.bfo?.sourceId === sourceId || manifest.quarterly?.sourceId === sourceId;
    // The first manifest is the saved client analysis. Later manifests are enrichment profiles.
    // A client-uploaded period is authoritative for that exact period; external BFO remains a fallback.
    if (explicitUpload) authority = Math.max(authority, index === 0 ? 400 : 300);
    else if (currentPointer) authority = Math.max(authority, index === 0 ? 350 : 200);
  });
  return authority;
}

function economicPeriodKey(snapshot: FinancialStatementSnapshot) {
  return [
    snapshot.companyInn,
    snapshot.accountingStandard,
    snapshot.currency,
    snapshot.period.kind,
    snapshot.period.from ?? "",
    snapshot.period.to ?? "",
    snapshot.period.asOf ?? "",
  ].join("|");
}

function preferCandidate(
  candidate: FinancialStatementSnapshot,
  current: FinancialStatementSnapshot,
  manifests: Array<Partial<AnalysisSourceManifest> | undefined>,
) {
  const candidateAuthority = sourceAuthority(candidate.sourceId, manifests);
  const currentAuthority = sourceAuthority(current.sourceId, manifests);
  if (candidateAuthority !== currentAuthority) return candidateAuthority > currentAuthority;
  const candidateReceived = candidate.source.receivedAt ?? "";
  const currentReceived = current.source.receivedAt ?? "";
  if (candidateReceived !== currentReceived) return candidateReceived > currentReceived;
  return candidate.sourceId > current.sourceId;
}

export function activeFinancialSnapshots(snapshots: FinancialStatementSnapshot[], manifests: Array<Partial<AnalysisSourceManifest> | undefined>) {
  const active = currentFinancialSnapshots(snapshots, manifests).filter((snapshot) => snapshot.source.status === "READY");
  const selected = new Map<string, FinancialStatementSnapshot>();
  for (const snapshot of active) {
    const key = economicPeriodKey(snapshot);
    const current = selected.get(key);
    if (!current || preferCandidate(snapshot, current, manifests)) selected.set(key, snapshot);
  }
  return [...selected.values()].sort((left, right) =>
    (left.period.asOf ?? "").localeCompare(right.period.asOf ?? "") || left.snapshotId.localeCompare(right.snapshotId),
  );
}
