import { useId } from 'react';

export const SOURCES = [
  { name: 'Выписки', kind: '01 / ДЕНЕЖНЫЙ ПОТОК', detail: 'Поступления, контрагенты, остатки и фактическое обслуживание долга.' },
  { name: 'БФО', kind: '02 / ФИНАНСОВАЯ ОТЧЁТНОСТЬ', detail: 'Выручка, прибыль, капитал и обязательства — в связи с движением денег.' },
  { name: 'БКИ', kind: '03 / КРЕДИТНЫЙ ПОРТФЕЛЬ', detail: 'Кредиты, лимиты и платёжная дисциплина. Только при законном основании.' },
  { name: 'Реестры и контракты', kind: '04 / КОНТЕКСТ БИЗНЕСА', detail: 'Юридические сигналы и контрактная база дополняют финансовую картину.' },
] as const;

/** Original, deterministic financial traces; no client data or external artwork. */
export function SignalFlow({ active = 0, compact = false }: { active?: number; compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <div className={`l3-flow ${compact ? 'l3-flow-compact' : ''}`} data-active={active}>
    <svg className="l3-flow-wide" viewBox="0 0 1200 360" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-line`} x1="100" y1="100" x2="1090" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="var(--l3-cyan)"/><stop offset=".5" stopColor="var(--l3-teal)"/><stop offset="1" stopColor="var(--l3-violet)"/></linearGradient>
        <radialGradient id={`${id}-field`}><stop stopColor="var(--l3-cyan)" stopOpacity=".19"/><stop offset="1" stopColor="var(--l3-cyan)" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="605" cy="183" rx="270" ry="177" fill={`url(#${id}-field)`}/>
      {[0,1,2,3].map(group => <g key={group} className={`l3-strands l3-strands-${group}`}>
        {Array.from({length:6},(_,i)=>{
          const y = 45 + group*78 + i*5;
          const end = 158 + group*11 + i*3;
          const d = `M 110 ${y} C 300 ${y-24}, 350 ${end}, 490 ${end} S 680 ${end}, 722 ${end}`;
          return <path key={i} d={d} stroke={`url(#${id}-line)`} strokeWidth={i===2?1.6:.7} className={i===2?'l3-flow-pulse':''}/>;
        })}
        <circle cx="110" cy={55+group*78} r="4" fill="var(--l3-teal)"/>
        <text x="10" y={31+group*78} className="l3-svg-label">{['ВЫПИСКИ','БФО','БКИ','КОНТРАКТЫ'][group]}</text>
      </g>)}
      {Array.from({length:25},(_,i)=><ellipse key={i} cx={532+i*5} cy="180" rx={36+Math.sin(i/24*Math.PI)*27} ry={96-Math.sin(i/24*Math.PI)*19} stroke={`url(#${id}-line)`} strokeOpacity={.15+Math.sin(i/24*Math.PI)*.42} strokeWidth=".85"/>)}
      <rect x="487" y="148" width="230" height="64" rx="32" fill="var(--l3-abyss)"/>
      <text x="602" y="188" textAnchor="middle" className="l3-svg-brand">prescore</text>
      <text x="602" y="302" textAnchor="middle" className="l3-svg-caption">НОРМАЛИЗАЦИЯ · СВЕРКА · АНАЛИЗ</text>
      {[70,179,289].map((y,i)=><g key={y}>
        <path d={`M 718 ${169+i*10} C 814 ${169+i*10}, 813 ${y}, 952 ${y}`} stroke={`url(#${id}-line)`} strokeWidth="1.6"/>
        <path className="l3-flow-pulse" d={`M 718 ${169+i*10} C 814 ${169+i*10}, 813 ${y}, 952 ${y}`} stroke="var(--l3-teal)" strokeWidth="2"/>
        <circle cx="952" cy={y} r="4" fill="var(--l3-teal)"/>
        <text x="975" y={y-6} className="l3-svg-result">{['Prescore Index','Debt Capacity','План действий'][i]}</text>
        <text x="975" y={y+17} className="l3-svg-caption">{['ПРОФИЛЬ И ГОТОВНОСТЬ','ЗАПАС ОБСЛУЖИВАНИЯ ДОЛГА','МАРШРУТ · 7 / 30 / 60'][i]}</text>
      </g>)}
    </svg>
    <svg className="l3-flow-tall" viewBox="0 0 340 420" fill="none" aria-hidden="true">
      {[40,125,210,300].map((x,g)=><g key={x} className={`l3-strands l3-strands-${g}`}>
        <text x={x} y="24" textAnchor="middle" className="l3-svg-label">{['ВЫПИСКИ','БФО','БКИ','РЕЕСТРЫ'][g]}</text>
        {Array.from({length:5},(_,i)=><path key={i} className={i===2?'l3-flow-pulse':''} d={`M ${x+i*3-6} 40 C ${x+i*3-6} 130, ${157+i*5} 98, ${157+i*5} 180`} stroke={g%2?'var(--l3-violet)':'var(--l3-teal)'} strokeWidth="1"/>)}
      </g>)}
      {Array.from({length:16},(_,i)=><ellipse key={i} cx="170" cy={171+i*4} rx={74-Math.sin(i/15*Math.PI)*14} ry="27" stroke="var(--l3-teal)" strokeOpacity=".26"/>)}
      <rect x="83" y="183" width="174" height="49" rx="24" fill="var(--l3-abyss)"/>
      <text x="170" y="214" textAnchor="middle" className="l3-svg-brand">prescore</text>
      {[0,1,2].map(i=><g key={i}><path d={`M ${152+i*18} 241 C ${152+i*18} ${270+i*35}, 48 ${251+i*52}, 48 ${285+i*52} H 69`} stroke={i===1?'var(--l3-violet)':'var(--l3-teal)'} strokeWidth="1.3"/><circle cx="69" cy={285+i*52} r="3" fill="var(--l3-teal)"/><text x="84" y={290+i*52} className="l3-svg-result">{['Prescore Index','Debt Capacity','План 7 / 30 / 60'][i]}</text></g>)}
    </svg>
  </div>;
}

export function CapacityGraphic() {
  return <svg viewBox="0 0 600 220" className="l3-capacity-graphic" role="img" aria-label="Условная схема: денежный поток покрывает текущие платежи, резерв и расчётную дополнительную нагрузку">
    {[40,85,130,175].map(y=><line key={y} x1="20" y1={y} x2="580" y2={y} stroke="var(--l3-border)"/>)}
    <path d="M20 99 C65 99 74 75 116 83 S170 112 213 75 S268 43 307 62 S372 83 416 54 S490 48 533 34 L580 30 L580 175 L20 175Z" fill="var(--l3-accent-subtle)"/>
    <path d="M20 99 C65 99 74 75 116 83 S170 112 213 75 S268 43 307 62 S372 83 416 54 S490 48 533 34 L580 30" fill="none" stroke="var(--l3-teal)" strokeWidth="3"/>
    <path d="M20 148 H110 L165 140 H230 L285 125 H368 L410 132 H505 L550 110 H580" fill="none" stroke="var(--l3-violet)" strokeWidth="3"/>
    {[20,130,240,350,460,570].map((x,i)=><text key={x} x={x} y="207" className="l3-svg-caption">{['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН'][i]}</text>)}
  </svg>;
}

export function ActionTimeline() {
  return <div className="l3-timeline">{[
    ['07','Прояснить','Сверить источники и уточнить обязательства. Разобраться в факторах, которые требуют внимания.'],
    ['30','Подготовить','Собрать документы, проверить условия подходящих продуктов и подготовить финансовую позицию.'],
    ['60','Пересмотреть','Добавить новые данные. Сопоставить изменения и проверить, что предпринятые действия дали результат.'],
  ].map(([day,title,text],i)=><article key={day}><span className="l3-timeline-point" aria-hidden="true"/><span className="l3-day">{day}<small>дней</small></span><h3>{title}</h3><p>{text}</p><span className="l3-timeline-index">0{i+1} / {['ДАННЫЕ','ДЕЙСТВИЯ','ПРОВЕРКА'][i]}</span></article>)}</div>;
}
