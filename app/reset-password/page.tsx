'use client';
import {useRef,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import {authClient} from '../../lib/auth/client';
import {authErrorMessage} from '../../lib/auth/ux';
export default function ResetPassword(){
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[passwordVisible,setPasswordVisible]=useState(false);
 const inFlight=useRef(false);
 return <main className="ps-auth-page"><h1>Новый пароль</h1><form onSubmit={async e=>{
  e.preventDefault();if(inFlight.current||done)return;
  const token=new URLSearchParams(window.location.search).get('token');
  if(!token){setNotice(authErrorMessage({code:'INVALID_TOKEN'}));return;}
  const data=new FormData(e.currentTarget);inFlight.current=true;setBusy(true);setNotice('');
  try{const r=await authClient.resetPassword({newPassword:String(data.get('password')),token});
   if(r.error)setNotice(authErrorMessage(r.error));else{setDone(true);setNotice('Пароль изменён. Теперь можно войти в кабинет.');}
  }catch{setNotice(authErrorMessage());}finally{inFlight.current=false;setBusy(false);}
 }}><div className="ps-password-control"><label>Пароль<input name="password" type={passwordVisible?'text':'password'} autoComplete="new-password" minLength={8} required disabled={busy||done}/></label><button type="button" className="ps-password-visibility" aria-label={passwordVisible?'Скрыть пароль':'Показать пароль'} aria-pressed={passwordVisible} disabled={busy||done} onClick={()=>setPasswordVisible(current=>!current)}>{passwordVisible?<EyeOff aria-hidden="true"/>:<Eye aria-hidden="true"/>}</button></div><button disabled={busy||done}>{busy?'Подождите…':'Сохранить пароль'}</button><p role="status" aria-live="polite">{notice}</p><a href="/login">Вернуться ко входу</a></form></main>;
}
