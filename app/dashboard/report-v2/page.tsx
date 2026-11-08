import {cachedProfile} from "../../../lib/external/checko-profile";
import {projectPrintBanking} from '../../../lib/workspace/print-banking.ts';
import {notFound, redirect} from 'next/navigation';
import Link from 'next/link';
import {AnalysisV3} from './analysis-v3.tsx';
import {PrintReport} from './print-report.tsx';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report.ts';
import {getRuntime} from '../../../lib/platform/runtime';
import {requireApiUser, readableAnalysis} from '../../api/api-auth';
import {resolveAnalysisTier, type EntitlementDatabase} from '../../../lib/entitlements';
import {loadWorkspaceModelV1,readWorkspaceOperations} from '../../../lib/workspace/service.ts';
import {persistDecisionRevision,readDecisionRevision,type DecisionRevisionDatabase} from '../../../lib/credit-engine/production/decision-history.ts';
import './report-v2.css';
import './analysis-v3.css';
export const dynamic = 'force-dynamic';
export default async function ReportPage({searchParams}: {searchParams: Promise<{analysisId?: string; snapshotId?: string; sample?: string; print?: string; lab?: string}>}) {
 const query = await searchParams;
 // A supplied real analysis ID can never fall through into fixture loading.
 if (query.analysisId) {
  const user = await requireApiUser();
  if (!user) redirect('/login?returnTo=' + encodeURIComponent('/dashboard/report-v2?analysisId=' + encodeURIComponent(query.analysisId)));
  const db = getRuntime().DB as unknown as EntitlementDatabase & Parameters<typeof readWorkspaceOperations>[0];
  if(query.snapshotId){
   if(!/^sha256:[0-9a-f]{64}$/.test(query.snapshotId))notFound();
   const access=await readableAnalysis(db,query.analysisId,user);
   if(!access)notFound();
   const tier=await resolveAnalysisTier(db,{analysisId:query.analysisId,userEmail:access.row.ownerEmail??'',companyInn:access.row.companyInn,privileged:user.isAdmin||access.access==='agent',readOnly:true});
   if(tier!=='FULL')return <main className="cr-report cr-state"><h1>Исторический выпуск</h1><p>История решений доступна в полном анализе.</p><Link href={'/checkout?analysisId='+encodeURIComponent(query.analysisId)}>Открыть FULL</Link></main>;
   const revision=await readDecisionRevision(db as unknown as DecisionRevisionDatabase,query.analysisId,query.snapshotId);
   if(!revision)notFound();
   return query.print==='1'
    ? <PrintReport model={revision.model} realAnalysisId={query.analysisId}/>
    : <AnalysisV3 model={revision.model} realAnalysisId={query.analysisId} historicalSnapshotId={query.snapshotId}/>;
  }
  if (query.print !== '1') redirect('/dashboard?analysisId=' + encodeURIComponent(query.analysisId) + '&view=analysis');
  const result = await loadWorkspaceModelV1(query.analysisId, {
   readAccess: id => readableAnalysis(db, id, user),
   readTier: (id, access) => resolveAnalysisTier(db, {analysisId:id,userEmail:access.row.ownerEmail ?? '',companyInn:access.row.companyInn,privileged:user.isAdmin || access.access === 'agent',readOnly: true}),
   readOperations: (id, access) => readWorkspaceOperations(db,id,access.row.companyInn,user),
   recordDecision: ({canonical,report,access}) => persistDecisionRevision(db as unknown as DecisionRevisionDatabase,{canonical,report,access}).then(()=>undefined),
   readProfile: async inn => {
    const row = await db.prepare('SELECT payload FROM checko_profiles WHERE inn = ? LIMIT 1').bind(inn).first<{payload:string}>();
    return row ? cachedProfile(row.payload,inn) : undefined;
   },
  });
  if(result.state === 'NOT_FOUND') notFound();
  if('entitlement' in result && result.fullAvailability === 'LOCKED') return <main className="cr-report cr-state"><h1>Полный отчёт</h1><p>Для этой версии анализа требуется доступ FULL.</p><Link href={'/checkout?analysisId='+encodeURIComponent(query.analysisId)}>Открыть FULL</Link></main>;
  if(!('full' in result) || !result.full) return <main className="cr-report cr-state"><h1>Отчёт временно недоступен</h1><p>Сохранённые источники доступны в кабинете. Повторите открытие отчёта или проверьте состояние документов.</p><Link href={'/dashboard?analysisId='+encodeURIComponent(query.analysisId)}>Вернуться к анализу</Link></main>;
  return <PrintReport model={result.full.report} banking={projectPrintBanking(result)} realAnalysisId={query.analysisId}/>;
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
