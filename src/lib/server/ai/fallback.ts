import { DEMO_PROMPT_PLAN, IMAGE_VARIANTS, gradePromptPlan } from '$lib/prompt';
import type { GenerateSocialPostPackResult, GeneratedImage } from './types';

export function demoFallback(warnings: string[] = []): GenerateSocialPostPackResult {
  return {
    mode: 'fallback',
    promptPlan: DEMO_PROMPT_PLAN,
    promptGrade: gradePromptPlan(DEMO_PROMPT_PLAN),
    images: demoImages(),
    warnings
  };
}

export function demoImages(): GeneratedImage[] {
  return IMAGE_VARIANTS.map((variant) => ({
    kind: variant.kind,
    url: `/demo/${variant.kind}.svg`,
    fileExtension: 'svg',
    aspect: variant.aspect,
    targetWidth: variant.targetWidth,
    targetHeight: variant.targetHeight,
    actualWidth: variant.targetWidth,
    actualHeight: variant.targetHeight
  }));
}
