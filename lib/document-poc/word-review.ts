import type {EvidencePage} from './document-routing.ts';

/** Bounded synthetic text pages for the review router, not rendered DOCX pages.
 * Original Word paragraph numbers must remain the only user-facing anchors. */
export function wordReviewPages(paragraphs:readonly EvidencePage[]):EvidencePage[]{
  const LIMIT=20_000,MAX_PAGES=64;
  const pages:EvidencePage[]=[];
  let buffer='';
  const flush=()=>{
    if(!buffer)return;
    const n=pages.length+1;
    if(n>MAX_PAGES)throw Error('DOCX_REVIEW_PAGE_LIMIT');
    pages.push({page:n,logicalPage:n,method:'TEXT',text:buffer});
    buffer='';
  };
  for(const paragraph of paragraphs){
    const text=paragraph.text;
    if(!text.trim())continue;
    if(text.length>LIMIT)throw Error('DOCX_PARAGRAPH_TOO_LONG');
    if(buffer&&buffer.length+text.length+1>LIMIT)flush();
    buffer+=buffer?'\n'+text:text;
  }
  flush();
  if(!pages.length)throw Error('DOCX_TEXT_MISSING');
  return pages;
}
