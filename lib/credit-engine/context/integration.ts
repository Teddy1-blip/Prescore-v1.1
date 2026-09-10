import type {ContextShadowInput,ContextShadowFields} from '../contracts/context.ts';
import {buildContextAssessment} from './engine.ts';
export function buildContextShadow(input:ContextShadowInput,builder=buildContextAssessment):ContextShadowFields{
 try{return {contextAssessmentV1:builder(input),contextEngineWarnings:[]};}
 catch(error){return {contextEngineWarnings:[error instanceof Error&&/^CONTEXT_/.test(error.message)?error.message:'CONTEXT_SHADOW_UNAVAILABLE']};}
}
