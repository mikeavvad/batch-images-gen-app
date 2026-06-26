import {
  IMAGE_VARIANTS,
  DEFAULT_SYSTEM_PROMPT,
  gradePromptPlan,
  parsePromptPlan,
  type PromptPlan
} from '$lib/prompt';
import { DEFAULT_GENERATION_MODEL, DEFAULT_PROMPT_MODEL } from './constants';
import { demoFallback, demoImages } from './fallback';
import { ProviderError, callImagesEditApi, callResponsesApi } from './provider';
import {
  buildIntegratedImageGenerationRequestBody,
  buildPromptPlanRequestBody
} from './request-builders';
import { extractImagesApiDataUrl, extractResponseText } from './response-parsers';
import { withRetry } from './retry';
import type {
  GenerateSocialPostPackInput,
  GenerateSocialPostPackResult,
  GeneratedImage,
  ImageGenerationRequestInput,
  PromptPlanRequestInput
} from './types';

export async function generateSocialPostPack(
  input: GenerateSocialPostPackInput
): Promise<GenerateSocialPostPackResult> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    console.warn('[ai-service] OPENAI_API_KEY is not configured. Returning demo fallback.');
    return demoFallback(['Demo fallback: OPENAI_API_KEY is not configured.']);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const promptModel = input.promptModel?.trim() || DEFAULT_PROMPT_MODEL;
  const generationModel = input.generationModel || DEFAULT_GENERATION_MODEL;
  let promptPlan: PromptPlan;
  const warnings: string[] = [];

  console.info('[ai-service] Starting social post pack generation.', {
    promptModel,
    generationModel,
    referenceImageCount: input.referenceImageDataUrls.length,
    variantCount: IMAGE_VARIANTS.length
  });

  try {
    console.info('[ai-service] Generating prompt plan.');
    // promptPlan = await withRetry(() =>
    //   generatePromptPlan({
    //     apiKey,
    //     model: promptModel,
    //     systemPrompt: DEFAULT_SYSTEM_PROMPT,
    //     productImageDataUrl: input.productImageDataUrl,
    //     referenceImageDataUrls: input.referenceImageDataUrls,
    //     fetchImpl
    //   })
    // );
    promptPlan = {
      "product_summary": "A matte sage-green cylindrical shampoo bottle with a rounded shoulder, matching sage flip-top cap, and a centered cream rectangular label. Visible branding reads \"VELORA HAIRCARE\" with a small leaf icon above, product name \"NOURISH SHAMPOO,\" and supporting text referencing plant-based keratin and avocado oil, 300 ml / 10.1 fl oz. Preserve the clean minimal silhouette, soft neutral-green body color, cream label block, premium spa-like packaging, and simple botanical mark.",
      "reference_style_summary": "Dreamy premium nature-fantasy style: a lush forest environment with deep green foliage, moss, ferns, tall trees, and visible sunbeams streaming through misty canopy. The mood is serene, elevated, and slightly cinematic, with a moody-dappled palette of forest greens, warm highlights, and cool shadow tones. Composition favors centered hero subjects in a natural setting, dramatic back/side lighting, realistic textures, soft atmospheric depth, and a polished editorial CGI-photoreal blend.",
      "creative_direction": "Create a premium botanical haircare campaign that moves the shampoo bottle from studio simplicity into an enchanted forest spa world. The bottle should feel naturally placed among moss, leaves, and soft light beams, as if the forest itself is the source of nourishment. Keep the product front-facing and clearly readable, but let the environment add lushness, freshness, and a science-meets-nature sense of efficacy. Use cinematic sunlight, moist textures, and subtle mist to elevate the bottle into a hero object with calm luxury and clean wellness energy.",
      "image_prompts": {
        "square": "Design a 1:1 social feed ad with the uploaded Velora Nourish Shampoo bottle as the hero subject, preserved as much as possible but integrated organically into a lush, cinematic forest scene inspired by the references. Place the bottle centered or slightly low-center on moss, ferns, and damp forest floor textures, with soft sunbeams breaking through tall trees and a gentle mist in the background. Maintain the matte sage bottle, cream label, and cap, with natural reflections and realistic contact shadows. Use deep greens, muted earth tones, and warm shafts of light for an elevated botanical mood. Leave subtle negative space in the upper area for optional copy, and keep the composition premium, serene, and photorealistic.",
        "story": "Create a 9:16 vertical story ad with the uploaded Velora Nourish Shampoo bottle as the clear hero, blended naturally into an immersive forest sanctuary. Frame the bottle in the lower middle to lower third so it feels tall and iconic, surrounded by fern fronds, mossy stones, and soft woodland floor detail. Let sunlight stream diagonally from the upper left or upper center through tree trunks, creating luminous haze and depth behind the product. Preserve the sage-green body, cream label, and clean cylindrical silhouette while allowing slight natural integration. Use a moody yet fresh palette of forest greens, soft gold highlights, and cool shadowed background tones. Reserve clean negative space near the upper third for optional headline text.",
        "banner": "Design a 16:9 hero banner ad with the uploaded shampoo bottle as the central premium product in a wide, atmospheric forest scene inspired by the references. Position the bottle slightly left of center or centered with ample horizontal breathing room, seated naturally on a mossy ground plane with fern clusters, tree roots, and subtle dew or mist. Preserve the matte sage finish, rounded cap, and cream label as much as possible while blending it into the environment with realistic lighting and shadows. Use dramatic sunbeams cutting through tall trees, rich layered greenery, and cinematic contrast for a refined wellness-luxury feel. Leave generous negative space on one side for optional copy, and keep the scene photorealistic, calm, and high-end."
      },
      "overlay_copy": {
        "headline": "Nature Nourishes Hair",
        "subline": "Clean botanicals for stronger, shinier hair."
      }
    }
    console.info('[ai-service] Prompt plan generated.');
  } catch (error) {
    console.warn('[ai-service] Prompt plan generation failed. Returning demo fallback.', {
      error: summarizeError(error)
    });
    return demoFallback([
      'Demo fallback: prompt generation provider was unavailable or returned invalid JSON.'
    ]);
  }

  const promptGrade = gradePromptPlan(promptPlan);
  if (promptGrade.issues.length > 0) {
    warnings.push(...promptGrade.issues.map((issue) => `Prompt grade: ${issue}`));
    console.warn('[ai-service] Prompt plan grade reported issues.', {
      issueCount: promptGrade.issues.length
    });
  } else {
    console.info('[ai-service] Prompt plan grade passed without issues.');
  }

  warnings.push(
    'Generated images are model-composed with the uploaded product requested as the hero subject; product identity may vary slightly.'
  );

  try {
    const images: GeneratedImage[] = [];
    for (const variant of IMAGE_VARIANTS) {
      console.info('[ai-service] Generating image variant.', {
        kind: variant.kind,
        aspect: variant.aspect,
        targetWidth: variant.targetWidth,
        targetHeight: variant.targetHeight
      });
      const generatedImageUrl = await withRetry(() =>
        generateIntegratedImage({
          apiKey,
          model: generationModel,
          kind: variant.kind,
          promptPlan,
          productImageDataUrl: input.productImageDataUrl,
          referenceImageDataUrls: input.referenceImageDataUrls,
          fetchImpl
        })
      );

      console.info('[ai-service] Image variant generated.', {
        kind: variant.kind,
        aspect: variant.aspect
      });
      images.push({
        kind: variant.kind,
        url: generatedImageUrl,
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
  } catch (error) {
    console.warn('[ai-service] Image generation failed. Returning demo images with generated prompt plan.', {
      error: summarizeError(error)
    });
    return {
      mode: 'fallback',
      promptPlan,
      promptGrade,
      images: demoImages(),
      warnings: [
        ...warnings,
        'Prompt generated, integrated image generation unavailable. Showing demo placeholders.'
      ]
    };
  }
}

export { demoFallback };

async function generatePromptPlan(
  input: PromptPlanRequestInput & {
    apiKey: string;
    fetchImpl: typeof fetch;
  }
): Promise<PromptPlan> {
  const response = await callResponsesApi(
    input.fetchImpl,
    input.apiKey,
    buildPromptPlanRequestBody(input)
  );

  return parsePromptPlan(extractResponseText(response));
}

async function generateIntegratedImage(
  input: ImageGenerationRequestInput & {
    apiKey: string;
    fetchImpl: typeof fetch;
  }
): Promise<string> {
  const response = await callImagesEditApi(
    input.fetchImpl,
    input.apiKey,
    buildIntegratedImageGenerationRequestBody(input)
  );

  return extractImagesApiDataUrl(response);
}

function summarizeError(error: unknown): { message: string; status?: number; code?: string } {
  if (error instanceof ProviderError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code
    };
  }

  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return {
      message: 'Request timed out (AbortSignal.timeout fired)',
      code: 'TIMEOUT'
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      message: error.message || 'Request was aborted',
      code: 'ABORTED'
    };
  }

  if (error instanceof Error) {
    return { message: error.message, code: error.name };
  }

  return { message: 'Unknown error' };
}
