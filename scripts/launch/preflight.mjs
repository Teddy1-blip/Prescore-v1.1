/** Read-only production launch diagnostic. No secrets logged, no remote calls/writes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function assess({env={},offer='',privacy='',consent='',plan='',mode='preview'}={}) {
  const blockers=[];
  const add=(code,detail)=>blockers.push({code,detail});
  if (!plan.includes("code:'PRESCORE_COMPANY_30D'") || !plan.includes('durationDays:30') || !plan.includes('amountMinor:650000')) add('PLAN_UNVERIFIED','Plan 6500 RUB / 30 days not matched');
  // Live contract must describe the same subscription term as the executable billing domain.
  if (/Услуга не является подпиской|разовая услуга|разовую услугу|не является подпиской|6 500 ₽ за одну конкретную версию/i.test(offer)) add('OFFER_CONTRADICTS_SUBSCRIPTION','Public offer describes one-off analysis, while billing sells 30-day access');
  if (/разовой услуги|разовую услугу|разовой услуге/i.test(privacy+'\n'+consent)) add('PRIVACY_CONSENT_LEGACY','Privacy or consent pages describe the legacy one-off service');
  if(!offer.trim()||!privacy.trim()||!consent.trim())add('LEGAL_PAGES_MISSING','Offer, privacy and consent pages are required');
  if(mode==='live') {
    if(env.PRESCORE_BASE_URL !== 'https://app.prescore.ru') add('APP_ORIGIN_MISMATCH','PRESCORE_BASE_URL must use the verified app domain');
    if(env.BILLING_SITE_ORIGIN !== 'https://app.prescore.ru') add('BILLING_ORIGIN_MISMATCH','Billing callback origin must match app origin');
    if(env.NEXT_PUBLIC_PRESCORE_APP_ORIGIN !== 'https://app.prescore.ru') add('PUBLIC_APP_LINK_MISMATCH','Public CTAs must lead to the app origin');
    if(env.BILLING_PROVIDER!=='TBANK'||env.BILLING_LIVE_ENABLED!=='true')add('ACQUIRING_NOT_LIVE','Real T-Bank acquiring not configured');
    for(const key of ['TBANK_TERMINAL_KEY','TBANK_PASSWORD','DATABASE_URL','AUTH_SECRET','SMTP_HOST','SMTP_FROM','BILLING_OFFER_VERSION','BILLING_PRIVACY_VERSION'])if(!env[key])add('MISSING_'+key,'Required secret or setting not present (value not inspected)');
    if(env.BILLING_FISCALIZATION_APPROVED!=='true')add('FISCALIZATION_NOT_APPROVED','Cash register / fiscal receipts not approved');
    if(env.PARTNER_SETTLEMENT_MODE!=='ACCRUAL_ONLY'&&env.BILLING_SETTLEMENT_PROVIDER!=='DISABLED')add('PAYOUTS_REQUIRE_SEPARATE_APPROVAL','Live partner payouts require separate verified agreement');
    if(env.PRESCORE_LAUNCH_LEGAL_OWNER_APPROVED!=='true')add('LEGAL_REVIEW_NOT_CONFIRMED','Owner/legal approval of live offer and merchant required');
  }
  return {mode,ready:blockers.length===0,blockers};
}
export function assessDirectory(root,env=process.env,mode='preview') {
  const read=(p)=>{try{return fs.readFileSync(path.join(root,p),'utf8')}catch{return ''}};
  return assess({env,mode,offer:read('app/offer/page.tsx'),privacy:read('app/privacy/page.tsx'),consent:read('app/consent/page.tsx'),plan:read('lib/billing/domain.ts')});
}
const invoked=process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]);
if(invoked){const root=process.argv[2]??process.cwd(),mode=process.argv.includes('--live')?'live':'preview';const r=assessDirectory(root,process.env,mode);console.log(JSON.stringify(r,null,2));process.exitCode=r.ready?0:2;}
