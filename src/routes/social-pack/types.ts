import type { PromptPlan, SocialImageKind } from '$lib/prompt';

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

export interface GenerateResponse {
  mode: 'generated' | 'fallback';
  promptPlan: PromptPlan;
  promptGrade: {
    score: number;
    issues: string[];
  };
  images: GeneratedImage[];
  warnings?: string[];
}

export interface GeneratedPostResult {
  index: number;
  productName: string;
  result: GenerateResponse;
  image: GeneratedImage;
}

export interface ProductGenerationError {
  index: number;
  productName: string;
  error: string;
}

export interface SocialPackPageState {
  productFiles: File[];
  referenceFiles: [File | null, File | null];
  productPreviews: string[];
  referencePreviews: [string, string];
  results: GeneratedPostResult[];
  productErrors: ProductGenerationError[];
  errorMessage: string;
  clientWarning: string;
  isGenerating: boolean;
  generationStatus: string;
}

export type UploadField = 'product' | 'reference';
