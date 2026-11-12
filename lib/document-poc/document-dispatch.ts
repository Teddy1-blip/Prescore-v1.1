import {routeDocument, type RoutingInput, type RoutingDecision, type EvidencePage} from './document-routing.ts';

/** Adapters are supplied by the caller. No second BFO or loan parser is created here. */
export type DocumentParser = (pages: readonly EvidencePage[]) => unknown | Promise<unknown>;
export type DocumentParsers = Partial<Record<NonNullable<RoutingDecision['parser']>,DocumentParser>>;
export type DispatchedReview = {
  routing: RoutingDecision;
  status: 'ROUTING_REVIEW' | 'ADAPTER_NOT_CONNECTED' | 'EXTRACTION_REVIEW' | 'PARSER_FAILED';
  extraction: unknown | null;
  warnings: string[];
  automaticApply: false;
};
export async function dispatchDocumentReview(input: RoutingInput, parsers: DocumentParsers): Promise<DispatchedReview> {
  const routing=routeDocument(input);
  const result:DispatchedReview={routing,status:'ROUTING_REVIEW',extraction:null,
    warnings:['NOT_IMPORTED_INTO_CREDIT_ENGINE'],automaticApply:false};
  if(routing.status!=='READY_FOR_REVIEW'||!routing.parser)return result;
  // Own-property lookup avoids ever selecting a prototype property as an adapter.
  const parser=Object.hasOwn(parsers,routing.parser)?parsers[routing.parser]:null;
  if(typeof parser!=='function'){result.status='ADAPTER_NOT_CONNECTED';result.warnings.push('SPECIALIZED_ADAPTER_NOT_CONNECTED');return result;}
  const unique=new Map<string,EvidencePage>();
  for(const page of input.pages) {
    const key=page.page+':'+(page.segment??'FULL');
    if(!unique.has(key))unique.set(key,{...page});
  }
  const pages=Object.freeze([...unique.values()].sort((a,b)=>a.page-b.page||a.logicalPage-b.logicalPage).map(p=>Object.freeze(p)));
  try {
    const extraction=await parser(pages);
    if(extraction==null){result.status='PARSER_FAILED';result.warnings.push('PARSER_RETURNED_NO_RESULT');return result;}
    result.status='EXTRACTION_REVIEW';result.extraction=extraction;result.warnings.push('FIELDS_REQUIRE_SEPARATE_VALIDATION');
  } catch {
    // A parser error can contain document text; do not expose or log it.
    result.status='PARSER_FAILED';result.warnings.push('SPECIALIZED_PARSER_FAILED');
  }
  return result;
}
