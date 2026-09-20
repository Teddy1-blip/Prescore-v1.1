/** Offline deployment contract. Never returns secret values or performs I/O. */
export type PlatformEnvironment = Record<string, string | undefined>;
export type EnvironmentIssue = { variable: string; code: string };
export const ENVIRONMENT_CONTRACT_VERSION = 'PRESCORE-STANDALONE-ENV-1';
export const SECRET_VARIABLES = Object.freeze(['DATABASE_URL', 'AUTH_SECRET', 'SMTP_PASSWORD', 'CHECKO_API_KEY', 'DEEPSEEK_API_KEY']);
const invalidText = (s: string) => /[\r\n\0]/.test(s);

export function smtpConfiguration(env: PlatformEnvironment) {
 const host = env.SMTP_HOST?.trim(), from = env.SMTP_FROM?.trim();
 if (!host || !from) throw Error('MAIL_CONFIGURATION_MISSING');
 if (invalidText(host) || /[\s/@]/.test(host) || invalidText(from) || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw Error('MAIL_ADDRESS_INVALID');
 if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw Error('MAIL_TLS_INVALID');
 const secure = env.SMTP_SECURE !== 'false';
 const port = Number(env.SMTP_PORT || (secure ? 465 : 587));
 if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('MAIL_PORT_INVALID');
 if ((port === 465 && !secure) || (port === 587 && secure)) throw Error('MAIL_TLS_PORT_MISMATCH');
 const user = env.SMTP_USER?.trim(), pass = env.SMTP_PASSWORD;
 if (Boolean(user) !== Boolean(pass)) throw Error('MAIL_AUTH_INCOMPLETE');
 if (user && invalidText(user)) throw Error('MAIL_AUTH_INVALID');
 return { from, transport: {
  host, port, secure, requireTLS: !secure,
  ...(user && pass ? {auth: {user, pass}} : {}),
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  tls: {rejectUnauthorized: true}, logger: false as const, debug: false,
  disableFileAccess: true, disableUrlAccess: true,
 }};
}

export function validateEnvironment(env: PlatformEnvironment): EnvironmentIssue[] {
 const issues: EnvironmentIssue[] = [];
 const add = (variable: string, code: string) => issues.push({variable, code});
 try {
  const url = new URL(env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length < 2 || url.hash) throw Error();
  if (/USER|PASSWORD|INTERNAL_HOST/.test(env.DATABASE_URL || '')) throw Error();
 } catch { add('DATABASE_URL', 'DATABASE_URL_INVALID_OR_MISSING'); }
 if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || /REPLACE_WITH/i.test(env.AUTH_SECRET)) add('AUTH_SECRET', 'AUTH_SECRET_INVALID_OR_MISSING');
 try {
  const url = new URL(env.PRESCORE_BASE_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error();
 } catch { add('PRESCORE_BASE_URL', 'HTTPS_ORIGIN_REQUIRED'); }
 const root = env.PRESCORE_STORAGE_ROOT;
 if (!root?.startsWith('/data/') || root.split('/').includes('..') || invalidText(root)) add('PRESCORE_STORAGE_ROOT', 'PERSISTENT_STORAGE_PATH_REQUIRED');
 try { smtpConfiguration(env); } catch (e) { add('SMTP', e instanceof Error ? e.message : 'MAIL_CONFIGURATION_INVALID'); }
 if (env.PRESCORE_INTERNAL_REPORT_PREVIEW && !['0', '1'].includes(env.PRESCORE_INTERNAL_REPORT_PREVIEW)) add('PRESCORE_INTERNAL_REPORT_PREVIEW', 'BOOLEAN_FLAG_INVALID');
 return issues;
}
