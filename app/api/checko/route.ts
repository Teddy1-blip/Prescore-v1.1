import {getRuntime} from "../../../lib/platform/runtime";
import {readableAnalysis,requireApiUser,unauthorized} from "../api-auth";
import {resolveAnalysisTier} from "../../../lib/entitlements";
import {DIRECT_EIS} from "../../../lib/external/records";
import {validInn, checkoKey, loadChecko} from "../../../lib/external/checko-cache";
import {invalidInnMessage} from "../../../lib/external/checko-inn";
import {profileView} from "../../../lib/external/checko-profile";
import type {AnalysisResult} from "../../../lib/prescore";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});

export async function GET(request:Request){
  const user=await requireApiUser();if(!user)return unauthorized();
  const params=new URL(request.url).searchParams,inn=(params.get("inn")??"").trim(),id=params.get("analysisId")??"";
  if(!id)return json({error:"Выберите анализ компании."},400);
  if(!validInn(inn))return json({providerStatus:"FAILED",error:invalidInnMessage(inn)},400);
  try{
    const env=getRuntime(),db=env.DB;
    const access=await readableAnalysis(db,id,user);
    if(!access||access.row.companyInn!==inn)return json({error:"Профиль недоступен"},403);
    const readOnly=access.access==="agent";
    if(readOnly&&params.get("refresh")==="1")return json({error:"Обновление доступно владельцу"},403);
    const tier=await resolveAnalysisTier(db,{analysisId:id,userEmail:access.row.ownerEmail??user.email,companyInn:inn,privileged:user.isAdmin,readOnly:true});
    const key=checkoKey(env);
    const result=await loadChecko(db,inn,{key,cacheOnly:readOnly||params.get("cacheOnly")==="1"});
    const meta={provider:"CHECKO",providerConfigured:!!key,providerStatus:result.status,directEis:DIRECT_EIS,reason:result.reason,tier};
    if(!result.profile)return json({...meta,error:"Сведения Checko пока недоступны"},params.get("cacheOnly")==="1"?200:503);
    const analysis=JSON.parse(access.row.payload) as AnalysisResult;
    return json({...profileView(result.profile,tier,analysis),...meta});
  }catch{return json({error:"Сервис внешних сведений временно недоступен",code:"PROFILE_UNAVAILABLE"},503);}
}
