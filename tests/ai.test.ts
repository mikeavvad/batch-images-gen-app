import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PROMPT_PLAN, PROMPT_PLAN_SCHEMA } from '../src/lib/prompt';
import {
  buildImageGenerationRequestBody,
  buildPromptPlanRequestBody,
  generateSocialPostPack,
} from '../src/lib/server/ai';
import { callImagesEditApi } from '../src/lib/server/ai/provider';

const productImageDataUrl = 'data:image/png;base64,cHJvZHVjdA==';
const referenceImageDataUrls = [
  'data:image/png;base64,cmVmZXJlbmNlLTE=',
  'data:image/png;base64,cmVmZXJlbmNlLTI='
];
const generatedImageDataUrl = 'data:image/png;base64,aW1hZ2U=';

afterEach(() => {
  vi.useRealTimers();
});

describe('OpenAI provider request bodies', () => {
  it('enforces the prompt plan JSON schema on the Responses request', () => {
    const body = buildPromptPlanRequestBody({
      model: 'gpt-plan',
      systemPrompt: 'Return JSON.',
      productImageDataUrl,
      referenceImageDataUrls
    });

    expect(body.model).toBe('gpt-plan');
    expect(body.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'social_prompt_plan',
        strict: true,
        schema: PROMPT_PLAN_SCHEMA
      }
    });
    expect(JSON.stringify(body.input)).toContain('input_image');
  });

  it('uses the Images API edit form with gpt-image-2 inputs', () => {
    const formData = buildImageGenerationRequestBody({
      model: 'gpt-image-2',
      kind: 'square',
      promptPlan: DEMO_PROMPT_PLAN,
      productImageDataUrl,
      referenceImageDataUrls
    });
    const prompt = String(formData.get('prompt'));

    expect(formData.get('model')).toBe('gpt-image-2');
    expect(formData.get('size')).toBe('auto');
    expect(formData.get('quality')).toBe('high');
    expect(formData.get('output_format')).toBe('png');
    expect(formData.getAll('image[]')).toHaveLength(3);
    expect(prompt).toContain('Target aspect: 1:1 layout target (1080 x 1080)');
    expect(prompt).toContain('Provider output size: use automatic provider sizing');
    expect(prompt).toContain('Use the uploaded product image as the hero subject');
    expect(prompt).toContain('prefer natural integration over exact pixel preservation');
    expect(prompt).not.toContain('composited later');
    expect(prompt).not.toContain('No product, no product-like object');
  });

  it('allows up to five minutes for Images API edit requests', async () => {
    const signal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: generatedImageDataUrl.split(',')[1] }]
        })
      )
    );
    const formData = buildImageGenerationRequestBody({
      model: 'gpt-image-2',
      kind: 'square',
      promptPlan: DEMO_PROMPT_PLAN,
      productImageDataUrl,
      referenceImageDataUrls
    });

    await callImagesEditApi(fetchImpl, 'test-key', formData);

    expect(timeoutSpy).toHaveBeenCalledWith(300000);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal })
    );
    timeoutSpy.mockRestore();
  });

  it('returns generated provider image outputs with target metadata', async () => {
    const requestBodies: Array<BodyInit | null | undefined> = [];
    const fetchImpl = async (_url: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(init?.body);

      return new Response(
        JSON.stringify({
          data: [{ b64_json: generatedImageDataUrl.split(',')[1] }]
        })
      );
    };

    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result.mode).toBe('generated');
    expect(requestBodies).toHaveLength(1);
    expect(requestBodies[0]).toBeInstanceOf(FormData);
    expect((requestBodies[0] as FormData).get('model')).toBe('gpt-image-2');
    expect(result.images[0]).toMatchObject({
      kind: 'square',
      aspect: '1:1',
      targetWidth: 1080,
      targetHeight: 1080
    });
    expect(result.images[0]?.actualWidth).toBeUndefined();
    expect(result.images[0]?.actualHeight).toBeUndefined();
    expect(result.images[0]?.url).toBe(generatedImageDataUrl);
    expect(result.warnings).toContain(
      'Generated images are model-composed with the uploaded product requested as the hero subject; product identity may vary slightly.'
    );
  });

  it('generates the square image while the provider prompt plan call is disabled', async () => {
    const requestBodies: Array<BodyInit | null | undefined> = [];
    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl: (async (_url, init) => {
        requestBodies.push(init?.body);

        return new Response(
          JSON.stringify({
            data: [{ b64_json: generatedImageDataUrl.split(',')[1] }]
          })
        );
      }) as typeof fetch
    });

    expect(requestBodies).toHaveLength(1);
    expect(requestBodies[0]).toBeInstanceOf(FormData);
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.kind).toBe('square');
  });

  it('keeps prompt generation but skips the Images API when image generation is mocked', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>();

    const resultPromise = generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      mockImageGeneration: true,
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl
    });

    await vi.advanceTimersByTimeAsync(1499);
    let isSettled = false;
    resultPromise.then(() => {
      isSettled = true;
    });
    await Promise.resolve();
    expect(isSettled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result.mode).toBe('generated');
    expect(result.images).toHaveLength(1);
    expect(result.images.every((image) => image.fileExtension === 'svg')).toBe(true);
    expect(result.warnings).toContain(
      'Image generation mocked: skipped provider image edit request.'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('generateSocialPostPack fallbacks and retries', () => {
  it('returns the demo fallback when the API key is missing', async () => {
    const result = await generateSocialPostPack({
      productImageDataUrl,
      referenceImageDataUrls
    });

    expect(result.mode).toBe('fallback');
    expect(result.promptPlan).toEqual(DEMO_PROMPT_PLAN);
    expect(result.warnings).toEqual(['Demo fallback: OPENAI_API_KEY is not configured.']);
    expect(result.images).toHaveLength(1);
    expect(result.images.every((image) => image.fileExtension === 'svg')).toBe(true);
  });

  it('retries image generation once after a retryable provider error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 500 })
      )
      .mockImplementation(async () =>
        new Response(
          JSON.stringify({
            data: [{ b64_json: generatedImageDataUrl.split(',')[1] }]
          })
        )
      );

    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl
    });

    expect(result.mode).toBe('generated');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries image generation once after an aborted request', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'))
      .mockImplementation(async () =>
        new Response(
          JSON.stringify({
            data: [{ b64_json: generatedImageDataUrl.split(',')[1] }]
          })
        )
      );

    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl
    });

    expect(result.mode).toBe('generated');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps the generated prompt plan and falls back to demo images when image generation fails', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 503 })
      );

    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl
    });

    expect(result.mode).toBe('fallback');
    expect(result.images).toHaveLength(1);
    expect(result.images.every((image) => image.fileExtension === 'svg')).toBe(true);
    expect(result.warnings).toContain(
      'Prompt generated, integrated image generation unavailable. Showing demo placeholders.'
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
