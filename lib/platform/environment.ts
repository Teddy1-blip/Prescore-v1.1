/** Offline deployment contract. Never returns secret values or performs I/O. */
export type PlatformEnvironment = Record<string, string | undefined>;
export type EnvironmentIssue = { variable: string; code: string };
export const ENVIRONMENT_CONTRACT_VERSION = 'PRESCORE-STANDALONE-ENV-1';
export const SECRET_VARIABLES = Object.freeze(['DATABASE_URL', 'AUTH_SECRET', 'SMTP_PASSWORD', 'CHECKO_API_KEY', 'DEEPSEEK_API_KEY','TBANK_PASSWORD','TBANK_TERMINAL_KEY','BILLING_FAKE_SECRET']);
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
 const mode=env.PRESCORE_RUNTIME_MODE;const rc=mode==='release-candidate';const rcFake=rc&&env.PRESCORE_ALLOW_RC_FAKE==='true';
 const add = (variable: string, code: string) => issues.push({variable, code});
 try {
  const url = new URL(env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length < 2 || url.hash) throw Error();
  if (/USER|PASSWORD|INTERNAL_HOST/.test(env.DATABASE_URL || '')) throw Error();
 } catch { add('DATABASE_URL', 'DATABASE_URL_INVALID_OR_MISSING'); }
 if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || /REPLACE_WITH/i.test(env.AUTH_SECRET)) add('AUTH_SECRET', 'AUTH_SECRET_INVALID_OR_MISSING');
 try {
  const url = new URL(env.PRESCORE_BASE_URL || '');
  if ((url.protocol !== 'https:' && !(rc&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error();
 } catch { add('PRESCORE_BASE_URL', 'HTTPS_ORIGIN_REQUIRED'); }
 const root = env.PRESCORE_STORAGE_ROOT;
 if (!(root?.startsWith('/data/') || (mode&&root?.startsWith('/')&&!root.startsWith('/app')&&root!=='/')) || root?.split('/').includes('..') || (root&&invalidText(root))) add('PRESCORE_STORAGE_ROOT', 'PERSISTENT_STORAGE_PATH_REQUIRED');
 try { if(!(rcFake&&env.MAIL_PROVIDER==='POSTGRES_FAKE'))smtpConfiguration(env); } catch (e) { add('SMTP', e instanceof Error ? e.message : 'MAIL_CONFIGURATION_INVALID'); }
 if (env.PRESCORE_INTERNAL_REPORT_PREVIEW && !['0', '1'].includes(env.PRESCORE_INTERNAL_REPORT_PREVIEW)) add('PRESCORE_INTERNAL_REPORT_PREVIEW', 'BOOLEAN_FLAG_INVALID');
 if(env.NODE_ENV==='production'&&!mode)add('PRESCORE_RUNTIME_MODE','RUNTIME_MODE_REQUIRED');
 if(mode&&!['development','test','release-candidate','production'].includes(mode))add('PRESCORE_RUNTIME_MODE','RUNTIME_MODE_INVALID');
 if((rc||mode==='production')&&env.NODE_ENV!=='production')add('NODE_ENV','PRODUCTION_RUNTIME_REQUIRED');
 if(env.AUTH_SECRET&&new Set(env.AUTH_SECRET).size<12)add('AUTH_SECRET','AUTH_SECRET_WEAK');
 const payment=env.BILLING_PROVIDER??'DISABLED',payout=env.BILLING_SETTLEMENT_PROVIDER??'DISABLED';
 if(!['DISABLED','FAKE','TBANK'].includes(payment))add('BILLING_PROVIDER','PAYMENT_PROVIDER_INVALID');
 if(!['DISABLED','FAKE'].includes(payout))add('BILLING_SETTLEMENT_PROVIDER','PAYOUT_PROVIDER_NOT_IMPLEMENTED');
 if(mode==='production'&&([payment,payout].includes('FAKE')||env.MAIL_PROVIDER==='POSTGRES_FAKE'))add('PROVIDER','PRODUCTION_FAKE_FORBIDDEN');
 if(rc&&payment==='TBANK')add('BILLING_PROVIDER','RC_EXTERNAL_PROVIDER_FORBIDDEN');
 if(rc&&[payment,payout].includes('FAKE')&&(!rcFake||!env.BILLING_FAKE_SECRET||env.BILLING_FAKE_SECRET.length<32))add('PROVIDER','RC_FAKE_CONFIGURATION_REQUIRED');
 if(payment==='TBANK'&&(!env.TBANK_TERMINAL_KEY||!env.TBANK_PASSWORD||env.BILLING_LIVE_ENABLED!=='true'||env.BILLING_FISCALIZATION_APPROVED!=='true'||env.BILLING_SITE_ORIGIN!==env.PRESCORE_BASE_URL))add('BILLING_PROVIDER','TBANK_CONFIGURATION_INCOMPLETE');
 if(rc&&(env.BILLING_LIVE_ENABLED==='true'||(env.AI_PROVIDER&&!['local','disabled','fake'].includes(env.AI_PROVIDER))||env.CHECKO_API_KEY))add('PROVIDER','RC_EXTERNAL_PROVIDER_FORBIDDEN');
 if(env.PARTNER_SETTLEMENT_MODE&&!['ACCRUAL_ONLY','PAYOUT_API','SPLIT_PAYMENT'].includes(env.PARTNER_SETTLEMENT_MODE))add('PARTNER_SETTLEMENT_MODE','SETTLEMENT_MODE_INVALID');
 if(env.PARTNER_SETTLEMENT_MODE==='SPLIT_PAYMENT'||(env.PARTNER_SETTLEMENT_MODE==='PAYOUT_API'&&payout==='DISABLED'))add('PARTNER_SETTLEMENT_MODE','PAYOUT_CONFIGURATION_MISSING');
 return issues;
}
