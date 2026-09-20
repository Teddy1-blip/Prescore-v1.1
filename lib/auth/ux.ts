import {safeReturnPath} from './contracts.ts';

export const REMEMBERED_EMAIL_KEY = 'prescore.auth.rememberedEmail';
export const RESEND_NOTICE = 'Если аккаунт существует и требует подтверждения, письмо отправлено.';
export const RESET_NOTICE = 'Если адрес зарегистрирован, письмо с дальнейшими действиями будет отправлено.';
export type AuthFailure = {code?: string; status?: number};
export function authErrorMessage(error?: AuthFailure | null) {
 if (error?.status === 429 || error?.code === 'TOO_MANY_REQUESTS') return 'Слишком много попыток. Подождите минуту и повторите.';
 if (error?.code === 'EMAIL_NOT_VERIFIED') return 'Подтвердите электронную почту, чтобы войти.';
 if (error?.code === 'INVALID_EMAIL_OR_PASSWORD' || error?.code === 'INVALID_PASSWORD') return 'Неверная почта или пароль.';
 if (error?.code === 'PASSWORD_TOO_SHORT') return 'Пароль должен содержать не менее 12 символов.';
 if (error?.code === 'PASSWORD_TOO_LONG') return 'Пароль слишком длинный.';
 if (error?.code === 'INVALID_TOKEN' || error?.code === 'TOKEN_EXPIRED') return 'Ссылка недействительна или срок её действия истёк. Запросите новое письмо.';
 return 'Сервис временно недоступен. Повторите попытку позже.';
}
// The callback is always our login page; only its destination can be supplied.
export function verificationReturnPath(returnTo: string) {
 return '/login?verified=1&returnTo=' + encodeURIComponent(safeReturnPath(returnTo));
}
export function readRememberedEmail(): string {
 try { return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch { return ''; }
}
export function rememberEmail(email: string, enabled: boolean) {
 try {
  if (enabled) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
  else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
 } catch { /* Storage can be blocked; authentication must still work. */ }
}
