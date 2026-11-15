import {createHash,timingSafeEqual} from 'node:crypto';

/**
 * Explicit non-billing access for one authenticated owner in an isolated RC.
 * Off by default. No global FULL grant or role elevation. Never persisted.
 */
const rcOrigins=new Set([
 'https://prescore-staging-dorogovab.amvera.io',
 'https://prescore-staging-dorogovab.msk1.amvera.tech',
 'https://prescore.ru',
]);
export function ownerPreviewFullAccess(email:string,env:Record<string,string|undefined>=process.env):boolean{
 if(env.PRESCORE_RUNTIME_MODE!=='release-candidate'||env.PRESCORE_OWNER_FULL_PREVIEW!=='1')return false;
 const digest=env.PRESCORE_OWNER_PREVIEW_EMAIL_SHA256??'';
 if(!/^[0-9a-f]{64}$/.test(digest)||!email||email.length>320)return false;
 try{
  const origin=new URL(env.PRESCORE_BASE_URL??'');
  const space=env.CODESPACE_NAME;
  const ownCodespace=env.CODESPACES==='true'&&space&&/^[a-z0-9-]+$/.test(space)&&
    origin.protocol==='https:'&&!origin.port&&/^\d{1,5}$/.test(origin.hostname.slice(space.length+1).split('.')[0])&&
    origin.hostname.startsWith(space+'-')&&origin.hostname.endsWith('.app.github.dev')&&origin.hostname.split('.').length===4;
  if(!(rcOrigins.has(origin.origin)||ownCodespace)||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)return false;
  const actual=createHash('sha256').update(email.trim().toLowerCase()).digest();
  return timingSafeEqual(actual,Buffer.from(digest,'hex'));
 }catch{return false;}
}
