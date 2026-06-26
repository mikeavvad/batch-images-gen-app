import { IMAGE_VARIANTS, type SocialImageKind } from '$lib/prompt';
import type { GenerateResponse, GeneratedImage } from './types';

export function labelFor(kind: SocialImageKind) {
  return IMAGE_VARIANTS.find((variant) => variant.kind === kind)?.label ?? kind;
}

export function getSelectedImage(
  result: GenerateResponse | null,
  selectedKind: SocialImageKind
): GeneratedImage | undefined {
  return result?.images.find((image) => image.kind === selectedKind) ?? result?.images[0];
}

export function getStatusLabel(mode: GenerateResponse['mode'] | undefined) {
  if (mode === 'generated') return 'Generated';
  if (mode === 'fallback') return 'Demo fallback';
  return 'Ready';
}
