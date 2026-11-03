'use client';
import {useRef,useState} from 'react';
import {authClient} from '../../../lib/auth/client';
import type {AdminMfaState} from '../../../lib/auth/contracts';
import {Input,PrimaryAction,SecondaryAction} from '../../components/ui-v2/primitives';
import {SecondFactor,mfaError} from '../../components/auth/second-factor';

export function AdminSecurity({state}:{state:AdminMfaState}) {
 const [setup,setSetup]=useState<{secret:string;codes:string[]}|null>(null),[codes,setCodes]=useState<string[]>([]),[saved,setSaved]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[recheck,setRecheck]=useState(false);
 const inFlight=useRef(false);
 if(state==='DISABLED')return <p role="status">Второй фактор ещё не включён. Требуется согласованная поставка схемы и план восстановления доступа.</p>;
 if(state==='VERIFICATION_REQUIRED'||recheck)return <SecondFactor onVerified={()=>window.location.replace('/prescore-control/security')}/>;
 if(setup)return <section aria-label="Настройка приложения-аутентификатора"><h2>Добавьте Prescore в приложение-аутентификатор</h2><p>Выберите ручной ввод ключа, тип TOTP, 6 цифр, период 30 секунд. Ключ и резервные коды показываются только здесь; не отправляйте их в чат или поддержку.</p><Input label="Ключ для приложения" value={setup.secret} readOnly autoComplete="off"/><h3>Резервные коды</h3><p>Сохраните их в своём защищённом хранилище. Они нужны при потере приложения и используются по одному разу.</p><ul>{setup.codes.map(code=><li key={code}><code>{code}</code></li>)}</ul><label><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/> Резервные коды сохранены</label>{saved&&<SecondFactor allowBackup={false} onVerified={()=>{setSetup(null);window.location.replace('/prescore-control/security');}}/>}</section>;
 return <section><p>{state==='VERIFIED'?'Второй фактор подтверждён для текущего входа.':'Подключите приложение-аутентификатор. Настройка завершится после проверки кода.'}</p>
 <form className="ps-form" aria-label={state==='VERIFIED'?'Новые резервные коды':'Подключение второго фактора'} onSubmit={async e=>{
  e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setNotice('');setCodes([]);
  const form=e.currentTarget,password=String(new FormData(form).get('password')||'');
  try{
   if(state==='VERIFIED'){
    const r=await authClient.twoFactor.generateBackupCodes({password});
    if(r.error){setNotice(mfaError(r.error.code));return;}setCodes(r.data?.backupCodes??[]);
   }else{
    const r=await authClient.twoFactor.enable({password,method:'totp'});
    if(r.error){setNotice(mfaError(r.error.code));return;}
    if(r.data&&'totpURI' in r.data&&r.data.totpURI){setSaved(false);setSetup({secret:new URL(r.data.totpURI).searchParams.get('secret')||'',codes:r.data.backupCodes??[]});}
   }
  }catch{setNotice('Не удалось связаться с сервером. Повторите действие.');}finally{form.reset();inFlight.current=false;setBusy(false);}
 }}>
 <Input label="Текущий пароль" name="password" type="password" autoComplete="current-password" required disabled={busy}/>
 {state==='VERIFIED'&&<p>Новый набор заменит прежние резервные коды. Сначала подтвердите фактор заново, если с подтверждения прошло больше пяти минут.</p>}
 <PrimaryAction disabled={busy}>{busy?'Подождите…':state==='VERIFIED'?'Создать новые резервные коды':'Подключить приложение'}</PrimaryAction>
 <p role="status" aria-live="polite">{notice}</p>
 </form>
 {state==='VERIFIED'&&<SecondaryAction type="button" onClick={()=>{setCodes([]);setRecheck(true);}}>Подтвердить фактор заново</SecondaryAction>}
 {codes.length>0&&<section aria-label="Новые резервные коды"><h2>Сохраните новые коды</h2><p>Прежние коды больше не действуют. После закрытия этой страницы набор не показывается повторно.</p><ul>{codes.map(code=><li key={code}><code>{code}</code></li>)}</ul><SecondaryAction type="button" onClick={()=>setCodes([])}>Коды сохранены — скрыть</SecondaryAction></section>}
 </section>;
}
