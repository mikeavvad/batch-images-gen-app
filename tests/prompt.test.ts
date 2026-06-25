import { describe, expect, it } from 'vitest';
import { DEMO_PROMPT_PLAN, gradePromptPlan, parsePromptPlan, validatePromptPlan } from '../src/lib/prompt';

describe('prompt contract', () => {
  it('parses fenced JSON into a prompt plan', () => {
    const raw = `\`\`\`json
${JSON.stringify(DEMO_PROMPT_PLAN)}
\`\`\``;

    expect(parsePromptPlan(raw)).toEqual(DEMO_PROMPT_PLAN);
  });

  it('rejects prompt plans missing required variant prompts', () => {
    expect(() =>
      validatePromptPlan({
        ...DEMO_PROMPT_PLAN,
        image_prompts: {
          square: DEMO_PROMPT_PLAN.image_prompts.square,
          story: DEMO_PROMPT_PLAN.image_prompts.story
        }
      })
    ).toThrow(/banner/);
  });

  it('grades the demo prompt plan as usable', () => {
    const grade = gradePromptPlan(DEMO_PROMPT_PLAN);

    expect(grade.score).toBeGreaterThanOrEqual(75);
    expect(grade.issues).toHaveLength(0);
  });
});
