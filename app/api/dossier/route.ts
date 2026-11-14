import {getRuntime} from '../../../lib/platform/runtime';
import {checkoKey,loadChecko,validInn} from '../../../lib/external/checko-cache';
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
  const saved=rows.find(r=>r.kind==='CHECKO');
  const publicData=saved ? await loadChecko(getRuntime().DB,company.inn,{key:'',cacheOnly:true}) : undefined;
  return reply({company,...result,versions,publicProfile:publicData?.profile?profileView(publicData.profile,entitled?'FULL':'FREE'):null,entitlement:entitled?'FULL':'BASIC'});
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
      return reply({status:result.status,reason:result.reason??null,profile:result.profile?profileView(result.profile,'FREE'):null});
    }
    if(body.action!=='save')return reply({error:'Неизвестное действие.'},400);
    const company=await saveDossier(pool,user.email,inn);
    if(body.attachPublic===true){
      const {profile}=await loadChecko(env.DB,inn,{key:'',cacheOnly:true});
      if(!profile)return reply({error:'Публичные сведения ещё не получены.',company},409);
      const sourceId='checko:'+inn+':'+profile.fetchedAt;
      await pool.query(`INSERT INTO dossier_sources(dossier_id,source_id,source_type,payload) VALUES($1,$2,'CHECKO',$3) ON CONFLICT DO NOTHING`,[company.id,sourceId,JSON.stringify({envelope:{sourceId,sourceType:'CHECKO',companyInn:inn,sourceName:'Checko',status:'READY',receivedAt:profile.fetchedAt,confidence:null,warnings:[]}})]);
    }
    return reply({company});
  }catch(error){return error instanceof InputError?reply({error:error.message},400):reply({error:'Не удалось обработать источник.'},503);}
}
