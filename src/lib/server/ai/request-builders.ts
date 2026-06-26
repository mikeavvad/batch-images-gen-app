import {
  IMAGE_VARIANTS,
  PROMPT_PLAN_SCHEMA,
  buildVisionUserPrompt,
  type PromptPlan
} from '$lib/prompt';
import type { ImageGenerationRequestInput, PromptPlanRequestInput } from './types';

export function buildPromptPlanRequestBody(input: PromptPlanRequestInput): Record<string, unknown> {
  const referenceImageInputs = input.referenceImageDataUrls.map((imageUrl) => ({
    type: 'input_image',
    image_url: imageUrl,
    detail: 'high'
  }));

  return {
    model: input.model,
    instructions: input.systemPrompt,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: buildVisionUserPrompt() },
          {
            type: 'input_image',
            image_url: input.productImageDataUrl,
            detail: 'high'
          },
          ...referenceImageInputs
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'social_prompt_plan',
        strict: true,
        schema: PROMPT_PLAN_SCHEMA
      }
    }
  };
}

export function buildIntegratedImageGenerationRequestBody(
  input: ImageGenerationRequestInput
): FormData {
  const variant = IMAGE_VARIANTS.find((item) => item.kind === input.kind);
  const targetLabel = variant
    ? `${variant.aspect} layout target (${variant.targetWidth} x ${variant.targetHeight})`
    : 'social crop target';
  const outputPrompt = buildImageOutputPrompt(input.promptPlan, input.kind, targetLabel);
  const formData = new FormData();

  formData.set('model', input.model);
  formData.set('prompt', outputPrompt);
  formData.set('size', 'auto');
  formData.set('quality', 'high');
  formData.set('output_format', 'png');
  formData.append('image[]', dataUrlToFile(input.productImageDataUrl, 'product'));

  input.referenceImageDataUrls.forEach((imageUrl, index) => {
    formData.append('image[]', dataUrlToFile(imageUrl, `reference-${index + 1}`));
  });

  return formData;
}

function buildImageOutputPrompt(
  promptPlan: PromptPlan,
  kind: ImageGenerationRequestInput['kind'],
  targetLabel: string
): string {
  const variant = IMAGE_VARIANTS.find((item) => item.kind === kind);

  return [
    promptPlan.image_prompts[kind],
    '',
    `Target format: ${variant?.label ?? kind}.`,
    `Target aspect: ${targetLabel}.`,
    'Provider output size: use automatic provider sizing; preserve the target aspect/crop guidance in the composition.',
    `Copy guidance only, do not render exact readable typography: "${promptPlan.overlay_copy.headline}" / "${promptPlan.overlay_copy.subline}".`,
    `Product identity to preserve where possible: ${promptPlan.product_summary}`,
    'Use the uploaded product image as the hero subject and blend it organically into the generated scene.',
    'Preserve the product silhouette, branding, colors, packaging shape, material cues, and visible text where possible, but prefer natural integration over exact pixel preservation.',
    'Use the reference images for style, lighting, setting, mood, palette, props, surfaces, and composition.'
  ].join('\n');
}

export const buildImageGenerationRequestBody = buildIntegratedImageGenerationRequestBody;

function dataUrlToFile(dataUrl: string, name: string): File {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Image must be a base64 data URL.');
  }

  const mimeType = match[1];
  const extension = extensionForMimeType(mimeType);
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  return new File([bytes], `${name}.${extension}`, { type: mimeType });
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'png';
}
