"use client";
import {useState, type FormEvent} from 'react';
import type {WorkspaceModelV1} from '../../../lib/workspace/model';
import {Panel} from './client-insights';
import {date} from './presentation';

const reasons: Record<string,string> = {
  ORIGIN_NOT_CONFIRMED:'Нет независимого подтверждения происхождения.', OFFICIAL_SOURCE_UNAVAILABLE:'Официальная копия недоступна: происхождение не подтверждено.',
  INFORMATION_DATE_UNCONFIRMED:'Дата сведений не распознана однозначно.',INFORMATION_DATE_FUTURE:'Дата сведений находится в будущем.',INFORMATION_DATE_STALE:'Сведения старше допустимых 30 дней.',
  LIFECYCLE_NOT_EXPLICIT_OR_AMBIGUOUS:'Явный однозначный статус юридического лица не найден.',OLDER_THAN_ACTIVE_SOURCE:'Сведения старше уже выбранного источника.',
  SAME_DATE_LIFECYCLE_CONFLICT:'Источники одной даты противоречат друг другу: статус не применяется.',
  OFFICIAL_CONTENT_HASH_MISMATCH:'Загруженный файл отличается от официальной копии.',LEGAL_COMPANY_IDENTITY_MISMATCH:'ИНН не совпадает с компанией или найдено несколько ИНН юридических лиц.',
  OFFICIAL_DOWNLOAD_URL_REQUIRED:'Нужна прямая HTTPS-ссылка скачивания выписки с egrul.nalog.ru/vyp-download/.',LEGAL_SOURCE_ALREADY_SAVED:'Этот источник с таким результатом проверки уже сохранён.',
  EGRUL_FORMAT_UNSUPPORTED:'Формат выписки не поддерживается.',LEGAL_PDF_INVALID:'PDF повреждён, защищён или превышает 100 страниц.',
  LEGAL_PDF_REQUIRED:'Выберите текстовый PDF.',LEGAL_FILE_SIZE_INVALID:'Размер PDF должен быть от 1 байта до 8 МБ.',
  LEGAL_HISTORY_LIMIT_REACHED:'Достигнут предел истории источников. Предыдущие записи сохранены.',ANALYSIS_CHANGED_RETRY:'Анализ изменился в другой вкладке. Обновите страницу перед повторной отправкой.',
};
const statuses:Record<string,string>={ACTIVE:'Действующее',TERMINATED:'Деятельность прекращена',LIQUIDATION:'В процессе ликвидации',BANKRUPTCY_ACTIVE:'Действующая процедура банкротства'};
export function LegalRegistrySource({model,saved}:{model:WorkspaceModelV1;saved?:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),registry=model.basic.legalRegistry;
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);form.set('analysisId',model.basic.analysis.id);setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/legal-source',{method:'POST',body:form}),body=await response.json();
      if(!response.ok)throw Error(reasons[body.error]??body.error??'Не удалось сохранить источник');
      setMessage('Сведения об источнике сохранены. Результат проверки показан ниже.');await saved?.();
    } catch(error){setMessage(error instanceof Error?error.message:'Не удалось обработать источник');}finally{setBusy(false);}
  }
  return <Panel title="Юридический источник · выписка ЕГРЮЛ">
    <p>Поддерживается текстовая выписка с одним ИНН юридического лица, датой «по состоянию на» и явно указанным состоянием юридического лица. Отсутствие записи о ликвидации не означает статус «Действующее».</p>
    <p className="pc-muted">Сервер независимо скачивает копию по прямой ссылке ФНС и сравнивает SHA-256. Электронная подпись криптографически не проверяется. Печать, текст PDF и ручной флажок не подтверждают происхождение. Проверяется только жизненный цикл, а не отсутствие остальных юридических рисков.</p>
    {saved&&!model.access.readOnly&&<form onSubmit={submit} className="pc-form-grid">
      <label>Выписка ЕГРЮЛ (PDF до 8 МБ)<input name="file" type="file" accept=".pdf,application/pdf" required disabled={busy}/></label>
      <label>Прямая ссылка скачивания с ФНС<input name="officialUrl" type="url" placeholder="https://egrul.nalog.ru/vyp-download/…" disabled={busy}/></label>
      <p className="pc-muted">Получите выписку на <a href="https://egrul.nalog.ru/" target="_blank" rel="noopener noreferrer">сервисе ФНС</a> и скопируйте адрес её скачивания. Без доступной официальной копии источник останется неподтверждённым. Ссылка не сохраняется; исходный PDF не хранится, сохраняются хеш и сведения проверки.</p>
      <button type="submit" disabled={busy}>{busy?'Проверка источника…':'Проверить и сохранить источник'}</button>
    </form>}
    {message&&<p role="status">{message}</p>}
    {!registry?.history.length?<p>Подтверждённая выписка не добавлена.</p>:<ul>{[...registry.history].reverse().map(r=><li key={r.id}>
      <strong>{r.origin==='CONFIRMED'?'Происхождение подтверждено независимым получением ФНС':'Происхождение не подтверждено'}</strong>
      <p>ИНН {r.companyInn} · сведения на {date(r.informationDate)} · получены {date(r.receivedAt)} · проверены {date(r.checkedAt)}.</p>
      <p>{r.lifecycle?`Извлечённый статус: ${statuses[r.lifecycle]??r.lifecycle}.`:'Однозначный статус не определён.'} {registry.activeSourceId===r.id?'Выбран как источник жизненного цикла; канонический расчёт отдельно проверяет актуальность и противоречия.':'Не является текущим источником расчёта.'}</p>
      {r.reasons.map(reason=><p key={reason}>{reasons[reason]??reason}</p>)}
      <small>SHA-256: {r.contentHash}<br/>Исполнитель: сервер {r.verifier}. Метод: независимое получение официальной копии, без проверки подписи.{r.replacesSourceId?' Заменяет источник '+r.replacesSourceId+'.':''}</small>
    </li>)}</ul>}
  </Panel>;
}
