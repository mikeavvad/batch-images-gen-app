import { describe, expect, it } from 'vitest';
import { DEMO_PROMPT_PLAN, PROMPT_PLAN_SCHEMA } from '../src/lib/prompt';
import {
  buildImageGenerationRequestBody,
  buildPromptPlanRequestBody,
  generateSocialPostPack,
  resolveGenerationModel
} from '../src/lib/server/ai';

const productImageDataUrl = 'data:image/png;base64,cHJvZHVjdA==';
const referenceImageDataUrl = 'data:image/png;base64,cmVmZXJlbmNl';

describe('OpenAI provider request bodies', () => {
  it('enforces the prompt plan JSON schema on the Responses request', () => {
    const body = buildPromptPlanRequestBody({
      model: 'gpt-plan',
      systemPrompt: 'Return JSON.',
      productImageDataUrl,
      referenceImageDataUrl
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

  it('uses the main Responses model with the image generation tool options', () => {
    const body = buildImageGenerationRequestBody({
      model: 'gpt-mainline',
      kind: 'story',
      promptPlan: DEMO_PROMPT_PLAN,
      productImageDataUrl,
      referenceImageDataUrl
    });
    const serialized = JSON.stringify(body);

    expect(body.model).toBe('gpt-mainline');
    expect(body.tools).toEqual([{ type: 'image_generation', size: 'auto', quality: 'medium' }]);
    expect(body.tool_choice).toEqual({ type: 'image_generation' });
    expect(serialized).toContain('Target aspect: 9:16 layout target (1080 x 1920)');
    expect(serialized).toContain('Provider output size: use automatic provider sizing');
  });

  it('prefers OPENAI_GENERATION_MODEL but accepts the legacy image model value', () => {
    expect(resolveGenerationModel('gpt-mainline', 'legacy-image-model')).toBe('gpt-mainline');
    expect(resolveGenerationModel('', 'legacy-image-model')).toBe('legacy-image-model');
    expect(resolveGenerationModel('   ', '   ')).toBeUndefined();
  });

  it('returns target metadata for live outputs without claiming actual dimensions', async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const fetchImpl = async (_url: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)));

      if (requestBodies.length === 1) {
        return new Response(JSON.stringify({ output_text: JSON.stringify(DEMO_PROMPT_PLAN) }));
      }

      return new Response(
        JSON.stringify({
          output: [{ type: 'image_generation_call', result: 'aW1hZ2U=' }]
        })
      );
    };

    const result = await generateSocialPostPack({
      apiKey: 'test-key',
      promptModel: 'gpt-plan',
      generationModel: 'gpt-mainline',
      systemPrompt: 'Return JSON.',
      productImageDataUrl,
      referenceImageDataUrl,
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result.mode).toBe('generated');
    expect(requestBodies).toHaveLength(4);
    expect(requestBodies[0]?.model).toBe('gpt-plan');
    expect(requestBodies[1]?.model).toBe('gpt-mainline');
    expect(result.images[1]).toMatchObject({
      kind: 'story',
      aspect: '9:16',
      targetWidth: 1080,
      targetHeight: 1920
    });
    expect(result.images[1]?.actualWidth).toBeUndefined();
    expect(result.images[1]?.actualHeight).toBeUndefined();
  });
});
