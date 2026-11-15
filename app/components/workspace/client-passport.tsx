'use client';

import {publicPassport,type PassportPublicProfile} from '../../../lib/workspace/public-passport';
import './client-passport.css';

/** Existing dossier's public passport: no parallel profile, score or bank matcher. */
export function CompanyPassport({
  inn,profile,hasStatements,hasAnnual,full,onBankUpload,
}:{
  inn:string;
  profile:PassportPublicProfile|null;
  hasStatements:boolean;
  hasAnnual:boolean;
  full:boolean;
  onBankUpload:()=>void;
}){
  const passport=publicPassport(profile,inn,hasStatements,hasAnnual);
  const facts=[
    ['ОГРН',passport.company.ogrn],
    ['Дата регистрации',passport.company.registrationDate],
    ['Регион',passport.company.region],
    ['Основной ОКВЭД',passport.company.okved],
    ['Юридический статус',passport.company.status],
    ['Контракты по доступным сведениям',passport.contracts===null?null:String(passport.contracts)],
  ].filter((row):row is string[]=>row[1]!==null&&row[1]!==undefined);
  return <section className="pc-passport" aria-label="Паспорт компании">
    <div className="pc-passport-heading">
      <div>
        <span className="pc-passport-eyebrow">PRESCORE · ПАСПОРТ КОМПАНИИ</span>
        <h2>{passport.company.title}</h2>
        <p>ИНН {inn} · {profile?'Публичные сведения компании':'Добавьте подтверждённые сведения об организации'}</p>
        <div className="pc-passport-tags">
          <span className="pc-passport-tag">Источник: {passport.source}</span>
          {passport.stale&&<span className="pc-passport-tag attention">Проверить актуальность сведений</span>}
          {full&&<span className="pc-passport-tag">Доступ Full к расширенной аналитике</span>}
        </div>
      </div>
      <button type="button" className="pc-passport-upload" onClick={onBankUpload}>+ Загрузить выписку</button>
    </div>
    <div className="pc-passport-metrics">
      <article>
        <small>Регистрация</small>
        <strong>{passport.company.registrationDate??'—'}</strong>
        <span>Проверенное поле публичного профиля</span>
      </article>
      <article>
        <small>Регион</small>
        <strong>{passport.company.region??'—'}</strong>
        <span>Без автоматического банковского вывода</span>
      </article>
      <article>
        <small>Судебные события</small>
        <strong>{passport.attention.some(item=>item.title.includes('Судебные'))?'Есть сведения':'Проверить источник'}</strong>
        <span>Только подтверждённые и датированные записи</span>
      </article>
      <article>
        <small>Исполнительные производства</small>
        <strong>{passport.attention.some(item=>item.title.includes('Исполнительные'))?'Есть сведения':'Проверить источник'}</strong>
        <span>Нужна оценка актуального состояния</span>
      </article>
    </div>
    <div className="pc-passport-grid">
      <div className="pc-passport-section">
        <div className="pc-passport-section-title"><h3>Основные сведения</h3><span>Checko / реестры</span></div>
        {facts.length?<dl className="pc-passport-facts">{facts.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
          :<p>Сохраните компанию и загрузите доступные данные Checko для формирования паспорта.</p>}
      </div>
      <div className="pc-passport-section">
        <div className="pc-passport-section-title"><h3>Экспертная оценка · Free</h3><span>Из известных фактов</span></div>
        <p className="pc-passport-lead">{passport.publicExpertise}</p>
        {passport.attention.length>0?<div className="pc-passport-attentions">
          {passport.attention.map(item=><article key={item.title}>
            <strong>{item.title}</strong><p>{item.detail}</p><small>{item.evidence}</small>
          </article>)}
        </div>:<p className="pc-passport-muted">Банковские стоп-факторы конкретных программ появятся здесь только после проверки актуальных требований банка, даты и применимости продукта.</p>}
      </div>
    </div>
    <div className="pc-passport-grid">
      <div className="pc-passport-section">
        <div className="pc-passport-section-title"><h3>Что сделать дальше</h3><span>До двух Free-рекомендаций</span></div>
        <ol className="pc-passport-actions">{passport.actions.map(item=><li key={item.title}><strong>{item.title}</strong><p>{item.detail}</p><small>{item.evidence}</small></li>)}</ol>
      </div>
      <div className="pc-passport-section">
        <div className="pc-passport-section-title"><h3>Возможные инструменты финансирования</h3><span>Не оферты банков</span></div>
        <p>Оборотное финансирование, кредитная линия, банковская гарантия, факторинг и лизинг рассматриваются только после проверки потребности и соответствующих источников.</p>
        <p className="pc-passport-muted">Названия банков, ставки и жёсткие критерии здесь не публикуются без проверенного действующего паспорта продукта. Предварительное совпадение не означает решения кредитора.</p>
      </div>
    </div>
  </section>;
}
