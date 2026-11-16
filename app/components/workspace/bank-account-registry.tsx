import type {BankAccountRegister as AccountRegister} from '../../../lib/workspace/bank-account-registry.ts';

const d=(iso:string)=>iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(0,4);
export function BankAccountRegistry({data,busy,onUpload}:{data:AccountRegister;busy:boolean;onUpload:()=>void}){
 const accepted=data.accounts.filter(a=>!a.preview);
 const hasAction=data.accounts.some(a=>a.refreshGap||a.internalGaps.length||a.overlapCount||a.preview);
 return <section className="pc-bank-account-registry" aria-label="Реестр загруженных расчётных счетов">
  <header className="pc-bank-account-registry-head">
   <div><h3>Расчётные счета</h3><p>Реестр выписок · на {d(data.referenceDate)} (МСК)</p></div>
   <strong>{accepted.length} {accepted.length===1?'счёт':'сч. с выписками'}</strong>
  </header>
  {!data.accounts.length&&<p>Выписок с подтверждённым счётом и периодом пока нет. Добавьте выписку, чтобы появился календарь покрытия.</p>}
  <div className="pc-bank-account-registry-grid">
   {data.accounts.map(a=><article key={a.id} className="pc-bank-account-entry">
    <div className="pc-bank-account-title">
     <div><h4>{a.bankName??(a.bankNameConflict?'Название банка требует сверки':'Банк не определён')}</h4>
      <p>{a.accountMask} · {a.preview?'Предварительный XLSX':'Выписки TXT'}</p></div>
     <span className={'pc-bank-account-state pc-bank-account-'+a.state.toLowerCase()}>
      {a.preview?'Предварительно':a.state==='REVIEW'?'Сверить':a.state==='GAP'?'Есть пробел':
        a.state==='UPDATE_NEEDED'?'Нужна дозагрузка':'Покрыто по дату сверки'}
     </span>
    </div>
    <p className="pc-bank-account-covered"><strong>{d(a.firstCovered)} — {d(a.latestCovered)}</strong>
      <small>Загруженное покрытие · {a.periods.length} {a.periods.length===1?'интервал':'интервалов'}</small></p>
    {a.coverage.length>1&&<p className="pc-bank-account-detail">Подтверждённые части: {a.coverage.map(c=>d(c.from)+'–'+d(c.to)).join('; ')}</p>}
    {a.internalGaps.map((gap,i)=><p key={'gap-'+i} className="pc-bank-account-alert">Не загружено внутри: {d(gap.from)}–{d(gap.to)} ({gap.days} дн.).</p>)}
    {a.refreshGap&&<p className="pc-bank-account-alert">Для обновления до {d(data.referenceDate)}: дозагрузить {d(a.refreshGap.from)}–{d(a.refreshGap.to)} ({a.refreshGap.days} дн.).</p>}
    {a.overlapCount>0&&<p className="pc-bank-account-alert">Пересечений: {a.overlapCount}. Операции требуют сверки, суммы не складываются.</p>}
    {a.bankNameConflict&&<p className="pc-bank-account-alert">В источниках одного счёта различаются названия банков. Проверьте принадлежность выписок.</p>}
    {a.latestCovered>data.referenceDate&&<p className="pc-bank-account-alert">В документах указаны даты позже контрольного дня. Проверьте период.</p>}
    {a.preview&&<p className="pc-bank-account-detail">Предварительные данные XLSX не участвуют в B-Score.</p>}
    <details><summary>Загруженные файлы и даты ({a.periods.length})</summary>
      <ul>{a.periods.map((s,i)=><li key={s.sourceId+':'+i}>{d(s.from)}–{d(s.to)} · {s.file}</li>)}</ul>
    </details>
   </article>)}
  </div>
  {data.unverifiedFiles>0&&<p className="pc-bank-account-alert">Ещё {data.unverifiedFiles} файлов: банковский счёт или непрерывный период требуют подтверждения.</p>}
  <div className="pc-bank-account-footer">
   <small>Покрытие означает заявленный период выписок, а не доказательство отсутствия операций или полноты всех банков компании. Номера счетов в сводке сокращены.</small>
   <button type="button" disabled={busy} onClick={onUpload}>{hasAction?'Дозагрузить выписку':'Добавить выписку'}</button>
  </div>
 </section>;
}
