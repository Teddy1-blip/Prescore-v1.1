import { createHash } from 'node:crypto';
import { mapPdfPages } from '../credit-engine/server/document-extraction.ts';
import type { VisionPage, VisionProvider } from '../ai/providers/index.ts';
import { financialStatement } from './financial.ts';
import { creditAgreement } from './agreement.ts';
import { EXTRACTOR_VERSION, issue, validation, type Line, type Input } from './fields.ts';
const MB = 1024 * 1024;
type PageInfo = {
  page: number;
  method: 'TEXT' | 'VISION' | 'MIXED' | 'UNREADABLE';
};
export type ExtractionOptions = {
  vision?: VisionProvider;
  allowVision?: boolean;
  timeoutMs?: number;
};
function transcript(raw: string, page: number): Line[] {
  if (raw.length > 65000) throw Error('VISION_SCHEMA_INVALID');
  const data = JSON.parse(raw);
  if (!data || Object.keys(data).length !== 1 || !Array.isArray(data.lines) || data.lines.length > 500) throw Error('VISION_SCHEMA_INVALID');
  return data.lines.map((line: unknown) => {
    if (!line || typeof line !== 'object' || !('text' in line) || typeof line.text !== 'string' || line.text.length > 800 || !('confidence' in line) || !['HIGH', 'MEDIUM', 'LOW'].includes(String(line.confidence)) || Object.keys(line).length !== 2) throw Error('VISION_SCHEMA_INVALID');
    return {
      text: line.text.trim(),
      confidence: line.confidence,
      page
    } as Line;
  });
}
function classify(lines: Line[]) {
  const text = lines.map(l => l.text).join('\n');
  const financial = /бухгалтерский баланс|отч[её]т о финансовых результатах|balance sheet|income statement/i.test(text);
  const agreement = /кредитный договор|договор кредитной линии|credit agreement|loan agreement/i.test(text);
  return financial === agreement ? 'UNKNOWN' : financial ? 'FINANCIAL_STATEMENT' : 'CREDIT_AGREEMENT';
}
export async function extractDocument(bytes: Uint8Array, options: ExtractionOptions = {}) {
  if (!bytes.length || bytes.length > 8 * MB) throw Error('DOCUMENT_SIZE_LIMIT');
  const input: Input = {
    id: createHash('sha256').update(bytes).digest('hex'),
    lines: [],
    issues: []
  };
  const pages: PageInfo[] = [];
  async function readImage(image: () => Promise<VisionPage>, page: number) {
    if (!options.allowVision || !options.vision) {
      issue(input, 'REVIEW', 'VISION_NOT_ENABLED', page);
      return [];
    }
    const timeoutMs = options.timeoutMs ?? 25000;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const payload = await image();
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Error('VISION_TIMEOUT'));
        }, timeoutMs);
      });
      const raw = await Promise.race([options.vision.extractVision(payload, controller.signal), deadline]);
      try {
        return transcript(raw, page);
      } catch {
        issue(input, 'INVALID', 'VISION_SCHEMA_INVALID', page);
        return [];
      }
    } catch {
      issue(input, 'REVIEW', controller.signal.aborted ? 'VISION_TIMEOUT' : 'VISION_PROVIDER_FAILED', page);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
  if (Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-') {
    await mapPdfPages(new Uint8Array(bytes), 12, true, async (text, page) => {
      const source = text.split('\n').filter(s => s.trim()).map(s => ({
        text: s.trim(),
        confidence: 'HIGH' as const,
        page: page.pageNumber
      }));
      const clean = text.replace(/\s/g, '');
      const poor = /[\uFFFD\u0000]/.test(clean);
      const usable = poor ? source.filter(l => !/[\uFFFD\u0000]/.test(l.text)) : source;
      // A sparse text header can sit above a scanned table on the same page.
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const ops = await page.getOperatorList();
      const imageOps = [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageXObjectRepeat];
      const hasRaster = ops.fnArray.some((op: number) => imageOps.includes(op));
      const largeRaster = ops.fnArray.some((op: number, i: number) => {
        if (!imageOps.includes(op)) return false;
        const args = ops.argsArray[i];
        const width = args[0]?.width ?? args[1],
          height = args[0]?.height ?? args[2];
        return Number(width) * Number(height) > 50000;
      });
      const hasColumnsOrTerms = usable.some(l => /[|\t]|(?:1600|1700|2110)\s{2,}|(?:кредитор|за[её]мщик|credit limit|borrower)\s*:/i.test(l.text));
      const needsOcr = poor || hasRaster && usable.length === 0 || largeRaster && !hasColumnsOrTerms;
      if (!needsOcr && !usable.length) {
        issue(input, 'REVIEW', 'PAGE_WITHOUT_READABLE_CONTENT', page.pageNumber);
        pages.push({
          page: page.pageNumber,
          method: 'UNREADABLE'
        });
        return;
      }
      input.lines.push(...usable);
      if (!needsOcr) {
        pages.push({
          page: page.pageNumber,
          method: 'TEXT'
        });
        return;
      }
      const scanned = await readImage(async () => {
        const base = page.getViewport({
          scale: 1
        });
        const viewport = page.getViewport({
          scale: Math.min(2, 2200 / Math.max(base.width, base.height))
        });
        const {
          createCanvas
        } = await import('@napi-rs/canvas');
        const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport
        }).promise;
        return {
          mime: 'image/png',
          bytes: canvas.toBuffer('image/png')
        };
      }, page.pageNumber);
      const known = new Set(usable.map(l => l.text.replace(/\s+/g, ' ')));
      input.lines.push(...scanned.filter(l => !known.has(l.text.replace(/\s+/g, ' '))));
      pages.push({
        page: page.pageNumber,
        method: scanned.length ? usable.length ? 'MIXED' : 'VISION' : usable.length ? 'TEXT' : 'UNREADABLE'
      });
    });
  } else {
    const png = Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!png && !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) throw Error('DOCUMENT_FORMAT_UNSUPPORTED');
    const lines = await readImage(async () => ({
      mime: png ? 'image/png' : 'image/jpeg',
      bytes
    }), 1);
    input.lines.push(...lines);
    pages.push({
      page: 1,
      method: lines.length ? 'VISION' : 'UNREADABLE'
    });
  }
  for (const line of input.lines) if (line.confidence === 'LOW' || /[?�□]/.test(line.text)) {
    line.confidence = 'LOW';
    issue(input, 'REVIEW', 'LOW_CONFIDENCE_LINE', line.page);
  }
  const kind = classify(input.lines);
  const result = kind === 'FINANCIAL_STATEMENT' ? financialStatement(input) : kind === 'CREDIT_AGREEMENT' ? creditAgreement(input) : null;
  if (!result) issue(input, 'REVIEW', 'DOCUMENT_TYPE_UNKNOWN');
  // Required format and confidence checks also cover fields inside rows and covenants.
  function checkFields(obj: unknown) {
    if (!obj || typeof obj !== 'object') return;
    if ('extractor_version' in obj && 'status' in obj) {
      if (obj.status === 'REVIEW') issue(input, 'REVIEW', 'FIELD_REQUIRES_REVIEW', 'source_page' in obj && typeof obj.source_page === 'number' ? obj.source_page : undefined);
      return;
    }
    Object.values(obj).forEach(checkFields);
  }
  checkFields(result);
  const issues = input.issues.filter((v, i, all) => all.findIndex(j => j.code === v.code && j.page === v.page) === i);
  return {
    document_id: input.id,
    extractor_version: EXTRACTOR_VERSION,
    classification: kind,
    pages,
    validation: validation(issues),
    issues,
    result
  };
}
