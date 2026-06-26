import { IMAGE_VARIANTS, type SocialImageKind } from '$lib/prompt';
import type {
  GenerateResponse,
  GeneratedImage,
  GeneratedPostResult,
  ProductGenerationError
} from './types';

export function labelFor(kind: SocialImageKind) {
  return IMAGE_VARIANTS.find((variant) => variant.kind === kind)?.label ?? kind;
}

export function getSocialPostImage(result: GenerateResponse): GeneratedImage | undefined {
  return result.images.find((image) => image.kind === 'square') ?? result.images[0];
}

export function getStatusLabel(
  state?: {
    isGenerating?: boolean;
    results?: GeneratedPostResult[];
    productErrors?: ProductGenerationError[];
  } | null
) {
  if (state?.isGenerating) return 'Generating';

  const results = state?.results ?? [];
  const productErrors = state?.productErrors ?? [];
  if (results.length > 0 && productErrors.length > 0) return 'Partial';
  if (productErrors.length > 0) return 'Failed';
  if (results.some((post) => post.result.mode === 'fallback')) return 'Demo fallback';
  if (results.length > 0) return 'Complete';
  return 'Ready';
}
