'use client';
import {useRef,useState} from 'react';
import {authClient} from '../../lib/auth/client';
import {authErrorMessage} from '../../lib/auth/ux';
export default function ResetPassword(){
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 const inFlight=useRef(false);
 return <main className="ps-auth-page"><h1>Новый пароль</h1><form onSubmit={async e=>{
  e.preventDefault();if(inFlight.current||done)return;
  const token=new URLSearchParams(window.location.search).get('token');
  if(!token){setNotice(authErrorMessage({code:'INVALID_TOKEN'}));return;}
  const data=new FormData(e.currentTarget);inFlight.current=true;setBusy(true);setNotice('');
  try{const r=await authClient.resetPassword({newPassword:String(data.get('password')),token});
   if(r.error)setNotice(authErrorMessage(r.error));else{setDone(true);setNotice('Пароль изменён. Теперь можно войти в кабинет.');}
  }catch{setNotice(authErrorMessage());}finally{inFlight.current=false;setBusy(false);}
 }}><label>Пароль<input name="password" type="password" autoComplete="new-password" minLength={12} required disabled={busy||done}/></label><button disabled={busy||done}>{busy?'Подождите…':'Сохранить пароль'}</button><p role="status" aria-live="polite">{notice}</p><a href="/login">Вернуться ко входу</a></form></main>;
}
