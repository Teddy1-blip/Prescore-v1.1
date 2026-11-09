import type { PdfTextItem } from '../credit-engine/server/document-extraction.ts';
import { numeric, type Line } from './fields.ts';
type Token = {
  s: string;
  x: number;
  y: number;
  w: number;
  h: number;
  assembled?: boolean;
  source?: string;
};
type Column = {
  start: Token;
  center: number;
  heading: string;
};
export type PdfCell = {
  raw: string;
  source?: string;
  uncertain: boolean;
  assembled: boolean;
};
export type PdfFinancialRow = {
  line: Line;
  code: string;
  cells: PdfCell[];
  headings: string[];
};
function columnsAt(items: Token[], header: Token): Column[] {
  const band = items.filter(t => t.x > header.x + header.w / 2 + 2 && Math.abs(t.y - header.y) < header.h * 1.9);
  const markers = band.filter(t => /^(?:на|за|current|previous)(?:\s|$)/i.test(t.s)).sort((a, b) => a.x - b.x);
  if (markers.length < 2 || markers.length > 3) return [];
  const cols = markers.map((start, i) => {
    const next = markers[i + 1];
    const same = band.filter(t => t.x >= start.x && (!next || t.x < next.x) && Math.abs(t.y - start.y) < 1.6 && t.h >= start.h * 0.8).sort((a, b) => a.x - b.x);
    let end = start.x + start.w;
    for (const t of same) {
      if (t.x - end > start.h * 1.3) break;
      end = Math.max(end, t.x + t.w);
    }
    return {
      start,
      center: (start.x + end) / 2,
      heading: ''
    };
  });
  if (cols.some((c, i) => i && c.center - cols[i - 1].center < header.h * 3)) return [];
  for (let i = 0; i < cols.length; i++) {
    const left = i ? (cols[i - 1].center + cols[i].center) / 2 : header.x + header.w;
    const right = i + 1 < cols.length ? (cols[i].center + cols[i + 1].center) / 2 : Infinity;
    const fragments = band.filter(t => t.x + t.w / 2 > left && t.x + t.w / 2 < right && t.y <= cols[i].start.y + 1.6 && t.h >= cols[i].start.h * 0.76 && !/^\d$/.test(t.s));
    cols[i].heading = fragments.sort((a, b) => Math.abs(a.y - b.y) < 1.6 ? a.x - b.x : b.y - a.y).map(t => t.s).join(' ');
  }
  return cols;
}
function decodeCell(tokens: Token[], left: number, right: number, y: number): PdfCell {
  const raw = tokens.map(t => t.s).join(' ');
  if (!tokens.length) return {
    raw: '',
    uncertain: false,
    assembled: false
  };
  if (tokens.some(t => t.x < left - 1 || t.x + t.w > right + 1 || Math.abs(t.y - y) > Math.max(4, t.h * .55))) return {
    raw,
    uncertain: true,
    assembled: false
  };
  if (tokens.length === 1) return {
    raw,
    source: tokens[0].source,
    uncertain: false,
    assembled: !!tokens[0].assembled
  };
  // Fixed-width digit boxes must form one contiguous run with a regular pitch.
  // Mixed groups are accepted only with the usual three-digit thousands grouping.
  const digits = tokens.every(t => /^\d$/.test(t.s));
  if (digits) {
    const pitch = tokens[1].x - tokens[0].x;
    const regular = tokens.length >= 3 && pitch >= tokens[0].w * .75 && pitch <= tokens[0].h * 2 && tokens.slice(1).every((t, i) => Math.abs(t.x - tokens[i].x - pitch) <= Math.max(1, pitch * .15));
    return {
      raw: regular ? tokens.map(t => t.s).join('') : raw,
      source: raw,
      uncertain: !regular,
      assembled: true
    };
  }
  const coherent = tokens.slice(1).every((t, i) => t.x - tokens[i].x - tokens[i].w <= Math.max(3, t.h * .75));
  return {
    raw,
    uncertain: !coherent || numeric(raw) === null,
    assembled: true
  };
}
// Accounting forms can put brackets at the cell's margins, sometimes as one ') (' text item.
// Attach a matched pair to its numeric payload before assigning any column. A pair spanning
// two independent numbers or an incomplete pair remains unreadable.
function accountingTokens(tokens: Token[], cols: Column[]): Token[] {
  const parts = tokens.flatMap(t => {
    if (!/^[()\s]+$/.test(t.s)) return [t];
    return [...t.s].flatMap((s, i) => s.trim() ? [{
      ...t,
      s,
      x: t.x + t.w * i / t.s.length,
      w: t.w / t.s.length
    }] : []);
  }).sort((a, b) => a.x - b.x);
  const result: Token[] = [];
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i];
    if (t.s !== '(') {
      result.push(t);
      continue;
    }
    const close = parts.findIndex((p, k) => k > i && (p.s === '(' || p.s === ')'));
    if (close < 0 || parts[close].s !== ')') {
      result.push(t);
      continue;
    }
    const body = parts.slice(i + 1, close);
    const center = body.length ? (body[0].x + body.at(-1)!.x + body.at(-1)!.w) / 2 : (t.x + parts[close].x) / 2;
    const inner = decodeCell(body, t.x, parts[close].x + t.h, t.y);
    const spansColumns = cols.filter(c => c.center >= t.x && c.center <= parts[close].x).length > 1;
    result.push({
      ...t,
      x: center - .5,
      w: 1,
      assembled: true,
      source: parts.slice(i, close + 1).map(p => p.s).join(' '),
      s: inner.uncertain || spansColumns ? '?' : '(' + inner.raw + ')'
    });
    i = close;
  }
  return result;
}
export function financialTableRows(source: PdfTextItem[], page: number): PdfFinancialRow[] {
  const items: Token[] = source.flatMap(i => i.str?.trim() && i.transform ? [{
    s: i.str.trim(),
    x: i.transform[4],
    y: i.transform[5],
    h: Math.max(1, Math.abs(i.transform[3])),
    w: i.width ?? 0
  }] : []);
  const headers = items.filter(t => /^(код(?: строки)?|line code)$/i.test(t.s)).sort((a, b) => b.y - a.y);
  const output: PdfFinancialRow[] = [];
  for (const [h, header] of headers.entries()) {
    const cols = columnsAt(items, header);
    if (!cols.length) continue;
    const codeCenter = header.x + header.w / 2;
    const codes = items.filter(t => t.y < header.y - header.h * .6 && (!headers[h + 1] || t.y > headers[h + 1].y) && /^[12]\d{3}$/.test(t.s) && Math.abs(t.x + t.w / 2 - codeCenter) < header.h * .95);
    for (const code of codes) {
      const rowBand = items.filter(t => Math.abs(t.y - code.y) <= Math.max(4, code.h * .55));
      // A nearby line number or a note outside the code column cannot anchor a row.
      const label = rowBand.filter(t => t.x + t.w < code.x && /[А-Яа-яA-Za-z]/.test(t.s)).sort((a, b) => a.x - b.x).map(t => t.s).join(' ');
      const dataTokens = rowBand.filter(t => t.x > code.x + code.w);
      const overlap = dataTokens.some(t => codes.some(c => c !== code && Math.abs(t.y - c.y) <= Math.max(4, c.h * .55)));
      const numericTokens = accountingTokens(dataTokens, cols);
      const cells = cols.map((col, i) => {
        const left = i ? (cols[i - 1].center + col.center) / 2 : code.x + code.w + 1;
        const right = i + 1 < cols.length ? (col.center + cols[i + 1].center) / 2 : col.center + (col.center - cols[i - 1].center) / 2;
        const tokens = numericTokens.filter(t => t.x + t.w / 2 > left && t.x + t.w / 2 < right).sort((a, b) => a.x - b.x);
        const result = decodeCell(tokens, left, right, code.y);
        if (overlap) result.uncertain = true;
        return result;
      });
      if (!label && cells.every(c => !c.raw)) continue;
      output.push({
        line: {
          page,
          pdf: true,
          confidence: 'HIGH',
          text: [label, code.s, ...cells.map(c => c.source ?? c.raw)].join(' | ')
        },
        code: code.s,
        cells,
        headings: cols.map(c => c.heading)
      });
    }
  }
  return output;
}
