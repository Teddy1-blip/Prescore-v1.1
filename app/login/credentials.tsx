'use client';
import {Input,PrimaryAction,SecondaryAction} from '../components/ui-v2/primitives';
import {useEffect,useRef,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import {authClient} from '../../lib/auth/client';
import {safeReturnPath} from '../../lib/auth/contracts';
import {authErrorMessage,readRememberedEmail,rememberEmail,verificationReturnPath,RESEND_NOTICE,RESET_NOTICE} from '../../lib/auth/ux';

export function Credentials({returnTo,verified=false,verificationError=false}:{returnTo:string;verified?:boolean;verificationError?:boolean}) {
 const [mode,setMode]=useState<'login'|'register'|'reset'>('login');
 const [passwordVisible,setPasswordVisible]=useState(false);
 const [busy,setBusy]=useState(false),[email,setEmail]=useState(''),[remember,setRemember]=useState(false);
 const [notice,setNotice]=useState(verificationError?authErrorMessage({code:'TOKEN_EXPIRED'}):verified?'Почта подтверждена. Теперь можно войти.':'');
 const [canResend,setCanResend]=useState(verificationError),[cooldown,setCooldown]=useState(0);
 const inFlight=useRef(false);
 // Hydrate optional device-local form data after SSR; one intentional initial update.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const saved=readRememberedEmail();if(saved){setEmail(saved);setRemember(true);}},[]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(timer);},[cooldown]);
 function changeMode(next:typeof mode){setMode(next);setPasswordVisible(false);setNotice('');setCanResend(false);}
 async function resend(){
  if(inFlight.current||cooldown||!email.trim())return;
  inFlight.current=true;setBusy(true);setNotice('');setCooldown(60);
  try {
   const result=await authClient.sendVerificationEmail({email:email.trim().toLowerCase(),callbackURL:verificationReturnPath(returnTo)});
   setNotice(result.error?authErrorMessage(result.error):RESEND_NOTICE);
  } catch {setNotice(authErrorMessage());} finally {inFlight.current=false;setBusy(false);}
 }
 return <form className="ps-form" aria-label={mode==='login'?'Вход':mode==='register'?'Регистрация':'Восстановление доступа'} onSubmit={async e=>{
  e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setNotice('');setCanResend(false);
  const data=new FormData(e.currentTarget),normalizedEmail=String(data.get('email')||'').trim().toLowerCase(),password=String(data.get('password')||'');
  setEmail(normalizedEmail);
  try {
   if(mode==='reset'){
    const result=await authClient.requestPasswordReset({email:normalizedEmail,redirectTo:'/reset-password'});
    if(result.error){setNotice(authErrorMessage(result.error));return;}
    rememberEmail(normalizedEmail,remember);setNotice(RESET_NOTICE);
   } else if(mode==='register'){
    const result=await authClient.signUp.email({email:normalizedEmail,password,name:String(data.get('name')||''),callbackURL:verificationReturnPath(returnTo)});
    if(result.error){setNotice(authErrorMessage(result.error));return;}
    rememberEmail(normalizedEmail,remember);setNotice('Проверьте почту: если требуется подтверждение, вам придёт письмо.');setCanResend(true);setCooldown(60);
   } else {
    const result=await authClient.signIn.email({email:normalizedEmail,password});
    if(result.error){setNotice(authErrorMessage(result.error));setCanResend(result.error.code==='EMAIL_NOT_VERIFIED');return;}
    rememberEmail(normalizedEmail,remember);window.location.assign(safeReturnPath(returnTo));
   }
  } catch {setNotice(authErrorMessage());} finally {inFlight.current=false;setBusy(false);}
 }}>
 <h3>{mode==='login'?'Вход':mode==='register'?'Регистрация':'Восстановление доступа'}</h3>
 {mode==='register'&&<Input label="Имя" name="name" autoComplete="name" required maxLength={120} disabled={busy}/>}
 <Input label="Электронная почта" type="email" name="email" autoComplete="username" required value={email} disabled={busy} onChange={e=>{setEmail(e.target.value);}}/>
 {mode!=='reset'&&<div className="ps-password-control">
  <Input label="Пароль" type={passwordVisible?'text':'password'} name="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={mode==='register'?8:1} required disabled={busy}/>
  <button type="button" className="ps-password-visibility" aria-label={passwordVisible?'Скрыть пароль':'Показать пароль'} aria-pressed={passwordVisible} disabled={busy} onClick={()=>setPasswordVisible(current=>!current)}>{passwordVisible?<EyeOff aria-hidden="true"/>:<Eye aria-hidden="true"/>}</button>
 </div>
 <label><input type="checkbox" checked={remember} disabled={busy} onChange={e=>{setRemember(e.target.checked);if(!e.target.checked)rememberEmail('',false);}}/> Запомнить email на этом устройстве</label>
 <PrimaryAction disabled={busy}>{busy?'Подождите…':mode==='login'?'Войти':mode==='register'?'Создать аккаунт':'Восстановить доступ'}</PrimaryAction>
 <p role="status" aria-live="polite">{notice}</p>
 {canResend&&<SecondaryAction type="button" disabled={busy||cooldown>0||!email.trim()} onClick={resend}>Отправить письмо ещё раз{cooldown>0?` (${cooldown} с)`:''}</SecondaryAction>}
 <div className="ps-inline-actions"><SecondaryAction type="button" disabled={busy} onClick={()=>changeMode(mode==='login'?'register':'login')}>{mode==='login'?'Создать аккаунт':'Вернуться ко входу'}</SecondaryAction><SecondaryAction type="button" disabled={busy} onClick={()=>changeMode('reset')}>Забыли пароль?</SecondaryAction></div>
 </form>;
}
