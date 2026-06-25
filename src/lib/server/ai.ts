import {
  DEMO_PROMPT_PLAN,
  IMAGE_VARIANTS,
  PROMPT_PLAN_SCHEMA,
  buildVisionUserPrompt,
  gradePromptPlan,
  parsePromptPlan,
  type PromptPlan,
  type PromptPlanGrade,
  type SocialImageKind
} from '$lib/prompt';

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
  /** @deprecated Use generationModel. Kept for existing deployments. */
  imageModel?: string;
  systemPrompt: string;
  productImageDataUrl: string;
  referenceImageDataUrl: string;
  fetchImpl?: typeof fetch;
}

export interface GenerateSocialPostPackResult {
  mode: 'generated' | 'fallback';
  promptPlan: PromptPlan;
  promptGrade: PromptPlanGrade;
  images: GeneratedImage[];
  warnings: string[];
}

class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_PROMPT_MODEL = 'gpt-5.5';
const DEFAULT_GENERATION_MODEL = DEFAULT_PROMPT_MODEL;

export async function generateSocialPostPack(
  input: GenerateSocialPostPackInput
): Promise<GenerateSocialPostPackResult> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    return demoFallback(['Demo fallback: OPENAI_API_KEY is not configured.']);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const promptModel = input.promptModel?.trim() || DEFAULT_PROMPT_MODEL;
  const generationModel =
    resolveGenerationModel(input.generationModel, input.imageModel) || DEFAULT_GENERATION_MODEL;

  let promptPlan: PromptPlan;
  const warnings: string[] = [];

  try {
    promptPlan = await withRetry(() =>
      generatePromptPlan({
        apiKey,
        model: promptModel,
        systemPrompt: input.systemPrompt,
        productImageDataUrl: input.productImageDataUrl,
        referenceImageDataUrl: input.referenceImageDataUrl,
        fetchImpl
      })
    );
  } catch {
    return demoFallback([
      'Demo fallback: prompt generation provider was unavailable or returned invalid JSON.'
    ]);
  }

  const promptGrade = gradePromptPlan(promptPlan);
  if (promptGrade.issues.length > 0) {
    warnings.push(...promptGrade.issues.map((issue) => `Prompt grade: ${issue}`));
  }

  try {
    const images: GeneratedImage[] = [];
    for (const variant of IMAGE_VARIANTS) {
      const url = await withRetry(() =>
        generateImage({
          apiKey,
          model: generationModel,
          kind: variant.kind,
          promptPlan,
          productImageDataUrl: input.productImageDataUrl,
          referenceImageDataUrl: input.referenceImageDataUrl,
          fetchImpl
        })
      );

      images.push({
        kind: variant.kind,
        url,
        fileExtension: 'png',
        aspect: variant.aspect,
        targetWidth: variant.targetWidth,
        targetHeight: variant.targetHeight
      });
    }

    return {
      mode: 'generated',
      promptPlan,
      promptGrade,
      images,
      warnings
    };
  } catch {
    return {
      mode: 'fallback',
      promptPlan,
      promptGrade,
      images: demoImages(),
      warnings: [
        ...warnings,
        'Prompt generated, image provider unavailable. Showing demo placeholders.'
      ]
    };
  }
}

export function demoFallback(warnings: string[] = []): GenerateSocialPostPackResult {
  return {
    mode: 'fallback',
    promptPlan: DEMO_PROMPT_PLAN,
    promptGrade: gradePromptPlan(DEMO_PROMPT_PLAN),
    images: demoImages(),
    warnings
  };
}

function demoImages(): GeneratedImage[] {
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

interface PromptPlanRequestInput {
  model: string;
  systemPrompt: string;
  productImageDataUrl: string;
  referenceImageDataUrl: string;
}

interface ImageGenerationRequestInput {
  model: string;
  kind: SocialImageKind;
  promptPlan: PromptPlan;
  productImageDataUrl: string;
  referenceImageDataUrl: string;
}

export function buildPromptPlanRequestBody(input: PromptPlanRequestInput): Record<string, unknown> {
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
          {
            type: 'input_image',
            image_url: input.referenceImageDataUrl,
            detail: 'high'
          }
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

export function buildImageGenerationRequestBody(
  input: ImageGenerationRequestInput
): Record<string, unknown> {
  const variant = IMAGE_VARIANTS.find((item) => item.kind === input.kind);
  const targetLabel = variant
    ? `${variant.aspect} layout target (${variant.targetWidth} x ${variant.targetHeight})`
    : 'social crop target';
  const outputPrompt = [
    input.promptPlan.image_prompts[input.kind],
    '',
    `Target format: ${variant?.label ?? input.kind}.`,
    `Target aspect: ${targetLabel}.`,
    'Provider output size: use automatic provider sizing; preserve the target aspect/crop guidance for downstream layout.',
    `Overlay guidance only: "${input.promptPlan.overlay_copy.headline}" / "${input.promptPlan.overlay_copy.subline}".`,
    'Use the product image as the product fidelity reference. Use the reference image only for style, lighting, setting, mood, and composition. Do not render exact text.'
  ].join('\n');

  return {
    model: input.model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: outputPrompt },
          {
            type: 'input_image',
            image_url: input.productImageDataUrl,
            detail: 'high'
          },
          {
            type: 'input_image',
            image_url: input.referenceImageDataUrl,
            detail: 'high'
          }
        ]
      }
    ],
    tools: [{ type: 'image_generation', size: 'auto', quality: 'medium' }],
    tool_choice: { type: 'image_generation' }
  };
}

export function resolveGenerationModel(
  generationModel?: string,
  legacyImageModel?: string
): string | undefined {
  return generationModel?.trim() || legacyImageModel?.trim() || undefined;
}

async function generatePromptPlan(input: PromptPlanRequestInput & {
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<PromptPlan> {
  const response = await callResponsesApi(
    input.fetchImpl,
    input.apiKey,
    buildPromptPlanRequestBody(input)
  );

  return parsePromptPlan(extractResponseText(response));
}

async function generateImage(input: ImageGenerationRequestInput & {
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<string> {
  const response = await callResponsesApi(
    input.fetchImpl,
    input.apiKey,
    buildImageGenerationRequestBody(input)
  );

  const base64 = extractImageBase64(response);
  return `data:image/png;base64,${base64}`;
}

async function callResponsesApi(
  fetchImpl: typeof fetch,
  apiKey: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = extractProviderError(payload);
    throw new ProviderError(error.message, response.status, error.code);
  }

  return payload;
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!shouldRetry(error)) {
      throw error;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 600));
  return operation();
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.status === 429 || (typeof error.status === 'number' && error.status >= 500);
  }

  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return true;
  }

  return false;
}

function extractResponseText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  const chunks: string[] = [];
  if (isRecord(payload) && Array.isArray(payload.output)) {
    for (const output of payload.output) {
      if (!isRecord(output)) {
        continue;
      }

      if (typeof output.text === 'string') {
        chunks.push(output.text);
      }

      if (Array.isArray(output.content)) {
        for (const content of output.content) {
          if (isRecord(content) && typeof content.text === 'string') {
            chunks.push(content.text);
          }
        }
      }
    }
  }

  if (chunks.length === 0) {
    throw new Error('Provider response did not include text output.');
  }

  return chunks.join('\n');
}

function extractImageBase64(payload: unknown): string {
  if (isRecord(payload) && Array.isArray(payload.output)) {
    for (const output of payload.output) {
      if (
        isRecord(output) &&
        output.type === 'image_generation_call' &&
        typeof output.result === 'string' &&
        output.result.length > 0
      ) {
        return output.result;
      }
    }
  }

  throw new Error('Provider response did not include generated image data.');
}

function extractProviderError(payload: unknown): { message: string; code?: string } {
  if (isRecord(payload) && isRecord(payload.error)) {
    return {
      message:
        typeof payload.error.message === 'string'
          ? payload.error.message
          : 'Provider request failed.',
      code: typeof payload.error.code === 'string' ? payload.error.code : undefined
    };
  }

  return { message: 'Provider request failed.' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
