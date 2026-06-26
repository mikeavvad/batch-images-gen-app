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
      kind: 'story',
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
    expect(prompt).toContain('Target aspect: 9:16 layout target (1080 x 1920)');
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

      if (requestBodies.length === 1) {
        return new Response(JSON.stringify({ output_text: JSON.stringify(DEMO_PROMPT_PLAN) }));
      }

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
    expect(requestBodies).toHaveLength(4);
    expect(JSON.parse(String(requestBodies[0])).model).toBe('gpt-plan');
    expect(requestBodies[1]).toBeInstanceOf(FormData);
    expect((requestBodies[1] as FormData).get('model')).toBe('gpt-image-2');
    expect(result.images[1]).toMatchObject({
      kind: 'story',
      aspect: '9:16',
      targetWidth: 1080,
      targetHeight: 1920
    });
    expect(result.images[1]?.actualWidth).toBeUndefined();
    expect(result.images[1]?.actualHeight).toBeUndefined();
    expect(result.images[1]?.url).toBe(generatedImageDataUrl);
    expect(result.warnings).toContain(
      'Generated images are model-composed with the uploaded product requested as the hero subject; product identity may vary slightly.'
    );
  });

  it('parses prompt plan JSON when the Responses API returns nested content text instead of output_text', async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              content: [{ text: JSON.stringify(DEMO_PROMPT_PLAN) }],
              type: 'message'
            }
          ]
        })
      );

    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-image-2',
      productImageDataUrl,
      referenceImageDataUrls,
      fetchImpl: (async (_url, init) => {
        if (!(init?.body instanceof FormData)) {
          const body = JSON.parse(String(init?.body));
          expect(body.instructions).not.toBe('Return JSON.');
          return fetchImpl();
        }

        return new Response(
          JSON.stringify({
            data: [{ b64_json: generatedImageDataUrl.split(',')[1] }]
          })
        );
      }) as typeof fetch
    });

    expect(result.promptPlan).toEqual(DEMO_PROMPT_PLAN);
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
    expect(result.images.every((image) => image.fileExtension === 'svg')).toBe(true);
  });

  it('retries prompt plan generation once after a retryable provider error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 500 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(DEMO_PROMPT_PLAN) })))
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
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('retries image generation once after an aborted request', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(DEMO_PROMPT_PLAN) })))
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
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('keeps the generated prompt plan and falls back to demo images when image generation fails', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(DEMO_PROMPT_PLAN) })))
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
    expect(result.promptPlan).toEqual(DEMO_PROMPT_PLAN);
    expect(result.images.every((image) => image.fileExtension === 'svg')).toBe(true);
    expect(result.warnings).toContain(
      'Prompt generated, integrated image generation unavailable. Showing demo placeholders.'
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
