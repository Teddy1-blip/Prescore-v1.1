// Backward-compatible names; standalone sessions are authoritative.
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {getAuthSession} from '../lib/auth/server';
import {safeReturnPath} from '../lib/auth/contracts';
import type {AuthUser} from '../lib/auth/contracts';
export type ChatGPTUser=AuthUser;
export async function getChatGPTUser():Promise<AuthUser|null>{return (await getAuthSession(await headers()))?.user??null;}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;const requested=safeReturnPath((await headers()).get('x-prescore-return-to')||returnTo);const path=requested.split('?')[0];const destination=path===returnTo||path.startsWith(returnTo+'/')?requested:returnTo;redirect(chatGPTSignInPath(destination));}
export function chatGPTSignInPath(returnTo:string){return '/login?returnTo='+encodeURIComponent(safeReturnPath(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/logout?returnTo='+encodeURIComponent(safeReturnPath(returnTo));}
