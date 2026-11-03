'use client';
import {useRef,useState} from 'react';
import {authClient} from '../../lib/auth/client';
export default function Logout(){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),inFlight=useRef(false);
 return <main className="ps-auth-page"><h1>Выход из Prescore</h1><p>Сохранённые анализы останутся в вашем кабинете. После выхода можно войти другим аккаунтом.</p><button disabled={busy} onClick={async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{const r=await authClient.signOut();if(r.error)throw Error('SIGN_OUT_FAILED');window.location.replace('/login');}
  catch{setError('Не удалось завершить сеанс. Повторите попытку.');}
  finally{inFlight.current=false;setBusy(false);}
 }}>{busy?'Завершаем сеанс…':'Выйти'}</button><a href="/dashboard">Вернуться в кабинет</a><p role="status">{error}</p></main>;
}
