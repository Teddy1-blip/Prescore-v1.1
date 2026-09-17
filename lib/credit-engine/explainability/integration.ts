import type {ExplainabilityInputV1,ExplainabilityShadowFields} from '../contracts/explainability.ts';
import {buildExplainability} from './engine.ts';
export function buildExplainabilityShadow(input:ExplainabilityInputV1):ExplainabilityShadowFields{try{return {explainabilityV1:buildExplainability(input),explainabilityWarnings:[]};}catch{return {explainabilityWarnings:['EXPLAINABILITY_SHADOW_UNAVAILABLE']};}}
