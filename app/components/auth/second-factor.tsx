'use client';
import {useRef,useState} from 'react';
import {authClient} from '../../../lib/auth/client';
import {Input,PrimaryAction,SecondaryAction} from '../ui-v2/primitives';

export function mfaError(code?:string) {
 if(code==='ACCOUNT_TEMPORARILY_LOCKED'||code==='TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE')return 'Слишком много неверных попыток. Повторите вход позднее.';
 if(code==='MFA_RECHECK_REQUIRED')return 'Подтвердите второй фактор ещё раз, затем повторите действие.';
 if(code==='MFA_ENROLLMENT_TOTP_REQUIRED')return 'Завершите настройку кодом из приложения. Резервные коды используются после подключения.';
 if(code==='INVALID_TWO_FACTOR_COOKIE'||code==='UNAUTHORIZED')return 'Время подтверждения истекло. Вернитесь ко входу.';
 return 'Подтверждение не выполнено. Проверьте код и повторите попытку.';
}
export function SecondFactor({onVerified,allowBackup=true}:{onVerified:()=>void;allowBackup?:boolean}) {
 const [backup,setBackup]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const inFlight=useRef(false);
 return <form className="ps-form" aria-label="Подтверждение второго фактора" onSubmit={async e=>{
  e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setNotice('');
  const form=e.currentTarget,code=String(new FormData(form).get('factorCode')||'').trim();
  try{const r=backup?await authClient.twoFactor.verifyBackupCode({code,trustDevice:false}):await authClient.twoFactor.verifyTotp({code,trustDevice:false});
   form.reset();if(r.error){setNotice(mfaError(r.error.code));return;}onVerified();
  }catch{setNotice('Не удалось связаться с сервером. Повторите подтверждение.');}finally{inFlight.current=false;setBusy(false);}
 }}>
  <h3>{backup?'Восстановление резервным кодом':'Подтвердите вход'}</h3>
  <p>{backup?'Введите один из сохранённых резервных кодов. Каждый код используется один раз.':'Введите шестизначный код из приложения-аутентификатора.'}</p>
  <Input key={backup?'backup':'totp'} label={backup?'Резервный код':'Код из приложения'} name="factorCode" type="password" autoComplete="one-time-code" inputMode={backup?'text':'numeric'} pattern={backup?undefined:'[0-9]{6}'} maxLength={backup?64:6} required disabled={busy}/>
  <PrimaryAction disabled={busy}>{busy?'Проверяем…':'Подтвердить'}</PrimaryAction>
  {allowBackup&&<SecondaryAction type="button" disabled={busy} onClick={()=>{setBackup(!backup);setNotice('');}}>{backup?'Использовать приложение':'Нет приложения — резервный код'}</SecondaryAction>}
  <p role="status" aria-live="polite">{notice}</p>
 </form>;
}
