import {strFromU8, unzipSync} from 'fflate';
import {SaxesParser} from 'saxes';
import {validateZipBudget} from '../release/archive-limits.ts';
import type {EvidencePage} from './document-routing.ts';

const wordNamespaces = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
]);

// Word processing files have no stable rendered page number. Retain paragraph anchors.
export function wordParagraphs(bytes: Uint8Array): EvidencePage[] {
  validateZipBudget(bytes);
  const name = 'word/document.xml';
  const xml = unzipSync(bytes, {filter: entry => entry.name === name})[name];
  if (!xml) throw Error('DOCX_DOCUMENT_MISSING');
  const parser = new SaxesParser({xmlns: true});
  const paragraphs: EvidencePage[] = [];
  let value = '', inText = false, omitted = 0, number = 0;
  parser.on('doctype', () => {throw Error('DOCX_UNEXPECTED_DTD');});
  parser.on('opentag', tag => {
    if (!wordNamespaces.has(tag.uri)) return;
    if (tag.local === 'del' || tag.local === 'moveFrom') omitted++;
    if (omitted) return;
    if (tag.local === 'p') {
      if (++number > 5000) throw Error('DOCX_PARAGRAPH_LIMIT');
      value = '';
    } else if (tag.local === 't') inText = true;
    else if (tag.local === 'tab' || tag.local === 'br') value += ' ';
  });
  parser.on('text', text => {if (inText && !omitted) value += text;});
  parser.on('closetag', tag => {
    if (!wordNamespaces.has(tag.uri)) return;
    if (tag.local === 'del' || tag.local === 'moveFrom') {omitted--; return;}
    if (omitted) return;
    if (tag.local === 't') inText = false;
    if (tag.local === 'p' && value.trim()) {
      paragraphs.push({page: number, logicalPage: number, method: 'TEXT', text: value.trim()});
    }
  });
  parser.write(strFromU8(xml)).close();
  if (!paragraphs.length) throw Error('DOCX_TEXT_MISSING');
  return paragraphs;
}
