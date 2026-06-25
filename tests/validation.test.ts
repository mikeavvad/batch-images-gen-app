import { describe, expect, it } from 'vitest';
import { DEFAULT_SYSTEM_PROMPT } from '../src/lib/prompt';
import {
  RequestValidationError,
  fileToDataUrl,
  validateGenerateFormData,
  validateImageField
} from '../src/lib/server/validation';

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function imageFile(name = 'image.png') {
  return new File([pngBytes], name, { type: 'image/png' });
}

describe('upload validation', () => {
  it('accepts productImage and referenceImage fields', () => {
    const formData = new FormData();
    formData.set('productImage', imageFile('product.png'));
    formData.set('referenceImage', imageFile('reference.png'));

    const validated = validateGenerateFormData(formData);

    expect(validated.productImage.name).toBe('product.png');
    expect(validated.referenceImage.name).toBe('reference.png');
    expect(validated.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('rejects missing required image fields', () => {
    expect(() => validateImageField(null, 'productImage')).toThrow(RequestValidationError);
  });

  it('rejects non-image uploads', () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

    expect(() => validateImageField(file, 'productImage')).toThrow(/PNG, JPEG, or WebP/);
  });

  it('converts files to data URLs', async () => {
    await expect(fileToDataUrl(imageFile())).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
