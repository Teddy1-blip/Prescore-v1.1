import { betterAuth } from 'better-auth';
import { getPool } from '../db/client.ts';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import {smtpConfiguration} from '../platform/environment.ts';
import type {AuthRole,AuthSession} from './contracts.ts';

async function sendAccountEmail(email:string,url:string,subject:string) {
 if(process.env.PRESCORE_RUNTIME_MODE==='release-candidate'&&process.env.PRESCORE_ALLOW_RC_FAKE==='true'&&process.env.MAIL_PROVIDER==='POSTGRES_FAKE'){await getPool().query('INSERT INTO rc_mailbox(id,recipient,subject,body) VALUES($1,$2,$3,$4)',[randomUUID(),email,subject,url]);return;}
 const config=smtpConfiguration(process.env);
 const transport=nodemailer.createTransport(config.transport);
 const verification=subject==='Подтверждение почты Prescore';
 const intro=verification?'Подтвердите электронную почту, чтобы войти в Prescore.':'Для восстановления доступа к Prescore задайте новый пароль по ссылке.';
 const action=verification?'Подтвердить почту':'Задать новый пароль';
 const ignore='Если вы не запрашивали это действие, проигнорируйте письмо.';
 const escaped=url.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 await transport.sendMail({from:config.from,to:email,subject,
  text:`Prescore\n\n${intro}\n\n${url}\n\n${ignore}`,
  html:`<!doctype html><html lang="ru"><body style="margin:0;padding:24px;font-family:Arial,sans-serif;color:#182535;background:#ffffff"><h1 style="font-size:24px">Prescore</h1><p>${intro}</p><p><a href="${escaped}" style="display:inline-block;padding:12px 20px;background:#183c36;color:#ffffff;text-decoration:none;border-radius:6px">${action}</a></p><p>Если кнопка не работает, откройте ссылку:</p><p><a href="${escaped}">${escaped}</a></p><p style="font-size:13px;color:#586575">${ignore}</p></body></html>`});
}
function createAuth() {
 const secret=process.env.AUTH_SECRET,baseURL=process.env.PRESCORE_BASE_URL;
 if(!secret||secret.length<32||!baseURL)throw new Error('AUTH_CONFIGURATION_MISSING');
 if(process.env.NODE_ENV==='production'&&!baseURL.startsWith('https://')&&!(process.env.PRESCORE_RUNTIME_MODE==='release-candidate'&&['localhost','127.0.0.1'].includes(new URL(baseURL).hostname)))throw new Error('AUTH_HTTPS_REQUIRED');
 return betterAuth({
  appName:'Prescore',database:getPool(),secret,baseURL,trustedOrigins:[new URL(baseURL).origin],
  emailAndPassword:{enabled:true,requireEmailVerification:true,minPasswordLength:8,revokeSessionsOnPasswordReset:true,sendResetPassword:async({user,url})=>sendAccountEmail(user.email,url,'Восстановление доступа к Prescore')},
  emailVerification:{sendOnSignUp:true,sendOnSignIn:false,autoSignInAfterVerification:false,sendVerificationEmail:async({user,url})=>sendAccountEmail(user.email,url,'Подтверждение почты Prescore')},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
  rateLimit:{enabled:true,storage:'database',window:60,max:30,customRules:{'/send-verification-email':{window:60,max:3},'/sign-in/email':{window:60,max:5},'/request-password-reset':{window:60,max:3},'/sign-up/email':{window:60,max:3}}},
  advanced:{useSecureCookies:baseURL.startsWith('https://'),cookiePrefix:'prescore',defaultCookieAttributes:{httpOnly:true,sameSite:'lax',secure:baseURL.startsWith('https://')}},
  logger:{disabled:true},
  databaseHooks:{session:{create:{after:async(session)=>{await getPool().query('INSERT INTO platform_security_events(id,user_id,event,created_at) VALUES($1,$2,$3,now())',[randomUUID(),session.userId,'SESSION_CREATED']);}},delete:{after:async(session)=>{await getPool().query('INSERT INTO platform_security_events(id,user_id,event,created_at) VALUES($1,$2,$3,now())',[randomUUID(),session.userId,'SESSION_DELETED']);}}}},
 });
}
let instance:ReturnType<typeof createAuth>|undefined;
export function getAuth(){return instance??=createAuth();}
export async function getAuthSession(headers:Headers):Promise<AuthSession|null> {
 const session=await getAuth().api.getSession({headers});
 if(!session||!session.user.emailVerified)return null;
 const r=await getPool().query("SELECT role FROM platform_roles WHERE user_id=$1 AND role='ADMIN' UNION SELECT 'AGENT' AS role FROM agent_accounts WHERE lower(user_email)=$2",[session.user.id,session.user.email.toLowerCase()]);
 const roles:AuthRole[]=['CLIENT',...r.rows.map(x=>x.role).filter((x):x is AuthRole=>['AGENT','ADMIN'].includes(x))];
 return{id:session.session.id,expiresAt:session.session.expiresAt,user:{id:session.user.id,email:session.user.email.toLowerCase(),fullName:session.user.name,displayName:session.user.name||session.user.email,roles}};
}
