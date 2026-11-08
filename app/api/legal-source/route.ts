import {updateActiveAnalysis} from "../../../lib/workspace/analysis-write.ts";
import {getRuntime} from '../../../lib/platform/runtime';
import {analysisForStorage, type AnalysisResult} from '../../../lib/prescore';
import {LEGAL_REGISTRY_VERSION, activeLegalReceipt, legalRegistryView} from '../../../lib/legal-registry';
import {verifyLegalSource, LegalIntakeError, LEGAL_PDF_MAX_BYTES} from '../../../lib/legal-registry-server';
import {requireApiUser, unauthorized} from '../api-auth';

export async function POST(request: Request) {
  const user = await requireApiUser(); if (!user) return unauthorized();
  try {
    const form = await request.formData(), analysisId = String(form.get('analysisId') ?? ''), file = form.get('file');
    const db = getRuntime().DB;
    const row = await db.prepare("SELECT payload, owner_email AS ownerEmail FROM analyses WHERE archive_state = 'ACTIVE' AND id = ? LIMIT 1").bind(analysisId).first<{payload:string;ownerEmail:string}>();
    // Intake is owner-only, including for an assigned broker and an administrator.
    if (!row || row.ownerEmail !== user.email) return Response.json({error:'Анализ не найден в вашем кабинете'}, {status:404});
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf')) throw new LegalIntakeError('LEGAL_PDF_REQUIRED',415);
    if (file.size > LEGAL_PDF_MAX_BYTES) throw new LegalIntakeError('LEGAL_FILE_SIZE_INVALID',413);
    const analysis = JSON.parse(row.payload) as AnalysisResult;
    if (analysis.id !== analysisId || !analysis.sourceManifest) throw new LegalIntakeError('SAVED_ANALYSIS_INVALID',409);
    const history = analysis.legalRegistryV1?.history ?? [];
    if (history.length >= 50) throw new LegalIntakeError('LEGAL_HISTORY_LIMIT_REACHED',409);
    const receipt = await verifyLegalSource(new Uint8Array(await file.arrayBuffer()), analysis.companyInn, String(form.get('officialUrl') ?? '').trim());
    if (history.some(r => r.contentHash === receipt.contentHash && r.origin === receipt.origin && JSON.stringify(r.reasons) === JSON.stringify(receipt.reasons))) throw new LegalIntakeError('LEGAL_SOURCE_ALREADY_SAVED',409);
    const active = activeLegalReceipt(analysis);
    if (receipt.eligible && active && receipt.informationDate! < active.informationDate!) {
      receipt.eligible = false; receipt.reasons.push('OLDER_THAN_ACTIVE_SOURCE');
    }
    if (receipt.eligible && active && receipt.informationDate === active.informationDate && receipt.lifecycle !== active.lifecycle) {
      receipt.eligible = false; receipt.reasons.push('SAME_DATE_LIFECYCLE_CONFLICT');
      // A verified contradiction invalidates the old selection too; neither wins.
    }
    const conflict = receipt.reasons.includes('SAME_DATE_LIFECYCLE_CONFLICT');
    receipt.replacesSourceId = receipt.eligible ? active?.id ?? null : null;
    const activeSourceId = receipt.eligible ? receipt.id : conflict ? null : analysis.legalRegistryV1?.activeSourceId ?? null;
    const external = analysis.sourceManifest.external ?? [];
    const updated: AnalysisResult = {...analysis,
      legalRegistryV1:{version:LEGAL_REGISTRY_VERSION,activeSourceId,history:[...history,receipt]},
      sourceManifest:{...analysis.sourceManifest,external: receipt.eligible || conflict ? [
        ...external.filter(s => !s.sourceId.startsWith('official-registry:')),
        ...(receipt.eligible ? [{sourceId:receipt.id,sourceType:'OTHER' as const,status:'READY' as const,companyInn:analysis.companyInn,
          contentHash:receipt.contentHash,sourceName:'Выписка ЕГРЮЛ: независимое получение ФНС',receivedAt:receipt.receivedAt,
          periodFrom:receipt.informationDate!,periodTo:receipt.informationDate!,confidence:100,parserVersion:LEGAL_REGISTRY_VERSION,
          rawReference:`sha256:${receipt.contentHash}`,warnings:['SIGNATURE_NOT_CRYPTOGRAPHICALLY_VERIFIED','LIFECYCLE_ONLY_NOT_ALL_LEGAL_RISKS']}]:[])
      ]:external}};
    const saved = await updateActiveAnalysis(db, analysisId, row.ownerEmail, row.payload, JSON.stringify(analysisForStorage(updated)));
    if (!saved) throw new LegalIntakeError('ANALYSIS_CHANGED_RETRY',409);
    return Response.json({saved:true,legalRegistry:legalRegistryView(updated),originalFileStored:false});
  } catch (error) {
    return Response.json({error:error instanceof LegalIntakeError ? error.code : 'LEGAL_INTAKE_FAILED'}, {status:error instanceof LegalIntakeError ? error.status : 500});
  }
}
