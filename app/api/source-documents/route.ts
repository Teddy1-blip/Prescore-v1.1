import { buildRiskShadow } from "../../../lib/credit-engine/risk/integration";
import { applyAnalysisControls, readControlState } from "../../../lib/admin-controls";
import {
  INFRASTRUCTURE_VERSIONS,
  parseAuthoritativeCreditHistoryText,
  parseAuthoritativeQuarterlyText,
  sha256Hex,
  sourceReference,
  withRefreshedIntegrity,
  type AnalysisSourceManifest,
  type SourceEnvelope,
} from "../../../lib/credit-engine/source-foundation";
import { extractDocumentText } from "../../../lib/credit-engine/server/document-extraction";
import { compareCreditPortfolio, type CreditSubjectRelationship } from "../../../lib/credit-history";
import { analysisForStorage, type AnalysisResult } from "../../../lib/prescore";
import { analysisView, resolveAnalysisTier } from "../../../lib/entitlements";
import { quarterlyFinancialShadow } from "../../../lib/credit-engine/financial-analysis/integration";
import { reconciliationForAnalysis } from "../../../lib/credit-engine/reconciliation/integration";
import { portfolioForAnalysis } from "../../../lib/credit-engine/credit-portfolio/integration";
import { requireApiUser, unauthorized } from "../api-auth";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
};

type Database = {
  prepare: (query: string) => Statement;
  batch: (statements: Statement[]) => Promise<Array<{ results: unknown[] }>>;
};

const BKI_MAX_BYTES = 35 * 1024 * 1024;
const QUARTERLY_MAX_BYTES = 25 * 1024 * 1024;

async function database() {
  const runtimeModule = "cloudflare:workers";
  const { env } = await import(runtimeModule);
  return env.DB as unknown as Database;
}

function safeJson<T>(value: string): T | null {
  try { return JSON.parse(value) as T; } catch { return null; }
}

function manifestOf(analysis: AnalysisResult): AnalysisSourceManifest {
  return analysis.sourceManifest ?? { bankStatements: [] };
}

function envelope(input: {
  sourceId: string;
  sourceType: "BKI" | "QUARTERLY";
  companyInn: string;
  fileName: string;
  sourceName: string;
  parserVersion: string;
  confidence: number;
  warnings: string[];
  contentHash: string;
  fieldAvailability?: Record<string, "KNOWN" | "UNKNOWN">;
}): SourceEnvelope {
  return {
    ...input,
    status: "READY",
    receivedAt: new Date().toISOString(),
    integrityVersion: INFRASTRUCTURE_VERSIONS.integrity,
    rawReference: sourceReference(input.contentHash),
  };
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const form = await request.formData();
    const analysisId = String(form.get("analysisId") || "").trim();
    const sourceType = String(form.get("sourceType") || "").trim();
    const relationship = String(form.get("relationship") || "Не указано") as CreditSubjectRelationship;
    const file = form.get("file");
    if (!analysisId || !(file instanceof File)) return Response.json({ error: "Не передан файл или анализ" }, { status: 400 });
    if (sourceType !== "BKI" && sourceType !== "QUARTERLY") return Response.json({ error: "Неизвестный тип источника" }, { status: 400 });
    const maxBytes = sourceType === "BKI" ? BKI_MAX_BYTES : QUARTERLY_MAX_BYTES;
    if (!file.size || file.size > maxBytes) return Response.json({ error: "Файл пустой или превышает допустимый размер" }, { status: 413 });
    const lowerName = file.name.toLowerCase();
    if (sourceType === "BKI" && !lowerName.endsWith(".pdf")) return Response.json({ error: "Для БКИ поддерживается текстовый PDF" }, { status: 415 });
    if (sourceType === "QUARTERLY" && !/\.(pdf|xlsx|csv)$/.test(lowerName)) return Response.json({ error: "Поддерживаются PDF, XLSX и CSV" }, { status: 415 });

    const db = await database();
    const row = await db.prepare("SELECT payload, owner_email AS ownerEmail FROM analyses WHERE id = ? LIMIT 1")
      .bind(analysisId).first<{ payload?: string; ownerEmail?: string }>();
    if (!row?.payload || (row.ownerEmail !== user.email && !user.isAdmin)) return Response.json({ error: "Анализ не найден в вашем кабинете" }, { status: 404 });
    const analysis = safeJson<AnalysisResult>(row.payload);
    if (!analysis) return Response.json({ error: "Сохранённый анализ повреждён" }, { status: 409 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentHash = await sha256Hex(bytes);
    const existingSource = sourceType === "BKI" ? analysis.sourceManifest?.bki : analysis.sourceManifest?.quarterly;
    if (existingSource?.contentHash === contentHash) {
      return Response.json({ error: "Этот исходный файл уже прикреплён к анализу", duplicate: true, source: existingSource }, { status: 409 });
    }
    const sourceId = `${sourceType.toLowerCase()}:${contentHash}`;
    const text = await extractDocumentText(file.name, bytes);
    let updated: AnalysisResult;
    let verifiedReport: unknown;
    let verifiedSource: SourceEnvelope;

    if (sourceType === "BKI") {
      const report = parseAuthoritativeCreditHistoryText({ text, fileName: file.name, analysisInn: analysis.companyInn, relationship });
      const calculated = compareCreditPortfolio({
        report,
        avgMonthlyInflow: analysis.metrics.avgMonthlyInflow,
        statementMonthlyDebtPayment: analysis.metrics.currentMonthlyDebtPayment,
        baseMonthlyPaymentCapacity: analysis.metrics.baseMonthlyPaymentCapacity,
        estimatedLimitMax: analysis.metrics.estimatedLimitMax,
        limitConfidence: analysis.metrics.limitConfidence,
      });
      const known = report.summary.knownValues;
      verifiedSource = envelope({
        sourceId,
        sourceType,
        companyInn: analysis.companyInn,
        fileName: file.name,
        sourceName: report.source,
        parserVersion: "PRESCORE-BKI-PARSER-1",
        confidence: report.parserConfidence,
        warnings: report.warnings,
        contentHash,
        fieldAvailability: known ? {
          originalAmount: known.originalAmount ? "KNOWN" : "UNKNOWN",
          outstandingPrincipal: known.outstandingPrincipal ? "KNOWN" : "UNKNOWN",
          totalOutstanding: known.totalOutstanding ? "KNOWN" : "UNKNOWN",
          monthlyPayment: known.monthlyPayment ? "KNOWN" : "UNKNOWN",
          overdueAmount: known.overdueAmount ? "KNOWN" : "UNKNOWN",
          guaranteeExposure: known.guaranteeExposure ? "KNOWN" : "UNKNOWN",
        } : undefined,
      });
      updated = withRefreshedIntegrity({
        ...analysis,
        creditHistory: report,
        creditPortfolioComparison: calculated.comparison,
        creditHistoryInsights: calculated.insights,
        sourceManifest: { ...manifestOf(analysis), bki: verifiedSource },
      });
      verifiedReport = report;
    } else {
      const report = parseAuthoritativeQuarterlyText({ text, fileName: file.name, analysisInn: analysis.companyInn });
      const fieldAvailability = Object.fromEntries(Object.entries(report.values).map(([key, value]) => [key, value === null ? "UNKNOWN" : "KNOWN"])) as Record<string, "KNOWN" | "UNKNOWN">;
      const warnings = [...report.warnings];
      if (!report.companyInn) warnings.push("ИНН не найден в файле; принадлежность подтверждена только выбранным досье и пользователем.");
      verifiedSource = envelope({
        sourceId,
        sourceType,
        companyInn: analysis.companyInn,
        fileName: file.name,
        sourceName: "Квартальная отчётность",
        parserVersion: "PRESCORE-QUARTERLY-PARSER-1",
        confidence: report.parserConfidence,
        warnings,
        contentHash,
        fieldAvailability,
      });
      updated = withRefreshedIntegrity({
        ...analysis,
        quarterlyReport: report,
        ...quarterlyFinancialShadow(report, verifiedSource, analysis.financialStatementsV2),
        sourceManifest: { ...manifestOf(analysis), quarterly: verifiedSource },
      });
      verifiedReport = report;
    }

    updated = { ...updated, ...reconciliationForAnalysis(updated) };
    if (sourceType === "BKI") {
      const asOfDate = [updated.periodTo, updated.creditHistory?.reportDate ?? ""].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) ?? "";
      updated = { ...updated, ...portfolioForAnalysis(updated, { asOfDate }) };
    }
    const riskAsOf = [updated.periodTo, updated.creditHistory?.reportDate ?? "", updated.financialAnalysisV2?.latestInterim?.snapshot.period.asOf ?? ""].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) ?? "";
    updated = { ...updated, ...buildRiskShadow({ analysis: updated, asOfDate: riskAsOf }) };
    const stored = analysisForStorage(updated);
    await db.prepare("UPDATE analyses SET payload = ? WHERE id = ? AND owner_email = ?")
      .bind(JSON.stringify(stored), analysisId, row.ownerEmail).run();
    const controls = await readControlState(db as unknown as Parameters<typeof readControlState>[0]);
    const tier = await resolveAnalysisTier(db, { analysisId, userEmail: row.ownerEmail || user.email, companyInn: stored.companyInn, privileged: user.isAdmin });
    return Response.json({
      analysis: analysisView(applyAnalysisControls(stored, controls), tier),
      report: sourceType === "QUARTERLY" && tier === "FREE"
        ? Object.fromEntries(Object.entries(verifiedReport as Record<string, unknown>).filter(([key]) => key !== "financialMetadataV2"))
        : verifiedReport,
      source: verifiedSource,
      processedBy: "server",
      originalFileStored: false,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обработать источник" }, { status: 400 });
  }
}
