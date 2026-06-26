import { describe, expect, it } from 'vitest';
import { POST } from '../src/routes/api/generate/+server';

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function buildRequest(formData: FormData) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: formData
  });
}

describe('/api/generate', () => {
  it('accepts productImage and referenceImages uploads and returns demo fallback without an API key', async () => {
    const formData = new FormData();
    formData.set('productImage', new File([pngBytes], 'product.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference.png', { type: 'image/png' }));

    const response = await POST({
      request: buildRequest(formData),
      fetch
    } as Parameters<typeof POST>[0]);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe('fallback');
    expect(payload.images).toHaveLength(3);
    expect(payload.images[0].fileExtension).toBe('svg');
    expect(payload.warnings[0]).toContain('OPENAI_API_KEY');
  });

  it('returns validation errors for missing productImage', async () => {
    const formData = new FormData();
    formData.append('referenceImages', new File([pngBytes], 'reference.png', { type: 'image/png' }));

    const response = await POST({
      request: buildRequest(formData),
      fetch
    } as Parameters<typeof POST>[0]);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('productImage');
  });

  it('rejects requests with more than two reference images', async () => {
    const formData = new FormData();
    formData.set('productImage', new File([pngBytes], 'product.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference-1.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference-2.png', { type: 'image/png' }));
    formData.append('referenceImages', new File([pngBytes], 'reference-3.png', { type: 'image/png' }));

    const response = await POST({
      request: buildRequest(formData),
      fetch
    } as Parameters<typeof POST>[0]);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('referenceImages');
  });
});
