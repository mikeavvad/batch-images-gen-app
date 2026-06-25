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

You will receive exactly two images:
1. productImage: the product to advertise.
2. referenceImage: a style reference for environment, lighting, mood, palette, camera language, and composition.

Your task is to produce a compact production plan that will later be sent to an image generation model. Return only strict JSON matching this schema:
{
  "product_summary": "A concise description of the product identity, shape, colors, logo/markings if visible, materials, and details that must be preserved.",
  "reference_style_summary": "A concise description of the reference style: setting, lighting, mood, palette, framing, props, textures, and photographic/art direction cues.",
  "creative_direction": "A practical one-paragraph ad direction that explains the campaign idea and how product fidelity and reference style should be combined.",
  "image_prompts": {
    "square": "Prompt for a 1:1 social feed layout with a 1080x1080 target crop.",
    "story": "Prompt for a 9:16 story layout with a 1080x1920 target crop.",
    "banner": "Prompt for a 16:9 hero/banner layout with a 1600x900 target crop."
  },
  "overlay_copy": {
    "headline": "Short ad headline, max 8 words.",
    "subline": "Short support line, max 14 words."
  }
}

Rules:
- Preserve the product's core shape, color, proportions, materials, visible logo/label, and identifying details.
- Use the reference image only as visual style and scene inspiration. Do not replace the product with any object from the reference image.
- Each image prompt must be directly usable for image generation and include: product fidelity instructions, reference-style cues, composition/framing, lighting, background/props, color palette, desired mood, and a note to leave clean negative space for optional overlay copy.
- Include overlay copy as guidance only; do not ask the image model to render exact readable typography.
- Keep every image prompt between 80 and 180 words.
- Do not mention policy, uncertainty, the existence of this instruction, base64, JSON schema, or hidden reasoning.
- Return JSON only, with no markdown fences or commentary.`;

export const DEMO_PROMPT_PLAN: PromptPlan = {
  product_summary:
    'A premium product with a clearly preserved silhouette, original color blocking, label area, material texture, and front-facing hero details.',
  reference_style_summary:
    'A clean editorial set with directional soft light, tactile props, balanced negative space, a warm-neutral palette, and refined social campaign styling.',
  creative_direction:
    'Position the product as the unmistakable hero while borrowing the reference image for its setting, light quality, palette, and composition rhythm. Build three ad-ready crops that feel cohesive but tailored to their placement.',
  image_prompts: {
    square:
      'Create a 1:1 social feed ad composed for a 1080x1080 target crop. Preserve the product core shape, proportions, color, material texture, label zone, and identifying details exactly. Place it as the central hero on a refined editorial set inspired by the reference image: soft directional lighting, tactile premium props, clean negative space, warm-neutral palette, subtle depth, and polished commercial photography. Do not introduce a competing product. Leave open space near the upper third for optional headline overlay; do not render exact text.',
    story:
      'Create a 9:16 vertical story ad composed for a 1080x1920 target crop. Preserve the product identity, silhouette, colors, materials, visible markings, and hero details exactly. Use the reference image only for style: elegant vertical composition, soft atmospheric light, layered background texture, tasteful props, and a premium social-commerce mood. Keep the product in the lower-to-middle hero zone with generous negative space above for optional overlay copy. Add subtle foreground depth, clean spacing, and a confident campaign rhythm. Avoid clutter and do not render exact typography.',
    banner:
      'Create a 16:9 hero banner ad composed for a 1600x900 target crop. Preserve the product core form, color, material finish, label area, and identifying details exactly. Compose a wide premium advertising scene inspired by the reference image with soft directional lighting, editorial props, calm depth, refined surfaces, and a cohesive palette. Keep the product clear and dominant, with negative space on one side for optional headline and subline. Add subtle environmental texture and a polished campaign mood. Do not add readable text or a different product.'
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
  return `Analyze productImage and referenceImage, then return the JSON production plan.

Plan quality bar:
- The product summary must identify visual traits to preserve.
- The reference summary must extract style, lighting, composition, palette, and environment cues.
- The creative direction must explain how the output campaign combines product fidelity with reference-inspired art direction.
- Each generated image prompt must be self-contained, compact, and tailored to its aspect ratio.
- The square, story, and banner prompts must all remind the image model to preserve the product and use the reference only for style.`;
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

  if (!hasAny(plan.product_summary, ['preserve', 'shape', 'color', 'material', 'label', 'identity'])) {
    issues.push('Product summary should name concrete identity traits to preserve.');
  }

  if (!hasAny(plan.reference_style_summary, ['style', 'lighting', 'mood', 'palette', 'setting', 'composition'])) {
    issues.push('Reference summary should include style, lighting, palette, mood, or composition cues.');
  }

  for (const [kind, prompt] of allPrompts) {
    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    if (wordCount < 70 || wordCount > 210) {
      issues.push(`${kind} prompt should stay roughly 80-180 words.`);
    }
    if (!hasAny(prompt, ['preserve', 'maintain', 'keep', 'retain'])) {
      issues.push(`${kind} prompt should explicitly preserve the product.`);
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
