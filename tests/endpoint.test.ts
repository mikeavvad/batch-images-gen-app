import { describe, expect, it } from 'vitest';
import { POST } from '../src/routes/api/generate/+server';

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function buildRequest(formData: FormData) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: formData
  });
}

async function readEvents(response: Response) {
  const text = await response.text();

  return text
    .trim()
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n');
      const event = lines
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        .trim();
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trimStart())
        .join('\n');

      return {
        event,
        data: JSON.parse(data)
      };
    });
}

describe('/api/generate', () => {
  it('accepts multiple productImages and streams one post per product without an API key', async () => {
    const formData = new FormData();
    formData.append('productImages', new File([pngBytes], 'product-1.png', { type: 'image/png' }));
    formData.append('productImages', new File([pngBytes], 'product-2.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference.png', { type: 'image/png' }));

    const response = await POST({
      request: buildRequest(formData),
      fetch
    } as Parameters<typeof POST>[0]);
    const events = await readEvents(response);
    const posts = events.filter((event) => event.event === 'post').map((event) => event.data);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(events.filter((event) => event.event === 'status').map((event) => event.data)).toEqual([
      'accepted',
      'validating',
      'generating',
      'generating-product-1-of-2',
      'generating-product-2-of-2',
      'finalizing'
    ]);
    expect(posts).toHaveLength(2);
    expect(posts.map((post) => post.productName)).toEqual(['product-1.png', 'product-2.png']);
    expect(posts[0].result.mode).toBe('fallback');
    expect(posts[0].result.images).toHaveLength(1);
    expect(posts[0].image.kind).toBe('square');
    expect(posts[0].image.fileExtension).toBe('svg');
    expect(posts[0].result.warnings[0]).toContain('OPENAI_API_KEY');
    expect(events.at(-1)).toEqual({
      event: 'done',
      data: {
        generatedCount: 2,
        failedCount: 0
      }
    });
  });

  it('streams validation errors for missing productImages', async () => {
    const formData = new FormData();
    formData.append('referenceImages', new File([pngBytes], 'reference.png', { type: 'image/png' }));

    const response = await POST({
      request: buildRequest(formData),
      fetch
    } as Parameters<typeof POST>[0]);
    const events = await readEvents(response);

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(events).toEqual([
      {
        event: 'error',
        data: expect.objectContaining({
          error: expect.stringContaining('productImages')
        })
      }
    ]);
  });

  it('rejects requests with more than two reference images', async () => {
    const formData = new FormData();
    formData.append('productImages', new File([pngBytes], 'product.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference-1.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference-2.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference-3.png', { type: 'image/png' }));

    const response = await POST({
      request: buildRequest(formData),
      fetch
    } as Parameters<typeof POST>[0]);
    const events = await readEvents(response);

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(events[0]).toEqual({
      event: 'error',
      data: expect.objectContaining({
        error: expect.stringContaining('referenceImages')
      })
    });
  });
});
