// Local debug view. A live provider can receive only the built-in synthetic specimen.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { extractDocument } from '../lib/document-poc/extract.ts';
import { configuredVisionProvider } from '../lib/ai/providers/index.ts';
export function syntheticAgreement() {
  const canvas = createCanvas(1050, 360),
    ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.font = '32px DejaVu Sans';
  ['CREDIT AGREEMENT', 'Borrower: Synthetic Example', 'Lender: Synthetic Bank', 'Agreement number: QA-101', 'Agreement date: 2026-01-15', 'Currency: USD', 'Credit amount: 250000', 'Interest rate: 8%'].forEach((line, i) => ctx.fillText(line, 26, 40 + i * 42));
  return canvas.toBuffer('image/png');
}
// Optional offline smoke on an English-language synthetic raster. No training data in the repo.
function localOcr(page, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn('tesseract', ['stdin', 'stdout', '-l', 'eng', '--psm', '6', 'tsv'], {
      signal,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    const chunks = [];
    child.stdout.on('data', b => chunks.push(b));
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.stdin.end(page.bytes);
    child.on('close', code => {
      if (code !== 0) {
        reject(Error('LOCAL_OCR_UNAVAILABLE'));
        return;
      }
      const lines = new Map();
      for (const row of Buffer.concat(chunks).toString().split('\n').slice(1)) {
        const c = row.split('\t');
        if (c[0] !== '5' || !c[11]?.trim()) continue;
        const id = c.slice(1, 5).join('-'),
          entry = lines.get(id) ?? {
            parts: [],
            score: 100
          };
        entry.parts.push(c[11]);
        entry.score = Math.min(entry.score, Number(c[10]));
        lines.set(id, entry);
      }
      resolve(JSON.stringify({
        lines: [...lines.values()].map(l => ({
          text: l.parts.join(' '),
          confidence: l.score < 65 ? 'LOW' : l.score < 85 ? 'MEDIUM' : 'HIGH'
        }))
      }));
    });
  });
}
async function run(args) {
  let bytes,
    options = {};
  if (args.length === 1 && args[0] === '--synthetic-local') {
    bytes = syntheticAgreement();
    options = {
      vision: {
        extractVision: localOcr
      },
      allowVision: true
    };
  } else if (args.length === 1 && args[0] === '--synthetic-live') {
    bytes = syntheticAgreement();
    const vision = configuredVisionProvider();
    if (!vision) throw Error('VISION_NOT_CONFIGURED');
    options = {
      vision,
      allowVision: true
    };
  } else if (args.length === 2 && args[0] === '--file') {
    if ((await fs.stat(args[1])).size > 8 * 1024 * 1024) throw Error('DOCUMENT_SIZE_LIMIT');
    bytes = await fs.readFile(args[1]);
  } else throw Error('Use --file PATH, --synthetic-local, or --synthetic-live');
  const result = await extractDocument(bytes, options);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.validation === 'INVALID' || args[0].startsWith('--synthetic') && result.result?.terms?.credit_amount.value !== 250000) process.exitCode = 1;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) run(process.argv.slice(2)).catch(e => {
  console.error(['VISION_NOT_CONFIGURED', 'DOCUMENT_SIZE_LIMIT', 'DOCUMENT_FORMAT_UNSUPPORTED'].includes(e.message) ? e.message : 'DOCUMENT_POC_FAILED');
  process.exitCode = 1;
});
