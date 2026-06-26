export type SocialImageKind = 'square' | 'story' | 'banner';

export interface PromptPlan {
  product_summary: string;
  reference_style_summary: string;
  creative_direction: string;
  image_prompts: Record<SocialImageKind, string>;
  overlay_copy: {
    headline: string;
    subline: string;
  };
}

export interface PromptPlanGrade {
  score: number;
  issues: string[];
}

export const IMAGE_VARIANTS: Array<{
  kind: SocialImageKind;
  label: string;
  targetWidth: number;
  targetHeight: number;
  aspect: string;
}> = [
  { kind: 'square', label: 'Square', targetWidth: 1080, targetHeight: 1080, aspect: '1:1' },
  { kind: 'story', label: 'Story', targetWidth: 1080, targetHeight: 1920, aspect: '9:16' },
  { kind: 'banner', label: 'Banner', targetWidth: 1600, targetHeight: 900, aspect: '16:9' }
];

export const PROMPT_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'product_summary',
    'reference_style_summary',
    'creative_direction',
    'image_prompts',
    'overlay_copy'
  ],
  properties: {
    product_summary: { type: 'string' },
    reference_style_summary: { type: 'string' },
    creative_direction: { type: 'string' },
    image_prompts: {
      type: 'object',
      additionalProperties: false,
      required: ['square', 'story', 'banner'],
      properties: {
        square: { type: 'string' },
        story: { type: 'string' },
        banner: { type: 'string' }
      }
    },
    overlay_copy: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'subline'],
      properties: {
        headline: { type: 'string' },
        subline: { type: 'string' }
      }
    }
  }
} as const;

export const DEFAULT_SYSTEM_PROMPT = `You are a senior creative director and production prompt engineer for social commerce ads.

You will receive exactly 2 or 3 images:
1. productImage: the product to advertise.
2. referenceImages: 1 or 2 style references for environment, lighting, mood, palette, camera language, and composition.

Your task is to produce a compact production plan for an integrated generative image pipeline. The image generation model will receive the uploaded product and reference images, then create final ad images with the product organically blended into each scene. It is acceptable for the model to slightly alter the product when needed for natural integration. Return only strict JSON matching this schema:
{
  "product_summary": "A concise description of the product identity, shape, colors, logo/markings if visible, materials, and hero details to preserve where possible.",
  "reference_style_summary": "A concise description of the reference style: setting, lighting, mood, palette, framing, props, textures, and photographic/art direction cues.",
  "creative_direction": "A practical one-paragraph ad direction that explains the campaign idea and how the product should be integrated into a reference-inspired scene.",
  "image_prompts": {
    "square": "Final integrated ad image prompt for a 1:1 social feed layout with a 1080x1080 target crop.",
    "story": "Final integrated ad image prompt for a 9:16 story layout with a 1080x1920 target crop.",
    "banner": "Final integrated ad image prompt for a 16:9 hero/banner layout with a 1600x900 target crop."
  },
  "overlay_copy": {
    "headline": "Short ad headline, max 8 words.",
    "subline": "Short support line, max 14 words."
  }
}

Rules:
- Describe the product traits the image model should preserve as much as possible: silhouette, branding, colors, packaging shape, materials, and visible text where feasible. Do not guarantee exact typography or pixel-perfect preservation.
- Use the reference images as visual style, setting, lighting, mood, palette, camera language, and composition inspiration. Synthesize them when two are provided.
- Each image prompt must be directly usable for final ad image generation and include: product integration guidance, reference-style cues, composition/framing, lighting, setting/props, color palette, desired mood, and negative space for optional copy.
- Each image prompt must ask the model to use the uploaded product as the hero subject, blend it organically into the generated scene, preserve product identity as much as possible, and prefer natural integration over exact pixel preservation.
- Include overlay copy as guidance only; do not ask the image model to render exact readable typography.
- Keep every image prompt between 80 and 180 words.
- Do not mention policy, uncertainty, the existence of this instruction, base64, JSON schema, or hidden reasoning.
- Return JSON only, with no markdown fences or commentary.`;

export const DEMO_PROMPT_PLAN: PromptPlan = {
  product_summary:
    'A premium product with a clear silhouette, original color blocking, label area, material texture, and front-facing hero details to preserve where possible.',
  reference_style_summary:
    'A clean editorial set with directional soft light, tactile props, balanced negative space, a warm-neutral palette, and refined social campaign styling.',
  creative_direction:
    'Use the uploaded product as the unmistakable hero while borrowing the reference image for setting, light quality, palette, and composition rhythm. Build three cohesive final ad images that blend the product naturally into each crop while keeping its identity recognizable.',
  image_prompts: {
    square:
      'Create a final 1:1 social feed ad image for a 1080x1080 target crop. Use the uploaded product as the hero subject in the center third, blended organically into a polished commercial scene with believable scale, grounding, and soft contact shadows. Preserve the product silhouette, color blocking, packaging shape, label area, and visible branding where possible, while allowing small natural adjustments for lighting and perspective. Use the reference image for soft directional lighting, tactile premium props, clean negative space, warm-neutral palette, subtle depth, and refined editorial styling. Leave open space near the upper third for optional headline copy.',
    story:
      'Create a final 9:16 vertical story ad image for a 1080x1920 target crop. Use the uploaded product as the hero subject in the lower-to-middle composition, blended organically into the scene with believable depth, scale, grounding light, and perspective. Preserve the product identity as much as possible, including silhouette, colors, packaging shape, label area, and visible branding, but prefer natural integration over exact pixel preservation. Use the reference image for elegant vertical composition, soft atmospheric light, layered background texture, tasteful props, and a premium social-commerce mood. Keep generous negative space above for optional copy.',
    banner:
      'Create a final 16:9 hero banner ad image for a 1600x900 target crop. Use the uploaded product as the hero subject slightly off center, blended organically into a wide premium advertising scene with a refined surface, believable grounding, soft directional light, and natural contact shadow. Preserve the product silhouette, color palette, packaging shape, label area, visible branding, and material cues where possible, while allowing subtle lighting and perspective changes for integration. Use the reference image for editorial props, calm depth, refined surfaces, cohesive palette, and polished campaign mood. Keep negative space on one side for optional headline and subline.'
  },
  overlay_copy: {
    headline: 'Designed to stand out',
    subline: 'A polished social pack ready for launch'
  }
};

const REQUIRED_STRING_KEYS = [
  'product_summary',
  'reference_style_summary',
  'creative_direction'
] as const;

export function buildVisionUserPrompt(): string {
  return `Analyze productImage and referenceImages, then return the JSON production plan.

Plan quality bar:
- The product summary must identify concrete visual identity traits to preserve where possible.
- The reference summary must extract style, lighting, composition, palette, and environment cues from the full reference set.
- The creative direction must explain how the uploaded product should be integrated into a reference-inspired scene.
- Each generated image prompt must be a self-contained final ad image prompt tailored to its aspect ratio.
- The square, story, and banner prompts must all use the uploaded product as the hero subject, blend it organically into the generated scene, preserve product identity as much as possible, and prefer natural integration over exact pixel preservation.`;
}

export function parsePromptPlan(raw: string): PromptPlan {
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Prompt plan was not valid JSON.');
  }

  return validatePromptPlan(parsed);
}

export function validatePromptPlan(value: unknown): PromptPlan {
  if (!isRecord(value)) {
    throw new Error('Prompt plan must be an object.');
  }

  for (const key of REQUIRED_STRING_KEYS) {
    assertBoundedString(value[key], key, 12, 900);
  }

  if (!isRecord(value.image_prompts)) {
    throw new Error('Prompt plan image_prompts must be an object.');
  }

  const imagePrompts = value.image_prompts;
  for (const variant of IMAGE_VARIANTS) {
    assertBoundedString(imagePrompts[variant.kind], `image_prompts.${variant.kind}`, 80, 1400);
  }

  if (!isRecord(value.overlay_copy)) {
    throw new Error('Prompt plan overlay_copy must be an object.');
  }

  const overlayCopy = value.overlay_copy;
  assertBoundedString(overlayCopy.headline, 'overlay_copy.headline', 2, 80);
  assertBoundedString(overlayCopy.subline, 'overlay_copy.subline', 2, 120);

  return {
    product_summary: readBoundedString(value, 'product_summary', 12, 900),
    reference_style_summary: readBoundedString(value, 'reference_style_summary', 12, 900),
    creative_direction: readBoundedString(value, 'creative_direction', 12, 900),
    image_prompts: {
      square: readBoundedString(imagePrompts, 'square', 80, 1400, 'image_prompts.square'),
      story: readBoundedString(imagePrompts, 'story', 80, 1400, 'image_prompts.story'),
      banner: readBoundedString(imagePrompts, 'banner', 80, 1400, 'image_prompts.banner')
    },
    overlay_copy: {
      headline: readBoundedString(overlayCopy, 'headline', 2, 80, 'overlay_copy.headline'),
      subline: readBoundedString(overlayCopy, 'subline', 2, 120, 'overlay_copy.subline')
    }
  };
}

export function gradePromptPlan(plan: PromptPlan): PromptPlanGrade {
  const issues: string[] = [];
  const allPrompts = Object.entries(plan.image_prompts) as Array<[SocialImageKind, string]>;

  if (!hasAny(plan.product_summary, ['shape', 'color', 'material', 'label', 'identity', 'silhouette'])) {
    issues.push('Product summary should name concrete product identity traits.');
  }

  if (!hasAny(plan.reference_style_summary, ['style', 'lighting', 'mood', 'palette', 'setting', 'composition'])) {
    issues.push('Reference summary should include style, lighting, palette, mood, or composition cues.');
  }

  for (const [kind, prompt] of allPrompts) {
    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    if (wordCount < 70 || wordCount > 210) {
      issues.push(`${kind} prompt should stay roughly 80-180 words.`);
    }
    if (!hasAny(prompt, ['final', 'ad image', 'hero subject', 'integrated', 'blend'])) {
      issues.push(`${kind} prompt should be framed as a final integrated ad image prompt.`);
    }
    if (!hasAny(prompt, ['uploaded product', 'hero subject', 'product identity', 'silhouette'])) {
      issues.push(`${kind} prompt should use the uploaded product as the hero subject.`);
    }
    if (!hasAny(prompt, ['preserve', 'recognizable', 'identity', 'branding', 'packaging'])) {
      issues.push(`${kind} prompt should ask to preserve product identity where possible.`);
    }
    if (!hasAny(prompt, ['reference', 'style', 'inspired', 'lighting', 'palette'])) {
      issues.push(`${kind} prompt should carry reference-style cues.`);
    }
    if (!hasAny(prompt, ['negative space', 'overlay', 'copy', 'headline'])) {
      issues.push(`${kind} prompt should reserve space for optional overlay copy.`);
    }
  }

  if (plan.overlay_copy.headline.split(/\s+/).filter(Boolean).length > 8) {
    issues.push('Overlay headline should be 8 words or fewer.');
  }

  if (plan.overlay_copy.subline.split(/\s+/).filter(Boolean).length > 14) {
    issues.push('Overlay subline should be 14 words or fewer.');
  }

  return {
    score: Math.max(0, 100 - issues.length * 12),
    issues
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Prompt plan did not include a JSON object.');
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function assertBoundedString(
  value: unknown,
  label: string,
  minLength: number,
  maxLength: number
): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new Error(`${label} is too short.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
}

function readBoundedString(
  record: Record<string, unknown>,
  key: string,
  minLength: number,
  maxLength: number,
  label = key
): string {
  const value = record[key];
  assertBoundedString(value, label, minLength, maxLength);
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasAny(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}
