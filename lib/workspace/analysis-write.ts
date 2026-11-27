type AnalysisWriteDatabase = {
  prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
};

export async function updateActiveAnalysis(
  db: AnalysisWriteDatabase,
  analysisId: string,
  ownerEmail: string | undefined,
  expectedPayload: string,
  nextPayload: string,
): Promise<boolean> {
  if (ownerEmail === undefined) return false;
  const result = await db.prepare(
    "UPDATE analyses SET payload = ? WHERE id = ? AND owner_email = ? AND archive_state = 'ACTIVE' AND payload = ?"
  ).bind(nextPayload, analysisId, ownerEmail, expectedPayload).run() as {meta?: {changes?: number}};
  return result.meta?.changes === 1;
}
