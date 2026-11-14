import {calendarEntry} from '../../../lib/workspace/calendar-entry';
import {getRuntime} from '../../../lib/platform/runtime';
import {checkoKey,loadChecko,validInn,checkoState} from '../../../lib/external/checko-cache';
import {profileView} from '../../../lib/external/checko-profile';
import {rateLimit} from '../../../lib/release/security';
import {ownedDossier,saveDossier,dossierVersions} from '../../../lib/workspace/dossier';
import {dossierSources,sourceProjection} from '../../../lib/workspace/dossier-sources';
import {InputError,importSource,uploadKinds} from '../../../lib/workspace/dossier-import';
import {requireApiUser,unauthorized} from '../api-auth';
import {stagingFullAccessEnabled} from '../../../lib/platform/staging-access';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
  const user=await requireApiUser();if(!user)return unauthorized();
  const pool=getRuntime().DB.pool,id=new URL(request.url).searchParams.get('id');
  if(!id)return reply({companies:(await pool.query('SELECT id,company_inn AS inn FROM company_dossiers WHERE owner_email=$1 ORDER BY created_at DESC,id',[user.email])).rows});
  const company=await ownedDossier(pool,user.email,id);
  if(!company)return reply({error:'Досье недоступно.'},404);
  const rows=await dossierSources(pool,user.email,id);
  const result=sourceProjection(rows,company.inn);
  const entitled=user.isAdmin||stagingFullAccessEnabled()||(await pool.query(`SELECT 1 FROM billing_subscriptions s JOIN billing_periods p ON p.subscription_id=s.id
    WHERE s.owner_email=$1 AND s.company_inn=$2 AND s.status='ACTIVE' AND p.status='ACTIVE' AND now()>=s.access_from AND now()<s.access_until AND now()>=p.starts_at AND now()<p.ends_at LIMIT 1`,[user.email,company.inn])).rows.length>0;
  if(!entitled && result.financial){
    result.findings=[];result.financial.trends=[];
    for(const period of result.financial.history)period.groups=period.groups.filter(g=>g.key==='amounts');
  }
  const versions=await dossierVersions(pool,user.email,company.inn);
  const saved=rows.filter(r=>r.kind==='CHECKO').at(-1);
  const publicProfile=saved?.payload.publicProfile;
  return reply({company,...result,versions,publicProfile:publicProfile?profileView(publicProfile,entitled?'FULL':'FREE'):null,entitlement:entitled?'FULL':'BASIC'});
}
export async function POST(request:Request){
  const user=await requireApiUser();if(!user)return unauthorized();
  const env=getRuntime(),pool=env.DB.pool;
  try{
    if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
      const form=await request.formData(), file=form.get('file');
      const kind=uploadKinds.find(k=>k===form.get('kind'));
      if(!kind||!(file instanceof File))return reply({error:'Выберите источник и файл.'},400);
      const saved=await importSource(pool,user.email,String(form.get('id')??''),kind,file);
      return saved?reply(saved,saved.duplicate?200:201):reply({error:'Досье недоступно.'},404);
    }
    const body=await request.json(),inn=typeof body.inn==='string'?body.inn.trim():'';
    if(body.action==='verify-field'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      const source=(await dossierSources(pool,user.email,company.id)).find(r=>r.id===body.sourceId);
      const matches=source?.payload.review?.fields.filter(f=>f.key===body.field)??[];
      const field=matches.length===1?matches[0]:null;
      if(!source||!field?.page||!field.fragment||typeof body.value!=='string'||!body.value.trim()||body.value.length>400)return reply({error:'Нужны поле, значение и подтверждённая страница документа.'},400);
      const patch={value:body.value.trim(),page:field.page,fragment:field.fragment};
      const saved=await pool.query(`UPDATE dossier_sources SET payload=jsonb_set(payload,'{verified}',coalesce(payload->'verified','{}') || jsonb_build_object($1::text,$2::jsonb)) WHERE dossier_id=$3 AND source_id=$4
       AND (payload->'verified'->$1::text IS NOT DISTINCT FROM $5::jsonb OR payload->'verified'->$1::text=$2::jsonb) RETURNING source_id`,[field.key,JSON.stringify(patch),company.id,source.id,body.previous?JSON.stringify(body.previous):null]);
      return saved.rows.length?reply({verified:patch}):reply({error:'Поле уже изменилось. Обновите досье.'},409);
    }
    if(body.action==='calendar'){
      const company=await ownedDossier(pool,user.email,String(body.id??''));
      if(!company)return reply({error:'Досье недоступно.'},404);
      const entry=calendarEntry(body.entry);
      if(!entry||!/^\w{8}-[a-f\d-]{27}$/i.test(String(body.key??'')))return reply({error:'Проверьте поля события.'},400);
      const sourceId='calendar:'+body.key;
      const payload={calendar:entry,envelope:{sourceId,sourceType:'OTHER',companyInn:company.inn,sourceName:entry.purpose,receivedAt:new Date().toISOString(),status:'READY',confidence:null,warnings:[]}};
      const saved=await pool.query(`INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'CALENDAR',$3)
        ON CONFLICT(dossier_id,source_id) DO UPDATE SET source_id=excluded.source_id WHERE dossier_sources.payload->'calendar'=excluded.payload->'calendar' RETURNING source_id`,[company.id,sourceId,JSON.stringify(payload)]);
      return saved.rows.length?reply({id:sourceId}):reply({error:'Запись с этим номером уже существует.'},409);
    }
    if(!validInn(inn))return reply({error:'Проверьте ИНН и его контрольную цифру.'},400);
    if(body.action==='preview'){
      const cached=await loadChecko(env.DB,inn,{key:'',cacheOnly:true});
      let result=cached;
      if(cached.status!=='READY' && checkoKey(env)){
        const limit=await rateLimit(pool,'checko-public-preview',user.email,3,60);
        if(!limit.allowed)return reply({error:'Повторите запрос через минуту.'},429);
        const global=await rateLimit(pool,'checko-public-preview','all-users',20,3600);
        if(!global.allowed)return reply({error:'Лимит новых запросов Checko на этот час исчерпан.'},429);
        result=await loadChecko(env.DB,inn,{key:checkoKey(env),cacheOnly:false});
      }
      return reply({status:checkoState(result).status,reason:result.reason??null,profile:result.profile?profileView(result.profile,'FREE'):null});
    }
    if(body.action!=='save')return reply({error:'Неизвестное действие.'},400);
    const company=await saveDossier(pool,user.email,inn);
    if(body.attachPublic===true){
      const {profile}=await loadChecko(env.DB,inn,{key:'',cacheOnly:true});
      if(!profile)return reply({error:'Публичные сведения ещё не получены.',company},409);
      const sourceId='checko:'+inn+':'+profile.fetchedAt;
      await pool.query(`INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'CHECKO',$3) ON CONFLICT DO NOTHING`,[company.id,sourceId,JSON.stringify({publicProfile:profile,envelope:{sourceId,sourceType:'CHECKO',companyInn:inn,sourceName:'Checko',status:'READY',receivedAt:profile.fetchedAt,confidence:null,warnings:[]}})]);
    }
    return reply({company});
  }catch(error){return error instanceof InputError?reply({error:error.message},400):reply({error:'Не удалось обработать источник.'},503);}
}
