import type {RecommendationInputV1,RecommendationShadowFields} from '../contracts/recommendations.ts';import {buildRecommendations} from './engine.ts';
// Internal seam only. No AnalysisResult/API/production wiring.
export function buildRecommendationShadow(x:RecommendationInputV1):RecommendationShadowFields{try{return {recommendationSetV1:buildRecommendations(x),recommendationWarnings:[]};}catch{return {recommendationWarnings:['RECOMMENDATION_SHADOW_UNAVAILABLE']};}}
