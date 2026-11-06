import {getRuntime} from "../../../lib/platform/runtime";
import {readableAnalysis,requireApiUser,unauthorized} from "../api-auth";
import {resolveAnalysisTier} from "../../../lib/entitlements";
import {DIRECT_EIS} from "../../../lib/external/records";
import {loadChecko} from "../../../lib/external/checko-cache";
import {profileView} from "../../../lib/external/checko-profile";
import type {AnalysisResult} from "../../../lib/prescore";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});

function validInn(value: string) {
  if (!/^\d{10}$|^\d{12}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const checksum = (weights: number[]) => weights.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11 % 10;
  if (digits.length === 10) return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10]
    && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11];
}

export async function GET(request:Request){
  const user=await requireApiUser();if(!user)return unauthorized();
  const params=new URL(request.url).searchParams,inn=(params.get("inn")??"").trim(),id=params.get("analysisId")??"";
  if(!id||!validInn(inn))return json({error:"Укажите корректный анализ и ИНН"},400);
  try{
    const env=getRuntime(),db=env.DB;
    const access=await readableAnalysis(db,id,user);
    if(!access||access.row.companyInn!==inn)return json({error:"Профиль недоступен"},403);
    const readOnly=access.access==="agent";
    if(readOnly&&params.get("refresh")==="1")return json({error:"Обновление доступно владельцу"},403);
    const tier=await resolveAnalysisTier(db,{analysisId:id,userEmail:access.row.ownerEmail??user.email,companyInn:inn,privileged:user.isAdmin,readOnly:true});
    const key=process.env.PRESCORE_RUNTIME_MODE==="release-candidate"?"":String((env as Record<string,unknown>).CHECKO_API_KEY??"");
    const result=await loadChecko(db,inn,{key,cacheOnly:readOnly||params.get("cacheOnly")==="1"});
    const meta={provider:"CHECKO",providerConfigured:!!key,providerStatus:result.status,directEis:DIRECT_EIS,reason:result.reason,tier};
    if(!result.profile)return json({...meta,error:"Сведения Checko пока недоступны"},params.get("cacheOnly")==="1"?200:503);
    const analysis=JSON.parse(access.row.payload) as AnalysisResult;
    return json({...profileView(result.profile,tier,analysis),...meta});
  }catch{return json({error:"Сервис внешних сведений временно недоступен",code:"PROFILE_UNAVAILABLE"},503);}
}
