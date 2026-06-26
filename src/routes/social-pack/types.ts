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

export interface SocialPackPageState {
  productFile: File | null;
  referenceFiles: [File | null, File | null];
  productPreview: string;
  referencePreviews: [string, string];
  selectedKind: SocialImageKind;
  result: GenerateResponse | null;
  errorMessage: string;
  clientWarning: string;
  isGenerating: boolean;
}

export type UploadField = 'product' | 'reference';
