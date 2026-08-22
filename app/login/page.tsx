import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import "../prescore-ui-v1.css";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string; role?: string }> }) {
  const params = await searchParams;
  const requested = params?.returnTo === "/agent" || params?.role === "agent" ? "/agent" : params?.returnTo === "/admin" ? "/admin" : "/dashboard";
  const user = await getChatGPTUser();
  const hasExplicitDestination = Boolean(params?.returnTo || params?.role);
  if (user && hasExplicitDestination) redirect(requested);
  return <main className="login-shell">
    <section className="login-story">
      <Link className="brand brand-light" href="/"><strong>Прескор</strong></Link>
      <div className="login-story-copy"><span className="login-kicker"><ShieldCheck /> КРЕДИТНАЯ АНАЛИТИКА БИЗНЕСА</span><h1>Финансовая позиция компании — до следующего решения.</h1><p>Клиент анализирует бизнес и управляет заявками в банки. Агент ведёт клиентов, воронку и потенциальное вознаграждение.</p><div className="login-proof"><span><Check /> Серверный разбор банковских выписок</span><span><Check /> Объяснимые метрики и стоп‑факторы</span><span><Check /> Раздельные защищённые кабинеты</span></div></div>
      <div className="login-quote"><p>«Цель — не больше кредита. Цель — правильный капитал, по правильной цене и в правильный момент».</p><span>Принцип решений Прескор</span></div>
    </section>
    <section className="login-form-panel">
      <Link className="back-link" href="/"><ArrowLeft /> Вернуться на сайт</Link>
      <div className="login-form">
        <div className="login-icon"><LockKeyhole /></div><span className="login-form-kicker">ЗАЩИЩЁННЫЙ ВХОД</span><h2>Вход в рабочий кабинет</h2><p>Авторизация выполняется через защищённый контур сайта. Демо‑паролей и общих учётных записей нет.</p>
        <div className="login-role">
          <Link className={requested === "/dashboard" ? "active" : ""} href="/dashboard"><UserRound /><span><b>Кабинет клиента</b><small>Анализ, отчёты и заявки</small></span><ArrowRight /></Link>
          <Link className={requested === "/agent" ? "active" : ""} href="/agent"><BriefcaseBusiness /><span><b>Кабинет агента</b><small>CRM, воронка, клиенты и куратор</small></span><ArrowRight /></Link>
          <Link className={requested === "/admin" ? "active admin" : "admin"} href="/admin"><ShieldCheck /><span><b>ЛК администратора</b><small>Модули, показатели, доступы и заявки</small></span><ArrowRight /></Link>
        </div>
        <Link className="button button-primary login-submit" href={user ? requested : chatGPTSignInPath(requested)}>{user ? "Открыть выбранный кабинет" : "Продолжить безопасный вход"} <ArrowRight /></Link>
        {user && <p className="login-session-note"><ShieldCheck /> Вы уже авторизованы. Выберите нужный кабинет выше.</p>}
        <div className="demo-note"><ShieldCheck /><span><b>Доступ изолирован.</b> Данные одного пользователя не выдаются другому кабинету.</span></div>
        <small className="login-legal">Продолжая, вы подтверждаете ознакомление с <Link href="/privacy">Политикой конфиденциальности</Link>. Согласия на обработку данных и получение БКИ запрашиваются отдельно в соответствующих сценариях.</small>
      </div>
    </section>
  </main>;
}
