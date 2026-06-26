import type { PromptPlan, PromptPlanGrade, SocialImageKind } from '$lib/prompt';

export interface GeneratedImage {
  kind: SocialImageKind;
  url: string;
  fileExtension: 'png' | 'svg';
  aspect: string;
  targetWidth: number;
  targetHeight: number;
  actualWidth?: number;
  actualHeight?: number;
}

export interface GenerateSocialPostPackInput {
  apiKey?: string;
  promptModel?: string;
  generationModel?: string;
  mockImageGeneration?: boolean;
  /** @deprecated Use generationModel. Kept for existing deployments. */
  imageModel?: string;
  productImageDataUrl: string;
  referenceImageDataUrls: string[];
  fetchImpl?: typeof fetch;
}

export interface GenerateSocialPostPackResult {
  mode: 'generated' | 'fallback';
  promptPlan: PromptPlan;
  promptGrade: PromptPlanGrade;
  images: GeneratedImage[];
  warnings: string[];
}

export interface PromptPlanRequestInput {
  model: string;
  systemPrompt: string;
  productImageDataUrl: string;
  referenceImageDataUrls: string[];
}

export interface ImageGenerationRequestInput {
  model: string;
  kind: SocialImageKind;
  promptPlan: PromptPlan;
  productImageDataUrl: string;
  referenceImageDataUrls: string[];
}
