import { describe, expect, it, vi } from 'vitest';
import {
  applyReferenceUploadSelection,
  applyUploadSelection,
  createPageState,
  MAX_CLIENT_WARN_BYTES,
  requestGeneration
} from '../src/routes/social-pack/state';

function streamResponse(events: Array<{ event: string; data: unknown }>, init?: ResponseInit) {
  return new Response(
    events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''),
    init
  );
}

function encodeEvent(event: string, data: unknown, lineBreak = '\n') {
  return `event: ${event}${lineBreak}data: ${JSON.stringify(data)}${lineBreak}${lineBreak}`;
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error('Timed out waiting for stream assertion.');
}

describe('social pack state', () => {
  it('rejects non-image uploads and asks the caller to reset the input value', () => {
    const state = {
      ...createPageState(),
      productFiles: [new File(['old-image'], 'old.png', { type: 'image/png' })],
      productPreviews: ['blob:existing-product']
    };
    const revokeObjectUrl = vi.fn();

    const result = applyUploadSelection(
      state,
      'product',
      [new File(['not-an-image'], 'notes.txt', { type: 'text/plain' })],
      vi.fn(),
      revokeObjectUrl
    );

    expect(result.resetInputValue).toBe(true);
    expect(result.nextState.productFiles).toEqual([]);
    expect(result.nextState.productPreviews).toEqual([]);
    expect(result.nextState.errorMessage).toBe('Please choose image files only.');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:existing-product');
  });

  it('creates multiple product previews and revokes old product previews on replacement', () => {
    const createObjectUrl = vi
      .fn()
      .mockReturnValueOnce('blob:new-product-one')
      .mockReturnValueOnce('blob:new-product-two');
    const revokeObjectUrl = vi.fn();
    const state = {
      ...createPageState(),
      productFiles: [
        new File(['before-one'], 'before-1.png', { type: 'image/png' }),
        new File(['before-two'], 'before-2.png', { type: 'image/png' })
      ],
      productPreviews: ['blob:old-product-one', 'blob:old-product-two']
    };

    const result = applyUploadSelection(
      state,
      'product',
      [
        new File(['after-one'], 'after-1.png', { type: 'image/png' }),
        new File(['after-two'], 'after-2.png', { type: 'image/png' })
      ],
      createObjectUrl,
      revokeObjectUrl
    );

    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-product-one');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:old-product-two');
    expect(result.nextState.productPreviews).toEqual([
      'blob:new-product-one',
      'blob:new-product-two'
    ]);
    expect(result.nextState.productFiles.map((file) => file.name)).toEqual([
      'after-1.png',
      'after-2.png'
    ]);
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
      [largeImage],
      vi.fn().mockReturnValue('blob:large-product'),
      vi.fn()
    );

    expect(result.resetInputValue).toBe(false);
    expect(result.nextState.clientWarning).toBe(
      'Large uploads may be slower. The server accepts images up to 8 MB each.'
    );
  });

  it('submits the expected FormData fields and appends streamed posts as they arrive', async () => {
    const productFiles = [
      new File(['product-one'], 'product-1.png', { type: 'image/png' }),
      new File(['product-two'], 'product-2.png', { type: 'image/png' })
    ];
    const referenceFiles = [
      new File(['reference-one'], 'reference-1.png', { type: 'image/png' }),
      new File(['reference-two'], 'reference-2.png', { type: 'image/png' })
    ] as [File | null, File | null];
    const onStatus = vi.fn();
    const onPost = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const formData = init?.body;

      expect(init?.method).toBe('POST');
      expect(formData).toBeInstanceOf(FormData);
      expect((formData as FormData).getAll('productImages')).toEqual(productFiles);
      expect((formData as FormData).getAll('referenceImages')).toEqual(referenceFiles);
      expect((formData as FormData).has('systemPrompt')).toBe(false);

      return streamResponse([
        { event: 'status', data: 'accepted' },
        { event: 'status', data: 'generating' },
        {
          event: 'post',
          data: {
            index: 0,
            productName: 'product-1.png',
            mode: 'generated',
            result: {
              mode: 'generated',
              promptPlan: { headline: 'Keep it sharp' },
              promptGrade: { score: 92, issues: [] },
              images: []
            },
            image: {
              kind: 'square',
              url: '/product-1.png',
              fileExtension: 'png',
              aspect: '1:1',
              targetWidth: 1080,
              targetHeight: 1080
            }
          }
        },
        { event: 'done', data: { generatedCount: 1, failedCount: 0 } }
      ]);
    });

    const response = await requestGeneration(
      {
        productFiles,
        referenceFiles
      },
      fetcher,
      onStatus,
      onPost
    );

    expect(fetcher).toHaveBeenCalledWith(
      '/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );
    expect(onStatus).toHaveBeenCalledWith('Upload accepted.');
    expect(onStatus).toHaveBeenCalledWith('Generating posts.');
    expect(onPost).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 0,
        productName: 'product-1.png'
      })
    );
    expect(response.results).toHaveLength(1);
    expect(response.results[0].image.url).toBe('/product-1.png');
  });

  it('handles CRLF streamed events as each product result lands', async () => {
    const productFiles = [
      new File(['product-one'], 'product-1.png', { type: 'image/png' }),
      new File(['product-two'], 'product-2.png', { type: 'image/png' })
    ];
    const referenceFiles = [new File(['reference'], 'reference.png', { type: 'image/png' }), null] as [
      File | null,
      File | null
    ];
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const onPost = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(streamController) {
            controller = streamController;
          }
        })
      )
    );

    const responsePromise = requestGeneration(
      {
        productFiles,
        referenceFiles
      },
      fetcher,
      undefined,
      onPost
    );

    await waitFor(() => controller !== undefined);

    controller?.enqueue(
      encoder.encode(
        encodeEvent(
          'post',
          {
            index: 0,
            productName: 'product-1.png',
            result: {
              mode: 'generated',
              promptPlan: { creative_direction: 'First prompt' },
              promptGrade: { score: 92, issues: [] },
              images: []
            },
            image: {
              kind: 'square',
              url: '/product-1.png',
              fileExtension: 'png',
              aspect: '1:1',
              targetWidth: 1080,
              targetHeight: 1080
            }
          },
          '\r\n'
        )
      )
    );

    await waitFor(() => onPost.mock.calls.length === 1);
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ productName: 'product-1.png' }));

    controller?.enqueue(
      encoder.encode(
        encodeEvent(
          'post',
          {
            index: 1,
            productName: 'product-2.png',
            result: {
              mode: 'generated',
              promptPlan: { creative_direction: 'Second prompt' },
              promptGrade: { score: 90, issues: [] },
              images: []
            },
            image: {
              kind: 'square',
              url: '/product-2.png',
              fileExtension: 'png',
              aspect: '1:1',
              targetWidth: 1080,
              targetHeight: 1080
            }
          },
          '\r\n'
        )
      )
    );
    controller?.enqueue(
      encoder.encode(encodeEvent('done', { generatedCount: 2, failedCount: 0 }, '\r\n'))
    );
    controller?.close();

    const response = await responsePromise;

    expect(onPost).toHaveBeenCalledTimes(2);
    expect(response.results.map((result) => result.productName)).toEqual([
      'product-1.png',
      'product-2.png'
    ]);
  });

  it('propagates server errors from streamed error events', async () => {
    const productFiles = [new File(['product'], 'product.png', { type: 'image/png' })];
    const referenceFiles = [new File(['reference'], 'reference.png', { type: 'image/png' }), null] as [
      File | null,
      File | null
    ];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      streamResponse([{ event: 'error', data: { error: 'Provider timed out.' } }], { status: 504 })
    );

    await expect(
      requestGeneration(
        {
          productFiles,
          referenceFiles
        },
        fetcher
      )
    ).rejects.toThrow('Provider timed out.');
  });

  it('rejects truncated streams even after receiving partial events', async () => {
    const productFiles = [new File(['product'], 'product.png', { type: 'image/png' })];
    const referenceFiles = [new File(['reference'], 'reference.png', { type: 'image/png' }), null] as [
      File | null,
      File | null
    ];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      streamResponse([
        { event: 'status', data: 'generating' },
        {
          event: 'post',
          data: {
            index: 0,
            productName: 'product.png',
            mode: 'generated',
            result: {
              mode: 'generated',
              promptPlan: { headline: 'Keep it sharp' },
              promptGrade: { score: 92, issues: [] },
              images: []
            },
            image: {
              kind: 'square',
              url: '/product.png',
              fileExtension: 'png',
              aspect: '1:1',
              targetWidth: 1080,
              targetHeight: 1080
            }
          }
        }
      ])
    );

    await expect(
      requestGeneration(
        {
          productFiles,
          referenceFiles
        },
        fetcher
      )
    ).rejects.toThrow('Generation stream ended before completion.');
  });

  it('rejects an unterminated final done event as a truncated stream', async () => {
    const productFiles = [new File(['product'], 'product.png', { type: 'image/png' })];
    const referenceFiles = [new File(['reference'], 'reference.png', { type: 'image/png' }), null] as [
      File | null,
      File | null
    ];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('event: done\ndata: {"generatedCount":0,"failedCount":0}'));

    await expect(
      requestGeneration(
        {
          productFiles,
          referenceFiles
        },
        fetcher
      )
    ).rejects.toThrow('Generation stream ended before completion.');
  });

  it('requires at least one product image before submitting', async () => {
    await expect(
      requestGeneration(
        {
          productFiles: [],
          referenceFiles: [new File(['reference'], 'reference.png', { type: 'image/png' }), null]
        },
        vi.fn<typeof fetch>()
      )
    ).rejects.toThrow('Add at least one product image first.');
  });

  it('requires at least one reference image before submitting', async () => {
    await expect(
      requestGeneration(
        {
          productFiles: [new File(['product'], 'product.png', { type: 'image/png' })],
          referenceFiles: [null, null]
        },
        vi.fn<typeof fetch>()
      )
    ).rejects.toThrow('Add 1 or 2 reference images.');
  });
});
