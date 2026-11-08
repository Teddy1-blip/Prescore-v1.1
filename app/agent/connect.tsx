'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
import {PrimaryAction} from '../components/ui-v2/primitives';
import {safeReturnPath} from '../../lib/auth/contracts';
import '../prescore-ui-v1.css';

export function AgentConnection({email,returnTo='/agent',invitation=''}:{email:string;returnTo?:string;invitation?:string}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false);
 return <main className="login-shell"><section className="login-story"><Link className="brand brand-light" href="/">Прескор</Link><div className="login-story-copy"><span className="login-kicker">КАБИНЕТ АГЕНТА</span><h1>Подключите партнёрский профиль</h1><p>Используйте свою существующую учётную запись. Клиентский кабинет и ваши анализы сохранятся.</p><p>Подключение не открывает чужие досье: доступны только собственные и назначенные вам клиенты.</p></div></section><section className="login-form-panel"><div className="login-form"><h2>Подключение агента</h2><p>Подтверждённая почта: <strong style={{overflowWrap:'anywhere'}}>{email}</strong></p>{invitation&&<p>Приглашение: {invitation}. Оно должно быть оформлено на эту почту.</p>}
 <form className="ps-form" aria-label="Подключение агента" onSubmit={async event=>{
  event.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  const data=new FormData(event.currentTarget);
  try {
   const response=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'connect',invitation,offerAccepted:data.get('offerAccepted')==='on',consent:data.get('consent')==='on'})});
   const result=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!result.ok){setError(response.status===401?'Сессия завершилась. Войдите снова, чтобы подключить профиль.':result.error||'Не удалось подключить профиль. Повторите попытку.');return;}
   const safe=safeReturnPath(returnTo),path=safe.split(/[?#]/)[0];
   window.location.assign(path==='/agent'||path.startsWith('/agent/')?safe:'/agent');
  } catch {setError('Не удалось связаться с сервером. Профиль можно безопасно подключить повторно.');}
  finally {inFlight.current=false;setBusy(false);}
 }}>
 <label><input type="checkbox" name="offerAccepted" required disabled={busy}/> Принимаю условия партнёрской программы в <Link href="/offer" target="_blank">оферте</Link> и ознакомлен(а) с <Link href="/privacy" target="_blank">Политикой конфиденциальности</Link>.</label>
 <label><input type="checkbox" name="consent" required disabled={busy}/> Даю отдельное <Link href="/consent" target="_blank">согласие на обработку персональных данных</Link>.</label>
 <p>Подключение профиля бесплатно. Вознаграждение за регистрацию не начисляется.</p>
 <PrimaryAction disabled={busy}>{busy?'Подключаем…':'Подключить кабинет агента'}</PrimaryAction>
 {error&&<p role="alert">{error}</p>}
 </form><p><Link href={'/login?returnTo='+encodeURIComponent(safeReturnPath(returnTo))}>Вернуться ко входу</Link> · <Link href="/dashboard">Клиентский кабинет</Link> · <Link href="/logout">Сменить аккаунт</Link></p></div></section></main>;
}
