import type {IndexShadowInput,IndexShadowFields} from '../contracts/index.ts';
import {buildPrescoreIndex} from './engine.ts';
export function buildPrescoreIndexShadow(input:IndexShadowInput,builder=buildPrescoreIndex):IndexShadowFields{try{return {prescoreIndexV1:builder(input),prescoreIndexWarnings:[]};}catch(error){return {prescoreIndexWarnings:[error instanceof Error&&error.message.startsWith('INDEX_INPUT_INVALID:')?error.message:'PRESCORE_INDEX_SHADOW_UNAVAILABLE']};}}
