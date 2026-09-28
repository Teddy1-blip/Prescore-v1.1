import { strFromU8, unzipSync } from "fflate";

type PdfTextItem = { str?: string; width?: number; transform?: number[] };

function pageText(items: PdfTextItem[]) {
  const rows: Array<{ y: number; items: Array<{ x: number; width: number; text: string }> }> = [];
  for (const item of items) {
    if (!item.str) continue;
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

export async function extractPdfText(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pageText(content.items as PdfTextItem[]));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
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
      for (const cell of row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cell[1];
        const body = cell[2];
        const raw = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const value = /\bt=["']s["']/.test(attrs) ? shared[Number(raw)] ?? "" : decodeXml(raw);
        if (value.trim()) cells.push(value.trim());
      }
      if (cells.length) lines.push(cells.join(" "));
    }
  }
  return lines.join("\n");
}

export function extractCsvText(bytes: Uint8Array) {
  const utf = new TextDecoder("utf-8").decode(bytes);
  if (!utf.includes("�")) return utf.replace(/[;\t]/g, " ");
  return new TextDecoder("windows-1251").decode(bytes).replace(/[;\t]/g, " ");
}

export async function extractDocumentText(fileName: string, bytes: Uint8Array) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdfText(bytes);
  if (lower.endsWith(".xlsx")) return extractXlsxText(bytes);
  if (lower.endsWith(".csv")) return extractCsvText(bytes);
  throw new Error("Формат файла не поддерживается.");
}

