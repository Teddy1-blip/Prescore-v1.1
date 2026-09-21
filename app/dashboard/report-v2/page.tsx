import {notFound, redirect} from 'next/navigation';
import Link from 'next/link';
import {ClientReportShell} from './client-report.tsx';
import {PrintReport} from './print-report.tsx';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import type {CompanyProfileData} from '../../../lib/company-profile';
import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser, readableAnalysis} from '../../api/api-auth';
import {resolveAnalysisTier, type EntitlementDatabase} from '../../../lib/entitlements';
import {loadCanonicalReport} from '../../../lib/credit-engine/production/report-service.ts';
import './report-v2.css';
export const dynamic = 'force-dynamic';
export default async function ReportPage({searchParams}: {searchParams: Promise<{analysisId?: string; sample?: string; print?: string}>}) {
 const query = await searchParams;
 // A supplied real analysis ID can never fall through into fixture loading.
 if (query.analysisId) {
  const user = await requireApiUser();
  if (!user) redirect('/login?returnTo=' + encodeURIComponent('/dashboard/report-v2?analysisId=' + encodeURIComponent(query.analysisId)));
  const db = getRuntime().DB as unknown as EntitlementDatabase;
  const result = await loadCanonicalReport(query.analysisId, {
   readAccess: id => readableAnalysis(db, id, user),
   readTier: (id, access) => resolveAnalysisTier(db, {analysisId: id, userEmail: access.row.ownerEmail ?? '', companyInn: access.row.companyInn, privileged: user.isAdmin || access.access === 'agent', readOnly: true}),
   readProfile: async inn => {
    const row = await db.prepare('SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1').bind(inn).first<{payload: string}>();
    return row ? JSON.parse(row.payload) as CompanyProfileData : undefined;
   },
  });
  if (result.status === 'NOT_FOUND') notFound();
  if (result.status === 'LOCKED') return <main className="cr-report cr-state"><h1>Полный отчёт</h1><p>Для этой версии анализа требуется доступ FULL.</p><Link href={'/checkout?analysisId=' + encodeURIComponent(query.analysisId)}>Открыть FULL</Link></main>;
  if (result.status === 'UNAVAILABLE') return <main className="cr-report cr-state"><h1>Канонический отчёт пока недоступен</h1><p>Сохранённых исходных данных недостаточно либо их формат не соответствует контракту расчёта. Значения прежнего анализа не подставлены в новый отчёт.</p><p>Исходный анализ сохранён. Повторно загружать документы до проверки не требуется.</p><Link href={'/dashboard?analysisId=' + encodeURIComponent(query.analysisId)}>Вернуться к сохранённому анализу</Link></main>;
  return query.print === '1' ? <PrintReport model={result.model} realAnalysisId={query.analysisId}/> : <ClientReportShell model={result.model} realAnalysisId={query.analysisId}/>;
 }
 if (query.sample) {
  if (process.env.PRESCORE_INTERNAL_REPORT_PREVIEW !== '1') notFound();
  const fixtures = (await import('../../../tests/fixtures/client-report/preview-models.json')).default as unknown as Record<string, ClientReportModelV1>;
  const model = fixtures[query.sample]; if (!model) notFound();
  return query.print === '1' ? <PrintReport model={model}/> : <ClientReportShell model={model}/>;
 }
 redirect('/dashboard');
}
