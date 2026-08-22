"use client";

import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Banknote, BarChart3, Building2, Calculator,
  Check, ChevronRight, CircleAlert, CircleCheckBig, FileSearch, Gauge,
  Landmark, LockKeyhole, Menu, SearchCheck, ShieldCheck, FileText, Download,
  TrendingUp, UploadCloud, UsersRound, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import "./prescore-ui-v1.css";

const analysisTabs = [
  { id: "score", label: "Рейтинг", eyebrow: "КРЕДИТНЫЙ ПРОФИЛЬ", title: "Поймите, как банк оценивает вашу компанию.", body: "Прескор собирает ключевые показатели в единый индекс и показывает, какие факторы повышают или снижают готовность к финансированию.", value: "Индекс", unit: "Прескор", note: "Значение рассчитывается по вашим данным" },
  { id: "factors", label: "Стоп-факторы", eyebrow: "ПРИЧИНЫ ОТКАЗА", title: "Узнайте о рисках до подачи заявки в банк.", body: "Система проверяет транзакции, налоги, долговую нагрузку, концентрацию выручки и другие сигналы, влияющие на решение кредитного комитета.", value: "Риски", unit: "по источникам", note: "Только подтверждённые факторы" },
  { id: "advice", label: "Рекомендации", eyebrow: "ПЛАН УЛУЧШЕНИЯ", title: "Получите конкретные действия, а не общий отчет.", body: "Каждая рекомендация объясняет проблему, ожидаемый эффект и последовательность действий для улучшения кредитного профиля.", value: "7/30/60", unit: "дней", note: "Действие и способ проверки результата" },
  { id: "offers", label: "Маршруты", eyebrow: "ПОДБОР ФИНАНСИРОВАНИЯ", title: "Поймите, какой продукт подходит и куда обращаться.", body: "Прескор сопоставляет поток, БФО, юридические сигналы и продуктовые фильтры банков. Для каждого маршрута показывает причины, ограничения и необходимые документы.", value: "1–3", unit: "маршрута", note: "Только соответствующие текущему профилю" },
];

const benefits = [
  { icon: SearchCheck, title: "Банковская логика", text: "Проверяем показатели, на которые банки смотрят при анализе бизнеса." },
  { icon: Gauge, title: "Быстрый результат", text: "Выписка превращается в понятный кредитный профиль сразу после загрузки." },
  { icon: BarChart3, title: "Глубокая аналитика", text: "Обороты, налоги, контрагенты, платежная дисциплина и долговая нагрузка." },
  { icon: ShieldCheck, title: "Контроль данных", text: "Без вашего согласия отчет и выписка не отправляются финансовым партнерам." },
  { icon: FileSearch, title: "Объяснимые выводы", text: "Каждый риск связан с показателем, причиной и способом исправления." },
  { icon: UsersRound, title: "Помощь эксперта", text: "Финансовый специалист поможет разобрать отчет и подготовить заявку." },
];

function Brand({ light = false }: { light?: boolean }) {
  return <span className={light ? "brand brand-light" : "brand"}><strong>Прескор</strong></span>;
}

function rubles(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(analysisTabs[0]);
  const [product, setProduct] = useState<"loan" | "guarantee">("loan");
  const [amount, setAmount] = useState(5_000_000);
  const [term, setTerm] = useState(12);
  const [loanRate, setLoanRate] = useState(18.9);
  const [guaranteeRate, setGuaranteeRate] = useState(3.2);

  const activeRate = product === "loan" ? loanRate : guaranteeRate;
  const recommendedRate = product === "loan" ? 18.9 : 3.2;

  const calculation = useMemo(() => {
    if (product === "guarantee") {
      const commission = amount * (guaranteeRate / 100) * (term / 12);
      return { primary: commission, total: amount + commission, cost: commission };
    }
    const monthlyRate = loanRate / 100 / 12;
    const payment = monthlyRate === 0
      ? amount / term
      : amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    const total = payment * term;
    return { primary: payment, total, cost: total - amount };
  }, [amount, guaranteeRate, loanRate, product, term]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="ru-site">
      <nav className="ru-nav" aria-label="Основная навигация">
        <Link href="/" aria-label="Прескор — главная"><Brand /></Link>
        <div className={menuOpen ? "ru-nav-links is-open" : "ru-nav-links"}>
          <a href="#advantages" onClick={closeMenu}>Преимущества</a><a href="#how" onClick={closeMenu}>Как это работает</a><a href="#calculator" onClick={closeMenu}>Калькулятор</a><a href="#pricing" onClick={closeMenu}>Тариф</a><Link href="/agents" onClick={closeMenu}>Агентам</Link><a href="#about" onClick={closeMenu}>О проекте</a>
          <Link className="ru-mobile-cabinet" href="/dashboard" onClick={closeMenu}>Кабинет клиента</Link><Link className="ru-mobile-cabinet" href="/agent" onClick={closeMenu}>Кабинет агента</Link><Link className="ru-mobile-cabinet" href="/admin" onClick={closeMenu}>ЛК администратора</Link>
        </div>
        <div className="ru-nav-actions"><Link className="ru-login" href="/agent">Агент</Link><Link className="ru-admin-login" href="/admin">Админ</Link><Link className="ru-register" href="/login">Кабинеты</Link></div>
        <button className="ru-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}>{menuOpen ? <X /> : <Menu />}</button>
      </nav>

      <section className="ru-hero">
        <div className="ru-hero-copy">
          <span className="ru-kicker"><BadgeCheck /> Финтех-платформа для малого и среднего бизнеса</span>
          <h1>Ваш бизнес в цифрах.<br /><em>Ключ к финансированию.</em></h1>
          <p>Узнайте, почему банки могут отказать, что нужно исправить и какие финансовые продукты подходят вашей компании прямо сейчас.</p>
          <div className="ru-hero-actions"><Link className="ru-button ru-button-primary" href="/login">Начать бесплатно <ArrowRight /></Link><Link className="ru-button ru-button-secondary" href="/checkout">FULL — 6 500 ₽</Link></div>
          <div className="ru-hero-notes"><span><Check /> FREE: финансовый dashboard и заявки</span><span><Check /> FULL: кредитный смысл и план действий</span></div>
        </div>

        <div className="ru-dashboard-shot" id="product-demo" aria-label="Демонстрация личного кабинета Прескор">
          <div className="ru-shot-top"><span><Brand light /></span><div><i /> Данные обновлены</div></div>
          <div className="ru-shot-body">
            <aside><span className="active"><Gauge /> Обзор</span><span><BarChart3 /> Показатели</span><span><CircleAlert /> Стоп-факторы <b>3</b></span><span><SearchCheck /> Рекомендации</span><span><Landmark /> Предложения</span></aside>
            <div className="ru-shot-main">
              <div className="ru-shot-heading"><span><small>ООО «Альфа Производство» · учебный пример</small><strong>Кредитный профиль</strong></span><button>Скачать PDF</button></div>
              <div className="ru-score-row">
                <div className="ru-index-card"><span>Индекс Прескор</span><strong>742</strong><small>из 1000</small><b><TrendingUp /> +28 за месяц</b></div>
                <div><small>Среднемесячный оборот</small><strong>7,5 млн ₽</strong><span className="positive">Стабильный</span></div>
                <div><small>Лимит после БКИ</small><strong>10,7 млн ₽</strong><span>До БКИ: 12,5 млн ₽</span></div>
                <div><small>Уровень риска</small><strong>Низкий</strong><span className="positive">Профиль устойчив</span></div>
              </div>
              <div className="ru-shot-grid">
                <div className="ru-turnover-card">
                  <div><span><b>Обороты и долговая нагрузка</b><small>Последние 6 месяцев</small></span><em>₽ млн</em></div>
                  <svg viewBox="0 0 570 185" role="img" aria-label="График оборотов и долговой нагрузки"><path d="M12 145 C75 132 105 88 160 105 S248 145 300 92 S385 55 438 78 S505 92 558 38 L558 175 L12 175Z" fill="url(#ruFill)" /><path d="M12 145 C75 132 105 88 160 105 S248 145 300 92 S385 55 438 78 S505 92 558 38" fill="none" stroke="#1769aa" strokeWidth="4" /><path d="M12 132 C80 128 120 121 178 125 S270 112 330 118 S435 104 558 108" fill="none" stroke="#ef8a3d" strokeWidth="3" strokeDasharray="7 7" /><defs><linearGradient id="ruFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2d85c5" stopOpacity=".22" /><stop offset="1" stopColor="#2d85c5" stopOpacity="0" /></linearGradient></defs></svg>
                  <div className="ru-chart-labels"><span>Март</span><span>Апрель</span><span>Май</span><span>Июнь</span><span>Июль</span><span>Август</span></div>
                </div>
                <div className="ru-factor-card"><span>ТРЕБУЕТ ВНИМАНИЯ</span><h3>3 стоп-фактора</h3><p><CircleAlert /> Высокая доля платежей физлицам</p><p><CircleAlert /> Один покупатель дает 48% выручки</p><p className="good"><CircleCheckBig /> Налоговая нагрузка в норме</p><button>Посмотреть план <ChevronRight /></button></div>
              </div>
              <div className="ru-ai-line"><SearchCheck /><span><small>РЕКОМЕНДАЦИЯ ПРЕСКОР</small><b>Снизьте концентрацию выручки — расчетный лимит может вырасти примерно на 15%</b></span><ChevronRight /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ru-data-strip" aria-label="Источники данных"><span>ИСТОЧНИКИ АНАЛИЗА</span><div><b><UploadCloud /> Выписки 1С</b><b><Building2 /> БФО</b><b><FileSearch /> Официальные реестры: Правовой контур и контракты</b><b><ShieldCheck /> БКИ — с согласия клиента</b></div></section>

      <section className="ru-analysis" id="advantages">
        <div className="ru-section-heading"><span>ФИНАНСОВАЯ ДИАГНОСТИКА</span><h2>Путь к финансированию становится прозрачным</h2><p>Прескор переводит банковскую логику на понятный предпринимателю язык: где риск, что исправить и какой продукт выбрать.</p></div>
        <div className="ru-tabs" role="tablist" aria-label="Возможности Прескор">{analysisTabs.map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab.id === tab.id} className={activeTab.id === tab.id ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab.label}</button>)}</div>
        <div className="ru-analysis-stage">
          <div className="ru-analysis-copy"><span>{activeTab.eyebrow}</span><h3>{activeTab.title}</h3><p>{activeTab.body}</p><ul><li><Check /> Вывод основан на конкретных показателях</li><li><Check /> Видно влияние каждого фактора</li><li><Check /> Результат можно обсудить с экспертом</li></ul><Link href="/login">Открыть личный кабинет <ArrowRight /></Link></div>
          <div className={`ru-analysis-result result-${activeTab.id}`}><small>ПРЕСКОР / РЕЗУЛЬТАТ</small><strong>{activeTab.value}</strong><em>{activeTab.unit}</em><div className="ru-result-scale"><i /><i /><i /><i /><i /></div><span><CircleCheckBig /> {activeTab.note}</span></div>
        </div>
      </section>

      <section className="ru-how" id="how">
        <div className="ru-section-heading light"><span>КАК ЭТО РАБОТАЕТ</span><h2>От выписки до решения — четыре понятных шага</h2><p>Сначала диагностика. Затем исправление рисков. И только после этого — заявка в подходящий банк.</p></div>
        <div className="ru-step-grid">
          <article><b>01</b><UploadCloud /><h3>Загрузите выписку</h3><p>Добавьте файл 1CClientBankExchange в формате .txt. Система определит компанию и счета.</p><span><Check /> Работает в демо</span></article>
          <article><b>02</b><SearchCheck /><h3>Получите анализ</h3><p>Прескор рассчитает обороты, налоговую нагрузку, долговые платежи и другие показатели.</p><span><Check /> Работает в демо</span></article>
          <article><b>03</b><FileSearch /><h3>Исправьте риски</h3><p>Изучите стоп-факторы и персональный план улучшения кредитного профиля.</p><span><Check /> Работает в демо</span></article>
          <article><b>04</b><Banknote /><h3>Выберите предложение</h3><p>Сравните подходящие продукты и передайте заявку партнеру только после своего согласия.</p><span className="coming">Подключаем партнеров</span></article>
        </div>
        <div className="ru-security-note"><LockKeyhole /><span><b>Ваши данные остаются под вашим контролем</b><small>Прескор не передает выписку и результаты анализа банкам без отдельного согласия.</small></span><a href="#security">Подробнее о безопасности <ArrowRight /></a></div>
      </section>

      <section className="ru-calculator" id="calculator">
        <div className="ru-calc-copy"><span className="ru-kicker"><Calculator /> Предварительный расчет</span><h2>Рассчитайте нагрузку до подачи заявки</h2><p>Оцените ежемесячный платеж по оборотному кредиту или примерную стоимость банковской гарантии. Точные условия станут доступны после анализа компании.</p><div><Check /> Расчет не влияет на кредитную историю</div><div><Check /> Не является заявкой в банк</div></div>
        <div className="ru-calc-card">
          <div className="ru-calc-tabs"><button className={product === "loan" ? "active" : ""} onClick={() => setProduct("loan")}>Оборотный кредит</button><button className={product === "guarantee" ? "active" : ""} onClick={() => setProduct("guarantee")}>Банковская гарантия</button></div>
          <label><span>Сумма <b>{rubles(amount)}</b></span><input type="range" min="500000" max="50000000" step="500000" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><small><i>500 тыс. ₽</i><i>50 млн ₽</i></small></label>
          <label><span>Срок <b>{term} мес.</b></span><input type="range" min="3" max="36" step="1" value={term} onChange={(event) => setTerm(Number(event.target.value))} /><small><i>3 мес.</i><i>36 мес.</i></small></label>
          <label className="ru-rate-control"><span>{product === "loan" ? "Доходность / ставка банка" : "Комиссия за год"}<b>{activeRate.toFixed(1).replace(".", ",")}%</b></span><input type="range" min={product === "loan" ? 10 : .5} max={product === "loan" ? 45 : 10} step="0.1" value={activeRate} onChange={(event) => product === "loan" ? setLoanRate(Number(event.target.value)) : setGuaranteeRate(Number(event.target.value))} /><small><i>{product === "loan" ? "10%" : "0,5%"}</i><button type="button" onClick={() => product === "loan" ? setLoanRate(18.9) : setGuaranteeRate(3.2)}>Рекомендованный сценарий: {String(recommendedRate).replace(".", ",")}%</button><i>{product === "loan" ? "45%" : "10%"}</i></small></label>
          <div className="ru-calc-result"><span><small>{product === "loan" ? "Предварительный платёж в месяц" : "Предварительная комиссия"}</small><strong>{rubles(calculation.primary)}</strong></span><em>Расчёт по выбранной клиентом ставке {activeRate.toFixed(1).replace(".", ",")}%</em></div>
          <div className="ru-calc-details"><span><small>{product === "loan" ? "Переплата за срок" : "Стоимость за срок"}</small><b>{rubles(calculation.cost)}</b></span><span><small>{product === "loan" ? "Всего выплат" : "Сумма гарантии + комиссия"}</small><b>{rubles(calculation.total)}</b></span></div>
          <Link className="ru-button ru-button-primary" href="/checkout">Открыть доступ за 6 500 ₽ <ArrowRight /></Link><p>* Расчет ориентировочный, не является офертой, индивидуальным предложением или решением банка.</p>
        </div>
      </section>

      <section className="ru-benefits" id="security">
        <div className="ru-section-heading"><span>ПОЧЕМУ ПРЕСКОР</span><h2>Все, что нужно перед обращением в банк</h2><p>Не обещаем автоматическое одобрение. Даем данные, аргументы и последовательность действий, которые помогают подготовить бизнес к финансированию.</p></div>
        <div className="ru-benefit-grid">{benefits.map(({ icon: Icon, title, text }) => <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="ru-value-pack" id="report">
        <div className="ru-section-heading"><span>ЧТО ВХОДИТ В 6 500 ₽</span><h2>Полный интеллектуальный слой конкретного анализа</h2><p>Prescore Full открывает кредитный смысл уже рассчитанных данных: заключение, БКИ, риски, рекомендации, карту финансирования и выгрузки.</p></div>
        <div className="ru-value-grid">
          <article><b>01</b><Gauge /><h3>Индекс и готовность</h3><p>B-Score, F-Score, L-Score, итоговый индекс 0–1000 и достоверность расчёта.</p></article>
          <article><b>02</b><SearchCheck /><h3>Общее заключение</h3><p>Выписки, БФО, Правовой контур, контракты из официальных реестров и БКИ сводятся в единый вердикт с условиями подачи.</p></article>
          <article><b>03</b><CircleAlert /><h3>Стоп-факторы</h3><p>Критические, исправимые, банковские и продуктовые ограничения с доказательствами.</p></article>
          <article><b>04</b><Calculator /><h3>Расчётный лимит</h3><p>Допустимый ежемесячный платёж, базовый диапазон и стресс-сценарий с объяснением корректировок.</p></article>
          <article><b>05</b><Banknote /><h3>Подходящие продукты</h3><p>Кредитная линия, овердрафт, факторинг, рефинансирование, гарантия — почему подходит и что подтвердить.</p></article>
          <article><b>06</b><Landmark /><h3>Маршрут по банкам</h3><p>Можно рассматривать / после проверки / не обращаться сейчас — причины по каждому банку.</p></article>
          <article><b>07</b><TrendingUp /><h3>План 7 / 30 / 60 дней</h3><p>Конкретные действия, ожидаемый эффект и показатели, которые должны измениться.</p></article>
          <article><b>08</b><FileText /><h3>PDF и Excel</h3><p>Профессиональный отчёт, кредитный портфель и платёжный календарь по выбранной версии анализа.</p></article>
        </div>
        <a className="ru-report-download" href="/files/prescore-sample-report.pdf" target="_blank" rel="noreferrer"><Download /> Скачать пример полного отчёта <ArrowRight /></a>
      </section>

      <section className="ru-pricing" id="pricing">
        <div className="ru-section-heading light"><span>ДВА УРОВНЯ</span><h2>Бесплатно увидеть факты. За 6 500 ₽ понять кредитный смысл.</h2><p>Без третьего тарифа, подписки и скрытого автоматического продления.</p></div>
        <div className="ru-pricing-grid"><div className="ru-price-card"><div className="ru-price-title"><span>PRESCORE FREE</span><b>Финансовая картина бизнеса</b></div><div className="ru-price"><strong>0 ₽</strong><span>бесплатно</span></div><ul><li><Check /> Dashboard по банковской выписке</li><li><Check /> Денежные потоки, контрагенты и концентрация</li><li><Check /> Остатки и риск кассовых разрывов</li><li><Check /> Базовая проверка открытых рисков</li><li><Check /> Заявки на кредит и банковскую гарантию</li><li><Check /> ЕИС-предзаявки</li></ul><Link className="ru-button ru-button-secondary" href="/login">Начать бесплатно <ArrowRight /></Link></div><div className="ru-price-card"><div className="ru-price-title"><span>PRESCORE FULL</span><b>Полный анализ конкретной версии</b></div><div className="ru-price"><strong>6 500 ₽</strong><span>разовая оплата</span><small>Без автоматического продления</small></div><ul><li><Check /> Всё из FREE</li><li><Check /> Prescore Index и готовность к финансированию</li><li><Check /> БФО, квартальная отчётность и НБКИ</li><li><Check /> Полные риски, сильные стороны и сверка источников</li><li><Check /> Рекомендации и план 7 / 30 / 60</li><li><Check /> Умный подбор финансирования</li><li><Check /> PDF, Excel и AI-аналитик</li></ul><Link className="ru-button ru-button-primary" href="/checkout">Получить полный анализ — 6 500 ₽ <ArrowRight /></Link><p>Оплачивается информационно-аналитическая услуга, а не кредит, банковское решение или гарантия одобрения.</p></div></div>
      </section>

      <section className="ru-agents-block" id="agents"><div><span><UsersRound /> ПАРТНЁРСКАЯ ПРОГРАММА</span><h2>Для агентов — отдельный кабинет с CRM и воронкой</h2><p>Приводите клиентов по персональной ссылке, смотрите их аналитические досье, ведите заявки в банки и контролируйте прогноз дохода.</p><ul><li><Check /> 30% от каждого оплаченного FULL — 1 950 ₽</li><li><Check /> Вознаграждение начисляется за каждый новый оплаченный анализ</li><li><Check /> Прогноз по выдачам рассчитывается внутри программы по средней доходности</li></ul><Link href="/agents">Узнать о программе для агентов <ArrowRight /></Link></div><aside><small>ПРИМЕР</small><strong>10 FULL-анализов</strong><span>× 1 950 ₽</span><h3>19 500 ₽</h3><p>партнёрского дохода с оплаченных заказов</p></aside></section>

      <section className="ru-about" id="about">
        <div><span className="ru-kicker">О ПРОЕКТЕ ПРЕСКОР</span><h2>Предприниматель должен понимать решение банка до подачи заявки</h2><p>Прескор создается как независимая аналитическая платформа для МСБ. Мы объединяем финансовые данные, банковскую экспертизу и понятные рекомендации, чтобы бизнес мог осознанно выбирать источники капитала.</p><p>Наша задача — не выдать красивую цифру, а показать причинно-следственную связь: какой показатель мешает финансированию, как он влияет на решение и что можно сделать.</p><div className="ru-about-values"><span><ShieldCheck /><b>Независимость</b><small>Не продвигаем один банк</small></span><span><FileSearch /><b>Объяснимость</b><small>Показываем логику выводов</small></span><span><TrendingUp /><b>Практичность</b><small>Даем план действий</small></span></div></div>
        <aside><small>ПРИМЕР ИНДЕКСА ПРЕСКОР</small><strong>742</strong><span>из 1000 · готовность с оговорками</span><div><i style={{ width: "74.2%" }} /></div><p><SearchCheck /> После исправления двух факторов расчётный диапазон может вырасти, но окончательное решение всегда принимает банк.</p></aside>
      </section>

      <section className="ru-faq" id="faq">
        <div className="ru-section-heading"><span>ВОПРОСЫ И ОТВЕТЫ</span><h2>Коротко о работе сервиса</h2></div>
        <div className="ru-faq-list">
          <details open><summary>Что такое Прескор для бизнеса?<ChevronRight /></summary><p>Это аналитическая платформа, которая помогает увидеть компанию глазами кредитного аналитика: оценивает денежный поток, выявляет риски и формирует рекомендации перед обращением за финансированием.</p></details>
          <details><summary>Прескор гарантирует одобрение кредита?<ChevronRight /></summary><p>Нет. Окончательное решение принимает банк. Прескор помогает заранее найти слабые места, подготовить документы и выбрать более подходящий продукт.</p></details>
          <details><summary>Что именно оплачивается?<ChevronRight /></summary><p>Вы оплачиваете разовое открытие полного результата конкретной версии анализа: индекс, заключение, БФО, правовой контур, БКИ, риски, рекомендации, карту финансирования, PDF и Excel. Кредит или одобрение банка не продаются и не гарантируются.</p></details>
          <details><summary>Можно анализировать несколько компаний?<ChevronRight /></summary><p>FREE позволяет создавать отдельные версии анализа компаний. Prescore Full оплачивается и открывается отдельно для каждой конкретной версии анализа.</p></details>
          <details><summary>Какие данные нужны для анализа?<ChevronRight /></summary><p>Выписки всех банков одной компании в формате 1CClientBankExchange (.txt) и отчёт БКИ с законным основанием. Прескор добавляет БФО, Правовой контур и контракты из подключённых источников. Для уточнения могут понадобиться квартальная отчётность, кредитные договоры и документы по цели финансирования.</p></details>
          <details><summary>Банк увидит загруженную выписку?<ChevronRight /></summary><p>Нет, не увидит. Передача данных финансовому партнеру возможна только после отдельного действия и согласия клиента.</p></details>
          <details><summary>Подойдет ли сервис ИП?<ChevronRight /></summary><p>Да. Прескор рассчитан на ООО и ИП, которые хотят проверить кредитный профиль, понять причины отказа или подготовиться к финансированию.</p></details>
        </div>
      </section>

      <section className="ru-final"><span>FREE 0 ₽ · FULL 6 500 ₽</span><h2>Сначала увидьте финансовую картину.<br />Затем откройте кредитный смысл.</h2><p>Бесплатный dashboard и заявки доступны сразу. Полный анализ открывает заключение, риски, БКИ, продукты и план действий.</p><div className="ru-final-actions"><Link className="ru-button ru-button-primary" href="/login">Начать бесплатно <ArrowRight /></Link><a className="ru-button ru-button-secondary" href="/files/prescore-sample-report.pdf" target="_blank" rel="noreferrer"><Download /> Пример PDF</a></div></section>

      <footer className="ru-footer"><div><Brand light /><p>Платформа предварительной оценки и подготовки бизнеса к финансированию.</p></div><div><b>Меню</b><a href="#advantages">Преимущества</a><a href="#how">Как это работает</a><a href="#report">Состав отчёта</a><a href="#pricing">Тариф</a><Link href="/agents">Агентам</Link></div><div><b>Документы</b><Link href="/privacy">Политика конфиденциальности</Link><Link href="/consent">Согласие на обработку данных</Link><Link href="/offer">Публичная оферта</Link><a href="/files/prescore-sample-report.pdf" target="_blank" rel="noreferrer">Пример отчёта PDF</a></div><div><b>Контакты</b><span>Россия</span><a href="mailto:support@prescore.ru">support@prescore.ru</a></div><small>© 2026 Прескор. Банковские маршруты и расчёты носят информационно-аналитический характер.</small></footer>
    </main>
  );
}
