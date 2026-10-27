import {createHash, randomUUID} from 'node:crypto';
import {extractPdfText} from './credit-engine/server/document-extraction';
import {normalizeLifecycle} from './credit-engine/risk/adapters/legal';
import {freshness, validDate, RISK_SOURCE_FRESHNESS_DAYS} from './credit-engine/risk/common';
import {LEGAL_REGISTRY_VERSION, type LegalRegistryReceipt} from './legal-registry';

export const LEGAL_PDF_MAX_BYTES = 8 * 1024 * 1024;
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export class LegalIntakeError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
export function officialExtractUrl(raw: string): string {
  // This allowlist is deliberately not configurable. In particular, FNS-hosted
  // user attachments, test hosts, redirects and arbitrary URLs are NOT trusted.
  if (!/^https:\/\/egrul\.nalog\.ru\/vyp-download\/[a-fA-F0-9]{32,512}$/.test(raw)) throw new LegalIntakeError('OFFICIAL_DOWNLOAD_URL_REQUIRED');
  return raw;
}
async function officialBytes(url: string): Promise<Uint8Array> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {redirect: 'error', cache: 'no-store', signal: controller.signal, headers: {Accept: 'application/pdf'}});
    if (!response.ok || response.redirected || response.url !== url || !response.body) throw new Error('UNAVAILABLE');
    if (Number(response.headers.get('content-length')) > LEGAL_PDF_MAX_BYTES) throw new Error('TOO_LARGE');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.length; if (size > LEGAL_PDF_MAX_BYTES) throw new Error('TOO_LARGE');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return Buffer.concat(chunks);
  } finally { clearTimeout(timer); }
}
function isoDate(raw: string) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw), value = m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  return validDate(value) ? value : null;
}
export function parseRegistryText(text: string, companyInn: string) {
  const normalized = text.normalize('NFKC').replace(/\u00a0/g, ' ');
  if (!/ВЫПИСКА/i.test(normalized) || !/из Единого государственного реестра юридических лиц/i.test(normalized.replace(/\s+/g, ' '))) throw new LegalIntakeError('EGRUL_FORMAT_UNSUPPORTED');
  // Do not pick an arbitrary matching INN elsewhere in the document (e.g. a founder).
  const inns = [...new Set([...normalized.matchAll(/(?<![\p{L}\d])ИНН\s*[:№]?\s*(\d{10})(?!\d)/gu)].map(m => m[1]))];
  if (inns.length !== 1 || inns[0] !== companyInn) throw new LegalIntakeError('LEGAL_COMPANY_IDENTITY_MISMATCH');
  const dates = [...new Set([...normalized.matchAll(/(?:по состоянию на|сведения по состоянию на)\s*(\d{2}\.\d{2}\.\d{4})/giu)].map(m => isoDate(m[1])))];
  const informationDate = dates.length === 1 ? dates[0] : null;
  // Only a labelled, explicit status. Absence of termination is never ACTIVE.
  const statuses = [...normalized.matchAll(/(?:Состояние юридического лица|Статус юридического лица)\s*[:\n]\s*([^\n\r]+)/giu)].map(m => normalizeLifecycle(m[1]));
  const lifecycle = statuses.length === 1 && !['UNKNOWN','OTHER'].includes(statuses[0]) ? statuses[0] : null;
  return {informationDate, lifecycle};
}
export async function verifyLegalSource(bytes: Uint8Array, companyInn: string, rawUrl: string, receivedAt = new Date().toISOString()): Promise<LegalRegistryReceipt> {
  if (!bytes.length || bytes.length > LEGAL_PDF_MAX_BYTES) throw new LegalIntakeError('LEGAL_FILE_SIZE_INVALID', 413);
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') throw new LegalIntakeError('LEGAL_PDF_INVALID', 415);
  const contentHash = digest(bytes);
  let text: string;
  try { text = await extractPdfText(bytes.slice(), 100); } catch { throw new LegalIntakeError('LEGAL_PDF_INVALID'); }
  const parsed = parseRegistryText(text, companyInn), reasons: string[] = [];
  let origin: LegalRegistryReceipt['origin'] = 'UNCONFIRMED', officialHost: LegalRegistryReceipt['officialHost'] = null, locatorHash: string | null = null;
  if (!rawUrl) reasons.push('ORIGIN_NOT_CONFIRMED');
  else {
    const url = officialExtractUrl(rawUrl); officialHost = 'egrul.nalog.ru'; locatorHash = digest(url);
    let independent: Uint8Array | null = null;
    try { independent = await officialBytes(url); } catch { reasons.push('OFFICIAL_SOURCE_UNAVAILABLE'); }
    if (independent) {
      if (digest(independent) !== contentHash) throw new LegalIntakeError('OFFICIAL_CONTENT_HASH_MISMATCH');
      origin = 'CONFIRMED';
    }
  }
  // FNS dates are calendar dates in Moscow. Receipt remains a UTC instant.
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(receivedAt));
  if (!parsed.informationDate) reasons.push('INFORMATION_DATE_UNCONFIRMED');
  else if (parsed.informationDate > today) reasons.push('INFORMATION_DATE_FUTURE');
  else if (!freshness(parsed.informationDate, today, RISK_SOURCE_FRESHNESS_DAYS.legal)) reasons.push('INFORMATION_DATE_STALE');
  if (!parsed.lifecycle) reasons.push('LIFECYCLE_NOT_EXPLICIT_OR_AMBIGUOUS');
  return {id:`official-registry:${randomUUID()}`, companyInn, contentHash, ...parsed, receivedAt, checkedAt:new Date().toISOString(), verifier:LEGAL_REGISTRY_VERSION,
    method:'INDEPENDENT_OFFICIAL_RETRIEVAL', signatureChecked:false, origin, officialHost, locatorHash,
    eligible:origin === 'CONFIRMED' && reasons.length === 0, reasons, replacesSourceId:null};
}
