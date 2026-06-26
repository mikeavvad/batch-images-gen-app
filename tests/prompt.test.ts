import { describe, expect, it } from 'vitest';
import {
  DEMO_PROMPT_PLAN,
  PROMPT_PLAN_SCHEMA,
  gradePromptPlan,
  parsePromptPlan,
  validatePromptPlan
} from '../src/lib/prompt';

describe('prompt contract', () => {
  it('parses fenced JSON into a prompt plan', () => {
    const raw = `\`\`\`json
${JSON.stringify(DEMO_PROMPT_PLAN)}
\`\`\``;

    expect(parsePromptPlan(raw)).toEqual(DEMO_PROMPT_PLAN);
  });

  it('rejects prompt plans missing the square prompt', () => {
    expect(() =>
      validatePromptPlan({
        ...DEMO_PROMPT_PLAN,
        image_prompts: {}
      })
    ).toThrow(/square/);
  });

  it('requires only the square prompt in the provider schema', () => {
    expect(PROMPT_PLAN_SCHEMA.properties.image_prompts.required).toEqual(['square']);
    expect(PROMPT_PLAN_SCHEMA.properties.image_prompts.properties).toEqual({
      square: { type: 'string' }
    });
  });

  it('grades the demo prompt plan as usable', () => {
    const grade = gradePromptPlan(DEMO_PROMPT_PLAN);

    expect(grade.score).toBeGreaterThanOrEqual(75);
    expect(grade.issues).toHaveLength(0);
  });
});
