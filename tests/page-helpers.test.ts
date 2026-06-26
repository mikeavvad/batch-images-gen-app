import { describe, expect, it } from 'vitest';
import { DEMO_PROMPT_PLAN } from '../src/lib/prompt';
import type { GenerateResponse } from '../src/routes/social-pack/types';
import { getSocialPostImage, getStatusLabel, labelFor } from '../src/routes/social-pack/helpers';

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
    }
  ]
};
const squareImage = resultFixture.images[0]!;

describe('page helpers', () => {
  it('returns the square image as the single social post when available', () => {
    expect(getSocialPostImage(resultFixture)?.url).toBe('/square.png');
  });

  it('returns undefined when no generated images are available', () => {
    expect(
      getSocialPostImage({
        ...resultFixture,
        images: []
      })
    ).toBeUndefined();
  });

  it('maps batch state to the current pill labels', () => {
    expect(getStatusLabel()).toBe('Ready');
    expect(getStatusLabel({ isGenerating: true, results: [], productErrors: [] })).toBe(
      'Generating'
    );
    expect(
      getStatusLabel({
        results: [{ index: 0, productName: 'One', result: resultFixture, image: squareImage }],
        productErrors: []
      })
    ).toBe('Complete');
    expect(
      getStatusLabel({
        results: [
          {
            index: 0,
            productName: 'One',
            result: { ...resultFixture, mode: 'fallback' },
            image: squareImage
          }
        ],
        productErrors: []
      })
    ).toBe('Demo fallback');
    expect(
      getStatusLabel({
        results: [{ index: 0, productName: 'One', result: resultFixture, image: squareImage }],
        productErrors: [{ index: 1, productName: 'Two', error: 'Failed' }]
      })
    ).toBe('Partial');
    expect(
      getStatusLabel({
        results: [],
        productErrors: [{ index: 0, productName: 'One', error: 'Failed' }]
      })
    ).toBe('Failed');
  });

  it('uses configured variant labels', () => {
    expect(labelFor('square')).not.toBe('square');
  });
});
