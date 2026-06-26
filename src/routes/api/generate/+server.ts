import * as env from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';
import { generateSocialPostPack } from '$lib/server/ai';
import {
  RequestValidationError,
  fileToDataUrl,
  validateGenerateFormData
} from '$lib/server/validation';
import type {
  GeneratedImage,
  GenerateSocialPostPackResult as GenerateResponse
} from '$lib/server/ai/types';

export const config = {
  maxDuration: 300
};

type GenerateStreamEvent =
  | { event: 'status'; data: string }
  | {
      event: 'post';
      data: {
        index: number;
        productName: string;
        result: GenerateResponse;
        image: GeneratedImage;
      };
    }
  | { event: 'product-error'; data: { index: number; productName: string; error: string } }
  | { event: 'done'; data: { generatedCount: number; failedCount: number } }
  | { event: 'error'; data: { error: string } };

function encodeStreamEvent({ event, data }: GenerateStreamEvent) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamEvents(events: GenerateStreamEvent[], init?: ResponseInit) {
  return new Response(events.map(encodeStreamEvent).join(''), {
    ...init,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      ...init?.headers
    }
  });
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  let formData: FormData;
  const startedAt = Date.now();

  try {
    console.info('[generate-api] Parsing multipart form data.');
    formData = await request.formData();
  } catch {
    console.warn('[generate-api] Rejected request: multipart form data could not be parsed.');
    return streamEvents(
      [{ event: 'error', data: { error: 'Request must be multipart/form-data.' } }],
      { status: 400 }
    );
  }

  try {
    const input = validateGenerateFormData(formData);
    console.info('[generate-api] Request validated.', {
      productImageCount: input.productImages.length,
      productImageTypes: input.productImages.map((file) => file.type),
      productImageBytes: input.productImages.map((file) => file.size),
      referenceImageCount: input.referenceImages.length,
      referenceImageBytes: input.referenceImages.map((file) => file.size)
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: GenerateStreamEvent) => {
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        };

        try {
          send({ event: 'status', data: 'accepted' });
          send({ event: 'status', data: 'validating' });

          const referenceImageDataUrls = await Promise.all(
            input.referenceImages.map((file) => fileToDataUrl(file))
          );
          console.info('[generate-api] Uploaded images converted for provider request.', {
            productImageCount: input.productImages.length,
            referenceImageCount: referenceImageDataUrls.length
          });

          send({ event: 'status', data: 'generating' });

          let generatedCount = 0;
          let failedCount = 0;

          for (const [index, productImage] of input.productImages.entries()) {
            const productName = productImage.name || `Product ${index + 1}`;
            try {
              send({
                event: 'status',
                data: `generating-product-${index + 1}-of-${input.productImages.length}`
              });
              const productImageDataUrl = await fileToDataUrl(productImage);
              const result = await generateSocialPostPack({
                apiKey: env.OPENAI_API_KEY,
                promptModel: env.OPENAI_PROMPT_MODEL,
                generationModel: env.OPENAI_IMAGE_MODEL,
                mockImageGeneration: env.OPENAI_MOCK_IMAGE_GENERATION === 'true',
                productImageDataUrl,
                referenceImageDataUrls,
                fetchImpl: fetch
              });
              const image = chooseSocialPostImage(result);

              if (!image) {
                throw new Error('No generated social post image was returned.');
              }

              generatedCount += 1;
              console.info('[generate-api] Product generation completed.', {
                productIndex: index,
                productName,
                mode: result.mode,
                imageCount: result.images.length,
                warningCount: result.warnings.length,
                durationMs: Date.now() - startedAt
              });

              send({
                event: 'post',
                data: {
                  index,
                  productName,
                  result,
                  image
                }
              });
            } catch (error) {
              failedCount += 1;
              console.error('[generate-api] Product generation failed.', {
                productIndex: index,
                productName,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startedAt
              });
              send({
                event: 'product-error',
                data: {
                  index,
                  productName,
                  error: 'Unable to generate this product post.'
                }
              });
            }
          }

          send({ event: 'status', data: 'finalizing' });
          send({ event: 'done', data: { generatedCount, failedCount } });
        } catch (error) {
          console.error('[generate-api] Generation request failed unexpectedly.', {
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startedAt
          });
          send({ event: 'error', data: { error: 'Unable to generate social posts.' } });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache'
      }
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      console.warn('[generate-api] Rejected request: validation failed.', {
        message: error.message,
        status: error.status
      });
      return streamEvents([{ event: 'error', data: { error: error.message } }], { status: error.status });
    }

    console.error('[generate-api] Generation request failed unexpectedly.', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startedAt
    });
    return streamEvents(
      [{ event: 'error', data: { error: 'Unable to generate social posts.' } }],
      { status: 500 }
    );
  }
};

function chooseSocialPostImage(result: GenerateResponse) {
  return result.images.find((image) => image.kind === 'square') ?? result.images[0];
}
