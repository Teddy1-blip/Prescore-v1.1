import { strFromU8, unzipSync } from "fflate";

export type PdfTextItem = { str?: string; width?: number; transform?: number[] };

function pageText(items: PdfTextItem[], preserveColumns: boolean) {
  const rows: Array<{ y: number; items: Array<{ x: number; width: number; text: string }> }> = [];
  for (const item of items) {
    if (!item.str || (preserveColumns && !item.str.trim())) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, width: item.width ?? 0, text: item.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    let line = "";
    let right: number | null = null;
    for (const item of row.items) {
      if (right !== null) {
        const gap = item.x - right;
        if (gap > 1) line += " ".repeat(Math.max(1, Math.min(24, Math.round(gap / 3.6))));
      }
      line += item.text;
      right = item.x + item.width;
    }
    return line.trimEnd();
  }).join("\n");
}

export async function mapPdfPages<T>(bytes:Uint8Array,maxPages:number,preserveColumns:boolean,
  visit:(text:string,page:import("pdfjs-dist/types/src/display/api").PDFPageProxy,items:PdfTextItem[])=>Promise<T>) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pages: T[] = [];
  try {
    if (document.numPages > maxPages) throw new Error("PDF_PAGE_LIMIT");
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(await visit(pageText(content.items as PdfTextItem[], preserveColumns),page,content.items as PdfTextItem[]));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pages;
}
export async function extractPdfText(bytes: Uint8Array, maxPages = Number.POSITIVE_INFINITY, preserveColumns = false) {
  const pages=await mapPdfPages(bytes,maxPages,preserveColumns,async text=>text);
  return pages.join("\n\f\n");
}

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}

export function extractXlsxText(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const sharedXml = archive["xl/sharedStrings.xml"] ? strFromU8(archive["xl/sharedStrings.xml"]) : "";
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)]
    .map((match) => decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join("")));
  const sheets = Object.keys(archive).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  if (!sheets.length) throw new Error("В Excel не найдены листы с данными.");
  const lines: string[] = [];
  for (const sheet of sheets) {
    const xml = strFromU8(archive[sheet]);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cell[1];
        const body = cell[2] ?? "";
        const raw = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const value = raw && /\bt=["']s["']/.test(attrs) ? shared[Number(raw)] ?? "" : decodeXml(raw);
        // Excel omits blank cells. Preserve their positions so the comparative
        // year cannot be read as the current one.
        const column = attrs.match(/\br=["']([A-Z]+)\d+["']/i)?.[1]?.toUpperCase();
        const index = column ? Array.from(column).reduce((n,c) => n*26+c.charCodeAt(0)-64,0)-1 : cells.length;
        if (index >= 0 && index < 16384) cells[index] = value.trim();
      }
      if (cells.length) lines.push(cells.join("\t"));
    }
  }
  return lines.join("\n");
}

export function extractCsvText(bytes: Uint8Array) {
  const utf = new TextDecoder("utf-8").decode(bytes);
  const text = utf.includes("�") ? new TextDecoder("windows-1251").decode(bytes) : utf;
  const delimiter = text.includes("\t") ? "\t" : text.includes(";") ? ";"
    : /(?:^|,)"?(?:1600|1700|2110|2400)"?,/m.test(text) ? "," : null;
  if (!delimiter) return text;
  const rows: string[] = [];
  let row = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { row += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === delimiter) row += "\t";
    else if (!quoted && c === "\n") { rows.push(row); row = ""; }
    else row += c;
  }
  if (quoted) throw new Error("Не закрыта кавычка в таблице CSV.");
  return [...rows, row].join("\n");
}

export async function extractDocumentText(fileName: string, bytes: Uint8Array, kind: "financial" | "bureau" = "financial") {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdfText(bytes, Number.POSITIVE_INFINITY, kind === "financial");
  if (lower.endsWith(".xlsx")) return extractXlsxText(bytes);
  if (lower.endsWith(".csv")) return extractCsvText(bytes);
  throw new Error("Формат файла не поддерживается.");
}

