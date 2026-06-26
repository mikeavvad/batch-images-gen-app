import { describe, expect, it, vi } from 'vitest';
import {
  applyReferenceUploadSelection,
  applyUploadSelection,
  createPageState,
  MAX_CLIENT_WARN_BYTES,
  requestGeneration
} from '../src/routes/social-pack/state';

describe('social pack state', () => {
  it('rejects non-image uploads and asks the caller to reset the input value', () => {
    const state = {
      ...createPageState(),
      productFile: new File(['old-image'], 'old.png', { type: 'image/png' }),
      productPreview: 'blob:existing-product'
    };
    const revokeObjectUrl = vi.fn();

    const result = applyUploadSelection(
      state,
      'product',
      new File(['not-an-image'], 'notes.txt', { type: 'text/plain' }),
      vi.fn(),
      revokeObjectUrl
    );

    expect(result.resetInputValue).toBe(true);
    expect(result.nextState.productFile).toBeNull();
    expect(result.nextState.productPreview).toBe('');
    expect(result.nextState.errorMessage).toBe('Please choose an image file.');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:existing-product');
  });

  it('revokes previous previews when replacing reference images from one picker', () => {
    const createObjectUrl = vi
      .fn()
      .mockReturnValueOnce('blob:new-reference-one')
      .mockReturnValueOnce('blob:new-reference-two');
    const revokeObjectUrl = vi.fn();
    const state = {
      ...createPageState(),
      referenceFiles: [
        new File(['before-one'], 'before-1.png', { type: 'image/png' }),
        new File(['before-two'], 'before-2.png', { type: 'image/png' })
      ] as [File | null, File | null],
      referencePreviews: ['blob:old-reference-one', 'blob:old-reference-two'] as [string, string],
      errorMessage: 'previous error',
      clientWarning: 'previous warning'
    };

    const result = applyReferenceUploadSelection(
      state,
      [
        new File(['after-one'], 'after-1.png', { type: 'image/png' }),
        new File(['after-two'], 'after-2.png', { type: 'image/png' })
      ],
      createObjectUrl,
      revokeObjectUrl
    );

    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-reference-one');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-reference-two');
    expect(result.nextState.referencePreviews).toEqual([
      'blob:new-reference-one',
      'blob:new-reference-two'
    ]);
    expect(result.nextState.errorMessage).toBe('');
    expect(result.nextState.clientWarning).toBe('');
  });

  it('rejects more than two reference images and asks the caller to reset the input value', () => {
    const result = applyReferenceUploadSelection(
      createPageState(),
      [
        new File(['one'], 'one.png', { type: 'image/png' }),
        new File(['two'], 'two.png', { type: 'image/png' }),
        new File(['three'], 'three.png', { type: 'image/png' })
      ],
      vi.fn(),
      vi.fn()
    );

    expect(result.resetInputValue).toBe(true);
    expect(result.nextState.errorMessage).toBe('Choose up to 2 reference images.');
    expect(result.nextState.referenceFiles).toEqual([null, null]);
  });

  it('sets the large upload warning for oversized image files without resetting the input', () => {
    const largeImage = new File(['large-image'], 'large.png', { type: 'image/png' });
    Object.defineProperty(largeImage, 'size', {
      configurable: true,
      value: MAX_CLIENT_WARN_BYTES + 1
    });

    const result = applyUploadSelection(
      createPageState(),
      'product',
      largeImage,
      vi.fn().mockReturnValue('blob:large-product'),
      vi.fn()
    );

    expect(result.resetInputValue).toBe(false);
    expect(result.nextState.clientWarning).toBe(
      'Large uploads may be slower. The server accepts images up to 8 MB each.'
    );
  });

  it('submits the expected FormData fields and falls back to square when no image kind is returned', async () => {
    const productFile = new File(['product'], 'product.png', { type: 'image/png' });
    const referenceFiles = [
      new File(['reference-one'], 'reference-1.png', { type: 'image/png' }),
      new File(['reference-two'], 'reference-2.png', { type: 'image/png' })
    ] as [File | null, File | null];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const formData = init?.body;

      expect(init?.method).toBe('POST');
      expect(formData).toBeInstanceOf(FormData);
      expect((formData as FormData).get('productImage')).toBe(productFile);
      expect((formData as FormData).getAll('referenceImages')).toEqual(referenceFiles);
      expect((formData as FormData).has('systemPrompt')).toBe(false);

      return new Response(
        JSON.stringify({
          mode: 'generated',
          promptPlan: { headline: 'Keep it sharp' },
          promptGrade: { score: 92, issues: [] },
          images: []
        })
      );
    });

    const response = await requestGeneration(
      {
        productFile,
        referenceFiles
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      '/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );
    expect(response.selectedKind).toBe('square');
    expect(response.result.images).toEqual([]);
  });

  it('propagates server errors from the generation response payload', async () => {
    const productFile = new File(['product'], 'product.png', { type: 'image/png' });
    const referenceFiles = [new File(['reference'], 'reference.png', { type: 'image/png' }), null] as [
      File | null,
      File | null
    ];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'Provider timed out.' }), { status: 504 }));

    await expect(
      requestGeneration(
        {
          productFile,
          referenceFiles
        },
        fetcher
      )
    ).rejects.toThrow('Provider timed out.');
  });

  it('requires at least one reference image before submitting', async () => {
    await expect(
      requestGeneration(
        {
          productFile: new File(['product'], 'product.png', { type: 'image/png' }),
          referenceFiles: [null, null]
        },
        vi.fn<typeof fetch>()
      )
    ).rejects.toThrow('Add 1 or 2 reference images.');
  });
});
