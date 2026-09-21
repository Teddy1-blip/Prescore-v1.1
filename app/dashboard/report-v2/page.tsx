import {diagnosticMessage} from '../../../lib/credit-engine/production/diagnostics.ts';
import {notFound, redirect} from 'next/navigation';
import Link from 'next/link';
import {AnalysisV3} from './analysis-v3.tsx';
import {PrintReport} from './print-report.tsx';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import type {CompanyProfileData} from '../../../lib/company-profile';
import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser, readableAnalysis} from '../../api/api-auth';
import {resolveAnalysisTier, type EntitlementDatabase} from '../../../lib/entitlements';
import {loadCanonicalReport} from '../../../lib/credit-engine/production/report-service.ts';
import './report-v2.css';
import './analysis-v3.css';
export const dynamic = 'force-dynamic';
export default async function ReportPage({searchParams}: {searchParams: Promise<{analysisId?: string; sample?: string; print?: string; lab?: string}>}) {
 const query = await searchParams;
 // A supplied real analysis ID can never fall through into fixture loading.
 if (query.analysisId) {
  const user = await requireApiUser();
  if (!user) redirect('/login?returnTo=' + encodeURIComponent('/dashboard/report-v2?analysisId=' + encodeURIComponent(query.analysisId)));
  const db = getRuntime().DB as unknown as EntitlementDatabase;
  const result = await loadCanonicalReport(query.analysisId, {
   includeInputDiagnostics: process.env.PRESCORE_BASE_URL?.replace(/\/$/, '') === 'https://prescore-staging-dorogovab.amvera.io',
   readAccess: id => readableAnalysis(db, id, user),
   readTier: (id, access) => resolveAnalysisTier(db, {analysisId: id, userEmail: access.row.ownerEmail ?? '', companyInn: access.row.companyInn, privileged: user.isAdmin || access.access === 'agent', readOnly: true}),
   readSourceAvailability: async access => {
    const row = await db.prepare(`SELECT COUNT(*) AS documents,
      COALESCE(SUM(CASE WHEN LENGTH(d.content_base64) > 0 THEN 1 ELSE 0 END), 0) AS "inlineDocuments",
      COALESCE(SUM(CASE WHEN LENGTH(d.storage_key) > 0 THEN 1 ELSE 0 END), 0) AS "storedDocuments",
      COALESCE(SUM(CASE WHEN d.analysis_id = ? THEN 1 ELSE 0 END), 0) AS "analysisDocuments"
      FROM client_documents d WHERE d.company_inn = ? AND (? = 1 OR d.owner_email = ? OR EXISTS
      (SELECT 1 FROM agent_leads l JOIN agent_accounts u ON u.agent_code = l.agent_code WHERE l.company_inn = d.company_inn AND u.user_email = ?))`)
      .bind(query.analysisId, access.row.companyInn, user.isAdmin ? 1 : 0, user.email, user.email)
      .first<{documents: number|string; inlineDocuments: number|string; storedDocuments: number|string; analysisDocuments: number|string}>();
    return row ? {documents:Number(row.documents),inlineDocuments:Number(row.inlineDocuments),storedDocuments:Number(row.storedDocuments),analysisDocuments:Number(row.analysisDocuments)} : null;
   },
   readProfile: async inn => {
    const row = await db.prepare('SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1').bind(inn).first<{payload: string}>();
    return row ? JSON.parse(row.payload) as CompanyProfileData : undefined;
   },
  });
  if (result.status === 'NOT_FOUND') notFound();
  if (result.status === 'LOCKED') return <main className="cr-report cr-state"><h1>Полный отчёт</h1><p>Для этой версии анализа требуется доступ FULL.</p><Link href={'/checkout?analysisId=' + encodeURIComponent(query.analysisId)}>Открыть FULL</Link></main>;
  if (result.status === 'UNAVAILABLE') return <main className="cr-report cr-state"><h1>Канонический отчёт пока недоступен</h1><p>{result.diagnostic.category === 'MISSING_REQUIRED_INPUT' ? 'Для расчёта отсутствует обязательный сохранённый источник.' : result.diagnostic.category === 'INCOMPATIBLE_INPUT' ? 'Сохранённые входы не согласованы с контрактом расчёта. Требуется проверка данных.' : 'На этапе расчёта произошла внутренняя ошибка. Требуется проверка интеграции.'}</p>{diagnosticMessage(result.diagnostic.reason) && <p>{diagnosticMessage(result.diagnostic.reason)}</p>}<p>Номер диагностики: {result.diagnostic.id}</p><p>Этап: {result.diagnostic.stage}. Код: {result.diagnostic.reason}. Версия: {result.diagnostic.version}.</p>{result.inputSummary && <details><summary>Диагностика сохранённых входов staging</summary><pre>{JSON.stringify(result.inputSummary, null, 2)}</pre></details>}<p>Исходный анализ сохранён без изменений. Автоматическое исправление сохранённых данных не выполнялось.</p><Link href={'/dashboard?analysisId=' + encodeURIComponent(query.analysisId)}>Вернуться к сохранённому анализу</Link></main>;
  return query.print === '1' ? <PrintReport model={result.model} realAnalysisId={query.analysisId}/> : <AnalysisV3 model={result.model} realAnalysisId={query.analysisId}/>;
 }
 // Separate synthetic branch: real analysisId always takes the protected path above.
 if (query.lab) {
  if (process.env.PRESCORE_BASE_URL?.replace(/\/$/, '') !== 'https://prescore-staging-dorogovab.amvera.io') notFound();
  const user = await requireApiUser();
  if (!user) redirect('/login?returnTo=' + encodeURIComponent('/dashboard/report-v2?lab=' + encodeURIComponent(query.lab)));
  const {businessCatalog, loadBusiness} = await import('../../../lib/credit-engine/credit-lab/business-corpus.mjs');
  const catalog = businessCatalog() as Array<{caseId:string;title:string;description:string}>;
  const reviewNotes: Record<string,string> = {'CL-RU-BUS-022':'Конфликт исходных операций изолирован. Полный итог и зависимая ёмкость не определены; бесспорная часть показана отдельно.'};
  const banner = <section className="cr-report cr-state" style={{minHeight: 0}}><p>Демонстрация Credit Lab — синтетические данные</p><p>Development V1 · DRAFT · исходники → canonical pipeline · не банковская валидация</p>{reviewNotes[query.lab] && <p>{reviewNotes[query.lab]}</p>}<Link href="/dashboard/report-v2?lab=1">Выбрать синтетическую компанию</Link></section>;
  if (query.lab === '1') return <main className="cr-report cr-state"><h1>Credit Lab — синтетические компании</h1><p>24 DRAFT-комплекта. Отчёты вычисляются из тестовых источников; отсутствие данных сохраняется как UNKNOWN.</p><ul>{catalog.map(c=><li key={c.caseId}><Link href={'/dashboard/report-v2?lab='+c.caseId}>{c.title}</Link><p>{c.description}</p></li>)}</ul></main>;
  if (!catalog.some(c=>c.caseId === query.lab)) notFound();
  const {buildCanonicalCreditAnalysis} = await import('../../../lib/credit-engine/production/orchestrator.ts');
  const {publicCanonicalModel} = await import('../../../lib/credit-engine/production/public-model.ts');
  const result = buildCanonicalCreditAnalysis(loadBusiness(query.lab).input);
  const model = publicCanonicalModel(result.model, result);
  return query.print === '1' ? <>{banner}<PrintReport model={model}/></> : <AnalysisV3 model={model} labId={query.lab}/>;
 }
 if (query.sample) {
  if (process.env.PRESCORE_INTERNAL_REPORT_PREVIEW !== '1') notFound();
  const fixtures = (await import('../../../tests/fixtures/client-report/preview-models.json')).default as unknown as Record<string, ClientReportModelV1>;
  const model = fixtures[query.sample]; if (!model) notFound();
  return query.print === '1' ? <PrintReport model={model}/> : <AnalysisV3 model={model} labId={query.lab}/>;
 }
 redirect('/dashboard');
}
