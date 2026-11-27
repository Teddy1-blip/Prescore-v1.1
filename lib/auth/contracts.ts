export type AuthRole = 'CLIENT' | 'AGENT' | 'ADMIN';
export type AuthUser = {id:string; email:string; displayName:string; fullName:string|null; roles:AuthRole[]};
export type AuthSession = {id:string; expiresAt:Date; user:AuthUser};
export interface SessionProvider { getSession(headers:Headers):Promise<AuthSession|null> }
export function safeReturnPath(value:string) {
 try {const u=new URL(value,'https://prescore.invalid');return value.startsWith('/')&&u.origin==='https://prescore.invalid'&&!value.startsWith('//')&&!/^\/(api\/auth|login|logout)/.test(u.pathname)?u.pathname+u.search+u.hash:'/dashboard';}catch{return '/dashboard';}
}
