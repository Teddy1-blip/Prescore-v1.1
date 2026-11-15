import {reviewedFinancial} from '../../../lib/workspace/reviewed-financial';
import {nullableFinancialNumber} from '../../../lib/credit-engine/financial-analysis/normalizer';
import {withDossierSources} from '../../../lib/workspace/dossier-bank';
import type {AnalysisResult} from '../../../lib/prescore';
import {bureauRoles,readBureau,bureauEnvelope} from '../../../lib/workspace/bureau-review';
import type {PrivateSource} from '../../../lib/workspace/dossier-sources';
import {recognizeDossierBatch} from '../../../lib/workspace/dossier-ocr';
import {settlementEvent} from '../../../lib/workspace/settlement-events';
import {sourceProjection} from '../../../lib/workspace/dossier-sources';
import {mapSheetRow} from '../../../lib/workspace/calendar-sheet';
import {manualDebt} from '../../../lib/workspace/manual-debt';
import {createHash} from 'node:crypto';
import {calendarEntry} from '../../../lib/workspace/calendar-entry';
import {getRuntime} from '../../../lib/platform/runtime';
import {checkoKey,loadChecko,validInn,checkoState} from '../../../lib/external/checko-cache';
import {profileView} from '../../../lib/external/checko-profile';
import {rateLimit,logUploadFailure} from '../../../lib/release/security';
import {ownedDossier,saveDossier,dossierVersions} from '../../../lib/workspace/dossier';
import {dossierTier,visibleProjection} from '../../../lib/workspace/dossier-view';
import {dossierSources} from '../../../lib/workspace/dossier-sources';
import {FullRequired,InputError,importSource,uploadKinds} from '../../../lib/workspace/dossier-import';
import {requireApiUser,unauthorized} from '../api-auth';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
  const user=await requireApiUser();if(!user)return unauthorized();
  const pool=getRuntime().DB.pool,id=new URL(request.url).searchParams.get('id');
  if(!id)return reply({companies:(await pool.query('SELECT id,company_inn AS inn FROM company_dossiers WHERE owner_email=$1 ORDER BY created_at DESC,id',[user.email])).rows});
  const company=await ownedDossier(pool,user.email,id);
  if(!company)return reply({error:'Досье недоступно.'},404);
  const snapshotId=new URL(request.url).searchParams.get('snapshotId');
  if(snapshotId){
    if(!/^[0-9a-f]{64}$/.test(snapshotId))return reply({error:'Версия недоступна.'},404);
    const {readDossierReport}=await import('../../../lib/workspace/dossier-report');
    const model=await readDossierReport(pool,user,company,snapshotId);return model?reply({company,model}):reply({error:'Версия недоступна.'},404);
  }
  const result=await visibleProjection(pool,user,company);
  const versions=await dossierVersions(pool,user.email,company.inn);
  return reply({company,...result,versions});
}
export async function POST(request:Request){
  const user=await requireApiUser();if(!user)return unauthorized();
  let stage='DOSSIER_REQUEST';
  try{
    const env=getRuntime(),pool=env.DB.pool;
    if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
      const form=await request.formData(), file=form.get('file');
      const kind=uploadKinds.find(k=>k===form.get('kind'));
      if(!kind||!(file instanceof File))return reply({error:'Выберите источник и файл.'},400);
      const role=bureauRoles.find(r=>r===(form.get('relationship')??'Компания-заёмщик'));
      if(!role)return reply({error:'Проверьте роль субъекта отчёта.'},400);
      stage='IMPORT_'+kind;
      const saved=await importSource(pool,user.email,String(form.get('id')??''),kind,file,String(form.get('inn')??''),role,user.isAdmin,form.get('identityConfirmed')==='yes');
      return saved?reply(saved,saved.duplicate?200:201):reply({error:'Досье недоступно.'},404);
    }
    const body=await request.json(),inn=typeof body.inn==='string'?body.inn.trim():'';
    if(body.action==='issue-report'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      const {issueDossierReport}=await import('../../../lib/workspace/dossier-report');
      return reply({snapshot:await issueDossierReport(pool,user,company)});
    }
    if(body.action==='recognize'){
      if(body.layout!=='SINGLE' && body.layout!=='TWO_UP_ROTATED')return reply({error:'Проверьте раскладку страниц.'},400);
      const result=await recognizeDossierBatch(pool,user.email,String(body.id??''),String(body.sourceId??''),body.layout,request.headers.get('x-request-id'));
      return reply(result,result.status);
    }
    if(body.action==='confirm-bureau'){
      const tx=await pool.connect();
      try{
        await tx.query('BEGIN');
        const row=(await tx.query(`SELECT s.payload,s.document_id,d.company_inn FROM dossier_sources s JOIN company_dossiers d ON d.id=s.dossier_id
          WHERE d.owner_email=$1 AND d.id=$2 AND s.source_id=$3 AND s.source_type='BKI' FOR UPDATE OF d,s`,[user.email,body.id,body.sourceId])).rows[0];
        if(!row){await tx.query('ROLLBACK');return reply({error:'Документ недоступен.'},404);}
        const payload=row.payload as PrivateSource;
        if(payload.bki){await tx.query('COMMIT');return reply({confirmed:true});}
        if(!payload.ocr||payload.ocr.through!==payload.ocr.total||payload.review?.status!=='BUREAU_CONFIRM'){
          await tx.query('ROLLBACK');return reply({error:'Сначала проверьте полный отчёт и его владельца.'},409);
        }
        const bki=readBureau(payload.ocr.pages.map(p=>p.text).join('\n\f\n'),payload.envelope.fileName??'',String(row.company_inn),payload.relationship??'Компания-заёмщик');
        payload.bki=bki;payload.envelope=bureauEnvelope(payload,bki);payload.review!.status='BUREAU_CONFIRMED';
        await tx.query('UPDATE dossier_sources SET payload=$1 WHERE dossier_id=$2 AND source_id=$3',[JSON.stringify(payload),body.id,body.sourceId]);
        const current=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[user.email,row.company_inn])).rows[0];
        if(current){
          const updated=withDossierSources(JSON.parse(String(current.payload)),[{id:body.sourceId,kind:'BKI',documentId:String(row.document_id),payload}]);
          await tx.query('UPDATE analyses SET payload=$1 WHERE id=$2 AND owner_email=$3',[JSON.stringify(updated),current.id,user.email]);
        }
        await tx.query('COMMIT');return reply({confirmed:true});
      }catch(error){await tx.query('ROLLBACK');throw error;}finally{tx.release();}
    }
    if(body.action==='verify-field'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      const source=(await dossierSources(pool,user.email,company.id)).find(r=>r.id===body.sourceId);
      if(source?.payload.ocr&&source.payload.ocr.through!==source.payload.ocr.total)return reply({error:'Дождитесь распознавания всех страниц.'},409);
      const matches=source?.payload.review?.fields.filter(f=>f.key===body.field)??[];
      const field=matches.length===1?matches[0]:null;
      if(!source||!field?.page||!field.fragment||typeof body.value!=='string'||!body.value.trim()||body.value.length>400)return reply({error:'Нужны поле, значение и подтверждённая страница документа.'},400);
      if(['borrower_inn','company_inn'].includes(field.key)&&(body.value.trim()!==company.inn||field.value!==company.inn))return reply({error:'ИНН документа не совпадает с досье.'},400);
      if(source.kind==='BFO_REVIEW'&&/^\d{4}$/.test(field.key)&&nullableFinancialNumber(body.value)===null)return reply({error:'Проверьте числовое значение строки.'},400);
      const patch={value:body.value.trim(),page:field.page,fragment:field.fragment};
      const tx=await pool.connect();
      try{
        await tx.query('BEGIN');
        await tx.query('SELECT id FROM company_dossiers WHERE id=$1 AND owner_email=$2 FOR UPDATE',[company.id,user.email]);
      const saved=await tx.query(`UPDATE dossier_sources SET payload=jsonb_set(payload,'{verified}',coalesce(payload->'verified','{}') || jsonb_build_object($1::text,$2::jsonb)) WHERE dossier_id=$3 AND source_id=$4
       AND (payload->'ocr' IS NULL OR payload->'ocr'->>'through'=payload->'ocr'->>'total')
       AND (payload->'verified'->$1::text IS NOT DISTINCT FROM $5::jsonb OR payload->'verified'->$1::text=$2::jsonb) RETURNING source_id`,[field.key,JSON.stringify(patch),company.id,source.id,body.previous?JSON.stringify(body.previous):null]);
        if(saved.rows.length&&(source.kind==='CREDIT_DOCUMENT'||source.kind==='BFO_REVIEW')){
          const stored=(await tx.query('SELECT payload FROM dossier_sources WHERE dossier_id=$1 AND source_id=$2',[company.id,source.id])).rows[0];
          let payload=stored.payload as typeof source.payload;
          if(source.kind==='BFO_REVIEW'){
            const snapshot=reviewedFinancial(payload,company.inn);
            if(snapshot){
              if(snapshot.period.kind!=='ANNUAL'&&await dossierTier(tx,user,company)!=='FULL'){await tx.query('ROLLBACK');return reply({error:'Для промежуточной отчётности нужен полный доступ.'},403);}
              payload={...payload,snapshot,envelope:snapshot.source};
              await tx.query('UPDATE dossier_sources SET payload=$1 WHERE dossier_id=$2 AND source_id=$3',[JSON.stringify(payload),company.id,source.id]);
            }else if(payload.snapshot){await tx.query('ROLLBACK');return reply({error:'Исправление противоречит периоду или единице уже подтверждённой отчётности.'},409);}
          }
          const current=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[user.email,company.inn])).rows[0];
          if(current){
            const analysis=JSON.parse(String(current.payload)) as AnalysisResult;
            const updated=withDossierSources(analysis,[{...source,payload}]);
            await tx.query('UPDATE analyses SET payload=$1 WHERE owner_email=$2 AND id=$3',[JSON.stringify(updated),user.email,current.id]);
          }
        }
        await tx.query('COMMIT');
      return saved.rows.length?reply({verified:patch}):reply({error:'Поле уже изменилось. Обновите досье.'},409);
      }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
    }
    if(body.action==='manual-debt'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      if(await dossierTier(pool,user,company)!=='FULL')return reply({error:'Для кредитного портфеля нужен полный доступ.'},403);
      const now=new Date().toISOString(),entry=manualDebt(body.entry,now.slice(0,10));
      if(!entry||body.confirmed!==true)return reply({error:'Проверьте договор, дату остатка и основание подтверждения.'},400);
      const sourceId='manual-debt:'+createHash('sha256').update(JSON.stringify(entry)).digest('hex');
      const payload:PrivateSource={manualDebt:entry,envelope:{sourceId,sourceType:'OTHER',sourceName:'Подтверждение клиента · '+entry.contract,receivedAt:now,companyInn:company.inn,status:'READY',warnings:[],confidence:null}};
      const tx=await pool.connect();
      try{await tx.query('BEGIN');await tx.query('SELECT id FROM company_dossiers WHERE owner_email=$1 AND id=$2 FOR UPDATE',[user.email,company.id]);
        const inserted=await tx.query("INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'MANUAL_DEBT',$3) ON CONFLICT DO NOTHING RETURNING source_id",[company.id,sourceId,JSON.stringify(payload)]);
        if(inserted.rows.length){
          const bank=(await tx.query("SELECT id,payload FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[user.email,company.inn])).rows[0];
          if(bank){
            const enriched=withDossierSources(JSON.parse(String(bank.payload)),[{id:sourceId,documentId:null,kind:'MANUAL_DEBT',payload}]);
            await tx.query('UPDATE analyses SET payload=$1 WHERE owner_email=$2 AND id=$3',[JSON.stringify(enriched),user.email,bank.id]);
          }
        }
        await tx.query('COMMIT');return reply({id:sourceId,duplicate:!inserted.rows.length},inserted.rows.length?201:200);
      }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
    }
    if(body.action==='settlement'){
      if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(body.key))||typeof body.id!=='string'||!body.entry||typeof body.revision!=='string')return reply({error:'Проверьте поля изменения.'},400);
      const tx=await pool.connect();
      try{
        await tx.query('BEGIN');
        const company=(await tx.query('SELECT id,company_inn AS inn FROM company_dossiers WHERE owner_email=$1 AND id=$2 FOR UPDATE',[user.email,body.id])).rows[0] as {id:string;inn:string}|undefined;
        if(!company){await tx.query('ROLLBACK');return reply({error:'Досье недоступно.'},404);}
        if(['TASK','PROMISE'].includes(body.entry.kind)&&await dossierTier(tx,user,company)!=='FULL'){await tx.query('ROLLBACK');return reply({error:'Задачи и обещания доступны в полном кабинете.'},403);}
        const sourceId='settlement:'+body.key;
        const sources=await dossierSources(tx,user.email,company.id);
        const prior=sources.find(r=>r.id===sourceId)?.payload.settlementEvent;
        if(prior){
          const repeat=prior.kind===body.entry.kind&&prior.position===body.entry.position&&prior.asOf===body.entry.asOf&&prior.note===String(body.entry.note).trim()&&(prior.kind==='PAYMENT'?prior.bankId===body.entry.bankId:prior.date===body.entry.date);
          await tx.query('ROLLBACK');return repeat?reply({id:sourceId}):reply({error:'Номер операции уже использован.'},409);
        }
        const position=sourceProjection(sources,company.inn,false).settlements.find(p=>p.id===body.entry.position);
        const entry=position&&position.revision===body.revision&&settlementEvent(body.entry,position);
        if(!entry){await tx.query('ROLLBACK');return reply({error:'Проверьте актуальный остаток, срок и основание. Обновите реестр.'},409);}
        const payload={settlementEvent:entry,envelope:{sourceId,sourceType:'OTHER',companyInn:company.inn,receivedAt:new Date().toISOString(),sourceName:'Подтверждение владельца досье',status:'READY',confidence:null,warnings:[]}};
        await tx.query("INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'SETTLEMENT_EVENT',$3)",[company.id,sourceId,JSON.stringify(payload)]);
        await tx.query('COMMIT');return reply({id:sourceId},201);
      }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
    }
    if(body.action==='confirm-sheet'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      if(await dossierTier(pool,user,company)!=='FULL')return reply({error:'Нужен полный доступ.'},403);
      if(!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>250||new Set(body.rows).size!==body.rows.length)return reply({error:'Выберите от 1 до 250 строк.'},400);
      const tx=await pool.connect();
      try{await tx.query('BEGIN');
        const data=(await tx.query("SELECT payload FROM dossier_sources WHERE dossier_id=$1 AND source_id=$2 AND source_type='CALENDAR_SHEET' FOR UPDATE",[company.id,body.sourceId])).rows[0]?.payload as PrivateSource|undefined;
        if(!data?.calendarSheet){await tx.query('ROLLBACK');return reply({error:'График недоступен.'},404);}
        const entries=data.sheetEntries??{};
        for(const index of body.rows){
          const value=mapSheetRow(data.calendarSheet,body.mapping,index,data.envelope.fileName??'График');
          if(!value||entries[index]&&Object.entries(value).some(([k,v])=>entries[index][k as keyof typeof value]!==v)){await tx.query('ROLLBACK');return reply({error:'Проверьте даты, суммы и ранее подтверждённые строки.'},409);}
          entries[index]=value;
        }
        await tx.query('UPDATE dossier_sources SET payload=$1 WHERE dossier_id=$2 AND source_id=$3',[JSON.stringify({...data,sheetEntries:entries}),company.id,body.sourceId]);await tx.query('COMMIT');return reply({confirmed:body.rows.length});
      }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
    }
    if(body.action==='calendar'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      if(await dossierTier(pool,user,company)!=='FULL')return reply({error:'Платёжный календарь доступен в полном режиме.'},403);
      const entry=calendarEntry(body.entry);
      if(!entry||!/^\w{8}-[a-f\d-]{27}$/i.test(String(body.key??'')))return reply({error:'Проверьте поля события.'},400);
      const sourceId='calendar:'+body.key;
      const payload={calendar:entry,envelope:{sourceId,sourceType:'OTHER',companyInn:company.inn,sourceName:entry.purpose,receivedAt:new Date().toISOString(),status:'READY',confidence:null,warnings:[]}};
      const saved=await pool.query(`INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'CALENDAR',$3)
        ON CONFLICT(dossier_id,source_id) DO UPDATE SET source_id=excluded.source_id WHERE dossier_sources.payload->'calendar'=excluded.payload->'calendar' RETURNING source_id`,[company.id,sourceId,JSON.stringify(payload)]);
      return saved.rows.length?reply({id:sourceId}):reply({error:'Запись с этим номером уже существует.'},409);
    }
    if(!validInn(inn))return reply({error:'Проверьте ИНН и его контрольную цифру.'},400);
    const ownerEmail=user.email;
    async function publicLookup(){
      const cached=await loadChecko(env.DB,inn,{key:'',cacheOnly:true});
      let result=cached;
      if(cached.status!=='READY' && checkoKey(env)){
        const limit=await rateLimit(pool,'checko-public-preview',ownerEmail,3,60);
        if(!limit.allowed)return {limited:true as const};
        const global=await rateLimit(pool,'checko-public-preview','all-users',20,3600);
        if(!global.allowed)return {limited:true as const};
        result=await loadChecko(env.DB,inn,{key:checkoKey(env),cacheOnly:false});
      }
      return {limited:false as const,result};
    }
    if(body.action==='counterparty-check'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      if(await dossierTier(pool,user,company)!=='FULL')return reply({error:'Проверка контрагента доступна в полном кабинете.'},403);
      const positions=(await dossierSources(pool,user.email,company.id)).flatMap(s=>s.kind==='COUNTERPARTIES'?s.payload.ledger??[]:[]);
      if(inn.length!==10||!positions.some(p=>p.partyInn===inn))return reply({error:'Укажите ИНН юридического лица из загруженной ОСВ.'},400);
      const found=await publicLookup();if(found.limited)return reply({error:'Лимит публичных проверок исчерпан.'},429);
      const p=found.result.profile;
      if(!p||p.inn!==inn)return reply({error:'Checko пока не вернул сведения об этом контрагенте.'},503);
      const count=(name:string)=>{const r=p.externalFacts?.receipts.find(r=>r.method===name);return r?.status==='EMPTY'?0:r&&r.visible>0?r.total??r.visible:null;};
      const counterpartyCheck={inn,fetchedAt:p.fetchedAt,cases:count('legal-cases'),enforcements:count('enforcements')};
      const sourceId='checko-party:'+inn+':'+p.fetchedAt;
      const payload={counterpartyCheck,envelope:{sourceId,companyInn:company.inn,sourceType:'OTHER',sourceName:'Checko · контрагент '+inn,receivedAt:p.fetchedAt,status:'READY',confidence:null,warnings:[]}};
      await pool.query("INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'COUNTERPARTY_CHECK',$3) ON CONFLICT DO NOTHING",[company.id,sourceId,JSON.stringify(payload)]);return reply({saved:true});
    }
    if(body.action==='preview'){
      const found=await publicLookup();if(found.limited)return reply({error:'Лимит публичных проверок исчерпан. Повторите позже.'},429);
      const result=found.result;
      return reply({status:checkoState(result).status,reason:result.reason??null,profile:result.profile?profileView(result.profile,'FREE'):null});
    }
    if(body.action!=='save')return reply({error:'Неизвестное действие.'},400);
    const company=await saveDossier(pool,user.email,inn);
    if(body.attachPublic===true||body.refreshPublic===true){
      const found=body.refreshPublic===true?await publicLookup().catch(()=>null):null;
      const profile=found&&!found.limited?found.result.profile:(await loadChecko(env.DB,inn,{key:'',cacheOnly:true}).catch(()=>null))?.profile;
      if(!profile)return reply({company,publicStatus:'PENDING'});
      const sourceId='checko:'+inn+':'+profile.fetchedAt;
      await pool.query(`INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'CHECKO',$3) ON CONFLICT DO NOTHING`,[company.id,sourceId,JSON.stringify({publicProfile:profile,envelope:{sourceId,sourceType:'CHECKO',companyInn:inn,sourceName:'Checko',status:'READY',receivedAt:profile.fetchedAt,confidence:null,warnings:[]}})]);
    }
    return reply({company});
  }catch(error){
    const diagnosticId=logUploadFailure(stage,error,request.headers.get('x-request-id'),error instanceof FullRequired?'FULL_REQUIRED':error instanceof InputError?'DOCUMENT_REJECTED':'UNEXPECTED_ERROR');
    if(error instanceof FullRequired||error instanceof InputError)return reply({error:error.message,diagnosticId},error instanceof FullRequired?403:400);
    return reply({error:'Не удалось обработать источник.',diagnosticId},503);
  }
}
