import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { generateSocialPostPack, resolveGenerationModel } from '$lib/server/ai';
import {
  RequestValidationError,
  fileToDataUrl,
  validateGenerateFormData
} from '$lib/server/validation';

export const POST: RequestHandler = async ({ request, fetch }) => {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Request must be multipart/form-data.' }, { status: 400 });
  }

  try {
    const input = validateGenerateFormData(formData);
    const [productImageDataUrl, referenceImageDataUrl] = await Promise.all([
      fileToDataUrl(input.productImage),
      fileToDataUrl(input.referenceImage)
    ]);

    const result = await generateSocialPostPack({
      apiKey: env.OPENAI_API_KEY,
      promptModel: env.OPENAI_PROMPT_MODEL,
      generationModel: resolveGenerationModel(env.OPENAI_GENERATION_MODEL, env.OPENAI_IMAGE_MODEL),
      systemPrompt: input.systemPrompt,
      productImageDataUrl,
      referenceImageDataUrl,
      fetchImpl: fetch
    });

    return json(result);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return json({ error: error.message }, { status: error.status });
    }

    return json({ error: 'Unable to generate social post pack.' }, { status: 500 });
  }
};
