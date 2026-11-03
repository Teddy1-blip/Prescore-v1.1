import {APIError,createAuthMiddleware,getSessionFromCtx,isAPIError} from 'better-auth/api';
import type {QueryExecutor} from '../db/compatibility.ts';
import type {AdminMfaState} from './contracts.ts';

export type AdminMfaMode='disabled'|'enrollment'|'required';
export function adminMfaMode(env:NodeJS.ProcessEnv=process.env):AdminMfaMode {
 const mode=env.PRESCORE_ADMIN_2FA_MODE??'disabled';
 if(!['disabled','enrollment','required'].includes(mode))throw Error('AUTH_MFA_CONFIGURATION_INVALID');
 return mode as AdminMfaMode;
}
// A DB-backed proof belongs to one actual session, never to a browser header or role flag.
export async function adminMfaState(db:QueryExecutor,userId:string,sessionId:string,mode:AdminMfaMode):Promise<{state:AdminMfaState;allow:boolean}> {
 if(mode==='disabled')return {state:'DISABLED',allow:true};
 const r=await db.query(`SELECT u."twoFactorEnabled" AS enabled, t.verified,
  EXISTS(SELECT 1 FROM platform_admin_mfa_sessions m JOIN "session" s ON s.id=m.session_id
   WHERE m.session_id=$2 AND m.user_id=u.id AND s."userId"=u.id AND s."expiresAt">now()
   AND m.verified_at>now()-interval '12 hours') AS proof
  FROM "user" u LEFT JOIN "twoFactor" t ON t."userId"=u.id WHERE u.id=$1`,[userId,sessionId]);
 const row=r.rows[0];
 if(!row) return {state:'VERIFICATION_REQUIRED',allow:false};
 if(row.enabled!==true||row.verified!==true)return {state:'ENROLLMENT_REQUIRED',allow:mode==='enrollment'&&row.enabled!==true};
 return {state:row.proof===true?'VERIFIED':'VERIFICATION_REQUIRED',allow:row.proof===true};
}

const verificationPaths=new Set(['/two-factor/verify-totp','/two-factor/verify-backup-code']);
const managementPaths=new Set(['/two-factor/enable','/two-factor/disable','/two-factor/generate-backup-codes','/two-factor/get-totp-uri','/two-factor/view-backup-codes']);
export function adminMfaHooks(db:QueryExecutor) {
 return {
  before:createAuthMiddleware(async ctx=>{
   if(!ctx.path?.startsWith('/two-factor/'))return;
   // Password-only disabling and trusted-device bypasses cannot confer ADMIN authority.
   if(ctx.body?.trustDevice===true||ctx.body?.disableSession===true)throw new APIError('BAD_REQUEST',{code:'MFA_SESSION_REQUIRED',message:'Подтвердите второй фактор для текущего входа.'});
   if(!verificationPaths.has(ctx.path)&&!managementPaths.has(ctx.path))throw new APIError('FORBIDDEN',{code:'MFA_METHOD_UNAVAILABLE',message:'Используйте приложение-аутентификатор или резервный код.'});
   if(!managementPaths.has(ctx.path)){
    if(ctx.path==='/two-factor/verify-backup-code'){
     const current=await getSessionFromCtx(ctx);
     if(current&&(await adminMfaState(db,current.user.id,current.session.id,'required')).state==='ENROLLMENT_REQUIRED')throw new APIError('BAD_REQUEST',{code:'MFA_ENROLLMENT_TOTP_REQUIRED',message:'Завершите настройку кодом из приложения.'});
    }
    return;
   }
   const current=await getSessionFromCtx(ctx);
   if(!current?.user.emailVerified)throw new APIError('UNAUTHORIZED',{code:'UNAUTHORIZED',message:'Войдите в аккаунт.'});
   const admin=await db.query("SELECT 1 FROM platform_roles WHERE user_id=$1 AND role='ADMIN'",[current.user.id]);
   if(!admin.rows.length)throw new APIError('FORBIDDEN',{code:'ADMIN_REQUIRED',message:'Настройка доступна администратору.'});
   if(ctx.path==='/two-factor/disable'||ctx.path==='/two-factor/view-backup-codes')throw new APIError('FORBIDDEN',{code:'MFA_PROTECTED',message:'Используйте резервный код для восстановления. Отключение требует отдельного плана восстановления.'});
   const state=await adminMfaState(db,current.user.id,current.session.id,'required');
   if(ctx.path==='/two-factor/enable'&&state.state==='ENROLLMENT_REQUIRED')return;
   const recent=await db.query("SELECT 1 FROM platform_admin_mfa_sessions WHERE session_id=$1 AND user_id=$2 AND verified_at>now()-interval '5 minutes'",[current.session.id,current.user.id]);
   if(!state.allow||!recent.rows.length)throw new APIError('FORBIDDEN',{code:'MFA_RECHECK_REQUIRED',message:'Сначала подтвердите второй фактор ещё раз.'});
  }),
  after:createAuthMiddleware(async ctx=>{
   if(!ctx.path||!verificationPaths.has(ctx.path)||isAPIError(ctx.context.returned))return;
   const result=ctx.context.returned as {token?:unknown;user?:{id?:unknown}}|null;
   if(!result||typeof result.token!=='string'||typeof result.user?.id!=='string')return;
   const current=ctx.context.newSession??ctx.context.session;
   if(!current?.session||current.user.id!==result.user.id)return;
   // INSERT SELECT also checks the post-enrollment state and rotated session in the database.
   const saved=await db.query(`INSERT INTO platform_admin_mfa_sessions(session_id,user_id,verified_at,method)
    SELECT s.id,u.id,now(),$3 FROM "session" s JOIN "user" u ON u.id=s."userId"
    JOIN "twoFactor" t ON t."userId"=u.id
    WHERE s.id=$1 AND u.id=$2 AND s."expiresAt">now() AND u."twoFactorEnabled"=true AND t.verified=true
    ON CONFLICT(session_id) DO UPDATE SET verified_at=excluded.verified_at,method=excluded.method RETURNING session_id`,
    [current.session.id,current.user.id,ctx.path==='/two-factor/verify-totp'?'TOTP':'BACKUP']);
   if(saved.rows.length!==1)throw new APIError('INTERNAL_SERVER_ERROR',{code:'MFA_PROOF_UNAVAILABLE',message:'Не удалось подтвердить защищённый вход. Войдите заново.'});
  }),
 };
}
