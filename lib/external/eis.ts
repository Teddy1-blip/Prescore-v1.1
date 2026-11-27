import { SaxesParser } from 'saxes';
import { inflateRawSync } from 'node:zlib';
import { validateZipBudget } from '../release/archive-limits.ts';
import { boundedBytes } from './provider-http.ts';
import {
  day,
  money,
  officialLink,
  type Party,
  type ProcurementRecord,
  type Receipt,
  type RnpRecord,
} from './records.ts';

// Supported export elements are based on IntegrationTypes and IntegrationKOTypes
// in the public 13.2 schema snapshot, commit 2b5520420db9c2f442022c72926a58cb669e7e22
// of AmaliyaG/portal44_xml. A new schema/document type requires its own acceptance.
const EXPORT = 'http://zakupki.gov.ru/oos/export/1',
  TYPES = 'http://zakupki.gov.ru/oos/types/1',
  KO = 'http://zakupki.gov.ru/oos/KOTypes/1';
const NS = new Set([EXPORT, TYPES, KO, 'http://zakupki.gov.ru/oos/common/1', 'http://zakupki.gov.ru/oos/base/1']);
const MAX_BYTES = 4 * 1024 * 1024,
  MAX_XML = 2 * 1024 * 1024;
type Element = { name: string; ns: string; text: string; children: Element[] };
function invalid(code: string): never {
  throw Error('EIS_' + code);
}
const decode = (b: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(b);
function document(bytes: Uint8Array) {
  if (bytes.length > MAX_XML) invalid('XML_BUDGET');
  const parser = new SaxesParser({ xmlns: true }),
    stack: Element[] = [];
  let root: Element | undefined,
    nodes = 0;
  parser.on('doctype', () => invalid('DOCTYPE'));
  parser.on('processinginstruction', () => invalid('PROCESSING_INSTRUCTION'));
  parser.on('opentag', (tag) => {
    if (++nodes > 40000 || stack.length >= 64 || Object.keys(tag.attributes).length > 48) invalid('XML_BUDGET');
    const e = { name: tag.local, ns: tag.uri, text: '', children: [] };
    if (stack.length) stack.at(-1)!.children.push(e);
    else root = e;
    stack.push(e);
  });
  const characters = (s: string) => {
    if (stack.length) stack.at(-1)!.text += s;
  };
  parser.on('text', characters);
  parser.on('cdata', characters);
  parser.on('closetag', () => {
    stack.pop();
  });
  try {
    parser.write(decode(bytes)).close();
  } catch {
    invalid('INVALID_XML');
  }
  if (!root || root.ns !== EXPORT || root.name !== 'export' || !root.children.length) invalid('EXPORT_TYPE');
  return root.children;
}
function children(n: Element | undefined, key: string) {
  return n?.children.filter((c) => NS.has(c.ns) && c.name === key) ?? [];
}
function field(n: Element | undefined, path: string): Element | undefined {
  for (const key of path.split('/')) {
    const matches = children(n, key);
    if (matches.length > 1) invalid('AMBIGUOUS_FIELD');
    n = matches[0];
  }
  return n;
}
const value = (n: Element | undefined, p: string) => field(n, p)?.text.trim().slice(0, 1500) || null;
const asParty = (n: Element | undefined): Party => ({
  inn: value(n, 'INN'),
  name: value(n, 'shortName') ?? value(n, 'fullName'),
});

function readContract(n: Element, inn: string, receiptId: string): ProcurementRecord {
  const number = value(n, 'regNum');
  if (!number) invalid('RECORD_ID');
  const customer = asParty(field(n, 'customer'));
  const suppliers = [
    ...children(field(n, 'suppliersInfo'), 'supplierInfo').map((s) =>
      asParty(field(s, 'legalEntityRF/EGRULInfo') ?? field(s, 'individualPersonRFIndEntr/EGRIPInfo')),
    ),
    ...children(field(n, 'suppliers'), 'supplier').map((s) =>
      asParty(field(s, 'legalEntityRF') ?? field(s, 'individualPersonRF')),
    ),
  ];
  if (customer.inn !== inn && !suppliers.some((s) => s.inn === inn)) invalid('DOSSIER_IDENTITY');
  const code = value(n, 'currentContractStage');
  const amount = money(
    value(n, 'priceInfo/priceRUR') ??
      (value(n, 'priceInfo/currency/code') === 'RUB' ? value(n, 'priceInfo/price') : null),
  );
  return {
    number,
    law: '44-ФЗ',
    role: customer.inn === inn ? 'CUSTOMER' : 'SUPPLIER',
    customer,
    suppliers,
    amount,
    status: code,
    state:
      code === 'EC'
        ? 'COMPLETED'
        : code === 'ET' || code === 'IN'
          ? 'TERMINATED'
          : code === 'E'
            ? 'ACTIVE'
            : 'UNKNOWN',
    signedAt: day(value(n, 'signDate')),
    executionAt: day(value(n, 'executionPeriod/endDate')),
    subject: value(n, 'contractSubject'),
    receiptId,
    url: officialLink(value(n, 'href'), ['zakupki.gov.ru']),
  };
}
// Offline input is explicitly distinguished from an authoritative current register snapshot.
// An exclusion without its exact identified inclusion must never be attached to a dossier.
export function parseEisRecords(
  files: Uint8Array[],
  ctx: {
    inn: string;
    retrievedAt: string;
    completeCurrentRegister: boolean;
    // The export envelope alone cannot distinguish every RNP register scope.
    rnpRegisterScope?: RnpRecord['law'];
    origin: 'OFFLINE_SAMPLE' | 'OFFICIAL_ARCHIVE';
  },
) {
  if (
    !/^\d{10}(?:\d{2})?$/.test(ctx.inn) ||
    !day(ctx.retrievedAt) ||
    !files.length ||
    files.length > 64 ||
    files.reduce((n, b) => n + b.length, 0) > MAX_BYTES
  )
    invalid('INPUT');
  const receipt = (method: string): Receipt => ({
    id: `eis:${method}:${ctx.inn}:${ctx.retrievedAt}`,
    method,
    provider: 'EIS_DIRECT',
    authority: 'EIS',
    direct: ctx.origin === 'OFFICIAL_ARCHIVE',
    status: 'READY',
    retrievedAt: ctx.retrievedAt,
    informationDate: null,
    total: null,
    visible: 0,
    warnings: ctx.origin === 'OFFLINE_SAMPLE' ? ['OFFLINE_SAMPLE'] : [],
    version: 'PRESCORE-EXTERNAL-2',
  });
  const contracts: ProcurementRecord[] = [],
    rnp: RnpRecord[] = [],
    rr = receipt('rnp:' + (ctx.rnpRegisterScope ?? 'UNKNOWN')),
    cr = receipt('contracts:44');
  const inclusions = new Map<string, { r: RnpRecord; uuid: string; version: string; published: string | null }>();
  const exclusions: Element[] = [];
  for (const n of files.flatMap(document)) {
    if (n.ns !== EXPORT) invalid('DOCUMENT_TYPE');
    if (n.name === 'contract') {
      const contract = readContract(n, ctx.inn, cr.id);
      if (contracts.some((c) => c.number === contract.number)) invalid('AMBIGUOUS_VERSION');
      contracts.push(contract);
      continue;
    }
    if (n.name === 'unfairSupplier2022Exclude') {
      exclusions.push(n);
      continue;
    }
    if (n.name !== 'unfairSupplier2022' && n.name !== 'unfairSupplierIKZ') invalid('DOCUMENT_TYPE');
    const party =
      field(n, 'unfairSupplierInfo/legalEntityRFInfo') ?? field(n, 'unfairSupplierInfo/individualPersonRFInfo');
    if (value(party, 'INN') !== ctx.inn || value(party, 'incorrectINN') === 'true') invalid('DOSSIER_IDENTITY');
    const number = value(n, 'commonInfo/regNumber'),
      uuid = value(n, 'uuid'),
      version = value(n, 'commonInfo/versionNumber');
    if (!number || !uuid || !version || inclusions.has(number)) invalid('RNP_IDENTITY');
    const published = day(value(n, 'commonInfo/publishDT')),
      planned = day(value(n, 'autoExDateInfo/autoExDate'));
    const current =
      ctx.completeCurrentRegister &&
      published &&
      published <= ctx.retrievedAt.slice(0, 10) &&
      planned &&
      planned > ctx.retrievedAt.slice(0, 10);
    const r: RnpRecord = {
      number,
      law: ctx.rnpRegisterScope ?? 'UNKNOWN',
      included: null,
      ended: null,
      published,
      plannedEnd: planned,
      state: current ? 'ACTIVE' : 'UNKNOWN',
      basis: value(n, 'createReasonInfo/createReason'),
      related:
        children(field(n, 'purchaseInfo'), 'purchaseCode')
          .map((x) => x.text.trim())
          .filter(Boolean)
          .join(', ') || null,
      url: null,
      receiptId: rr.id,
    };
    rnp.push(r);
    inclusions.set(number, { r, uuid, version, published });
  }
  for (const e of exclusions) {
    const ref = field(e, 'unfairSupplier2022ForExcludeInfo'),
      item = inclusions.get(value(ref, 'regNumber') ?? ''),
      end = day(value(e, 'commonInfo/excludeDT'));
    if (
      !item ||
      item.uuid !== value(ref, 'uuid') ||
      item.version !== value(ref, 'versionNumber') ||
      !end ||
      end > ctx.retrievedAt.slice(0, 10) ||
      (item.published && end < item.published) ||
      item.r.ended
    )
      invalid('EXCLUSION_UNBOUND');
    item.r.ended = end;
    item.r.state = 'HISTORICAL';
  }
  cr.visible = contracts.length;
  rr.visible = rnp.length;
  return {
    contracts,
    rnp,
    currentRnp: rnp.some((x) => x.state === 'ACTIVE') ? 'RNP_ACTIVE' : 'UNKNOWN',
    receipts: [...(contracts.length ? [cr] : []), ...(rnp.length ? [rr] : [])],
  };
}

export function eisArchiveUrl(url: string) {
  const safe = officialLink(url, ['int44.zakupki.gov.ru', 'int223.zakupki.gov.ru', 'zakupki.gov.ru']);
  if (!safe) invalid('ARCHIVE_HOST');
  return safe;
}
export async function downloadEisArchive(url: string, fetcher: typeof fetch) {
  const target = eisArchiveUrl(url);
  try {
    const response = await fetcher(target, {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    return archiveXml(await boundedBytes(response, MAX_BYTES));
  } catch (e) {
    if (e instanceof Error && ['PROVIDER_SIZE_LIMIT', 'PROVIDER_RESPONSE_FAILED'].includes(e.message)) throw e;
    invalid('ARCHIVE_UNAVAILABLE');
  }
}
function crc32(data: Uint8Array) {
  let crc = -1;
  for (const c of data) {
    crc ^= c;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
export function archiveXml(bytes: Uint8Array) {
  if (bytes.length > MAX_BYTES || bytes.length < 22) invalid('ZIP_BUDGET');
  const budget = validateZipBudget(bytes);
  if (!budget.entries || budget.entries > 64 || budget.uncompressedBytes > MAX_BYTES) invalid('ZIP_BUDGET');
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    end = bytes.length - 22;
  if (d.getUint32(end, true) !== 0x06054b50 || d.getUint16(end + 4, true) || d.getUint16(end + 6, true))
    invalid('ZIP_DIRECTORY');
  let pos = d.getUint32(end + 16, true);
  const central = pos,
    names = new Set<string>(),
    result: Uint8Array[] = [];
  for (let i = 0; i < budget.entries; i++) {
    const compressed = d.getUint32(pos + 20, true),
      size = d.getUint32(pos + 24, true),
      method = d.getUint16(pos + 10, true),
      offset = d.getUint32(pos + 42, true);
    const len = d.getUint16(pos + 28, true),
      name = decode(bytes.subarray(pos + 46, pos + 46 + len)),
      crc = d.getUint32(pos + 16, true);
    if (
      !/^[\w.-]+\.xml$/i.test(name) ||
      names.has(name) ||
      size > MAX_XML ||
      d.getUint16(pos + 8, true) & 1 ||
      ![0, 8].includes(method)
    )
      invalid('ZIP_MEMBER');
    names.add(name);
    if (
      offset + 30 > central ||
      d.getUint32(offset, true) !== 0x04034b50 ||
      d.getUint16(offset + 8, true) !== method ||
      d.getUint16(offset + 6, true) & 1
    )
      invalid('ZIP_MEMBER');
    const nameLen = d.getUint16(offset + 26, true),
      start = offset + 30 + nameLen + d.getUint16(offset + 28, true);
    if (start + compressed > central || decode(bytes.subarray(offset + 30, offset + 30 + nameLen)) !== name)
      invalid('ZIP_MEMBER');
    const data = bytes.subarray(start, start + compressed),
      xml = method === 0 ? data : inflateRawSync(data, { maxOutputLength: Math.max(1, size) });
    if (xml.length !== size || crc32(xml) !== crc) invalid('ZIP_INTEGRITY');
    result.push(xml);
    pos += 46 + len + d.getUint16(pos + 30, true) + d.getUint16(pos + 32, true);
  }
  if (pos !== end) invalid('ZIP_DIRECTORY');
  return result;
}
