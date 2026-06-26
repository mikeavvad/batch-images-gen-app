import { describe, expect, it } from 'vitest';
import { DEMO_PROMPT_PLAN } from '../src/lib/prompt';
import type { GenerateResponse } from '../src/routes/social-pack/types';
import { getSelectedImage, getStatusLabel, labelFor } from '../src/routes/social-pack/helpers';

const resultFixture: GenerateResponse = {
  mode: 'generated',
  promptPlan: DEMO_PROMPT_PLAN,
  promptGrade: {
    score: 90,
    issues: []
  },
  images: [
    {
      kind: 'square',
      url: '/square.png',
      fileExtension: 'png',
      aspect: '1:1',
      targetWidth: 1080,
      targetHeight: 1080
    },
    {
      kind: 'story',
      url: '/story.png',
      fileExtension: 'png',
      aspect: '9:16',
      targetWidth: 1080,
      targetHeight: 1920
    }
  ]
};

describe('page helpers', () => {
  it('returns the selected image when the variant exists', () => {
    expect(getSelectedImage(resultFixture, 'story')?.url).toBe('/story.png');
  });

  it('falls back to the first image when the selected variant is missing', () => {
    expect(getSelectedImage(resultFixture, 'banner')?.url).toBe('/square.png');
  });

  it('maps status modes to the current pill labels', () => {
    expect(getStatusLabel('generated')).toBe('Generated');
    expect(getStatusLabel('fallback')).toBe('Demo fallback');
    expect(getStatusLabel(undefined)).toBe('Ready');
  });

  it('uses configured variant labels', () => {
    expect(labelFor('square')).not.toBe('square');
  });
});
