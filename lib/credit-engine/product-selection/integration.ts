import type {ProductSelectionInputV1,ProductSelectionShadowFields} from '../contracts/product-selection.ts';
import {buildProductSelection} from './engine.ts';
// Internal, pure seam. Not wired into AnalysisResult, APIs or entitlement projections.
export function buildProductSelectionShadow(x:ProductSelectionInputV1):ProductSelectionShadowFields{try{return {productSelectionV1:buildProductSelection(x),productSelectionWarnings:[]};}catch{return {productSelectionWarnings:['PRODUCT_SELECTION_SHADOW_UNAVAILABLE']};}}
