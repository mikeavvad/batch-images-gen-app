import * as env from '$env/static/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { generateSocialPostPack } from '$lib/server/ai';
import {
  RequestValidationError,
  fileToDataUrl,
  validateGenerateFormData
} from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, fetch }) => {
  let formData: FormData;
  const startedAt = Date.now();
  
  try {
    console.info('[generate-api] Parsing multipart form data.');
    formData = await request.formData();
  } catch {
    console.warn('[generate-api] Rejected request: multipart form data could not be parsed.');
    return json({ error: 'Request must be multipart/form-data.' }, { status: 400 });
  }

  try {
    const input = validateGenerateFormData(formData);
    console.info('[generate-api] Request validated.', {
      productImageType: input.productImage.type,
      productImageBytes: input.productImage.size,
      referenceImageCount: input.referenceImages.length,
      referenceImageBytes: input.referenceImages.map((file) => file.size)
    });

    const [productImageDataUrl, referenceImageDataUrls] = await Promise.all([
      fileToDataUrl(input.productImage),
      Promise.all(input.referenceImages.map((file) => fileToDataUrl(file)))
    ]);
    console.info('[generate-api] Uploaded images converted for provider request.', {
      referenceImageCount: referenceImageDataUrls.length
    });

    const result = await generateSocialPostPack({
      apiKey: env.OPENAI_API_KEY,
      promptModel: env.OPENAI_PROMPT_MODEL,
      generationModel: env.OPENAI_IMAGE_MODEL,
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl: fetch
    });

    console.info('[generate-api] Generation request completed.', {
      mode: result.mode,
      imageCount: result.images.length,
      warningCount: result.warnings.length,
      durationMs: Date.now() - startedAt
    });

    return json(result);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      console.warn('[generate-api] Rejected request: validation failed.', {
        message: error.message,
        status: error.status
      });
      return json({ error: error.message }, { status: error.status });
    }

    console.error('[generate-api] Generation request failed unexpectedly.', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startedAt
    });
    return json({ error: 'Unable to generate social post pack.' }, { status: 500 });
  }
};
