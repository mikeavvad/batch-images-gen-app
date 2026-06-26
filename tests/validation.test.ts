import { describe, expect, it } from 'vitest';
import {
  RequestValidationError,
  fileToDataUrl,
  validateGenerateFormData,
  validateImageField,
  validateReferenceImages
} from '../src/lib/server/validation';

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function imageFile(name = 'image.png') {
  return new File([pngBytes], name, { type: 'image/png' });
}

describe('upload validation', () => {
  it('accepts productImage and 1-2 referenceImages fields', () => {
    const formData = new FormData();
    formData.set('productImage', imageFile('product.png'));
    formData.append('referenceImages', imageFile('reference-1.png'));
    formData.append('referenceImages', imageFile('reference-2.png'));

    const validated = validateGenerateFormData(formData);

    expect(validated.productImage.name).toBe('product.png');
    expect(validated.referenceImages.map((file) => file.name)).toEqual([
      'reference-1.png',
      'reference-2.png'
    ]);
  });

  it('rejects missing required image fields', () => {
    expect(() => validateImageField(null, 'productImage')).toThrow(RequestValidationError);
  });

  it('rejects non-image uploads', () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

    expect(() => validateImageField(file, 'productImage')).toThrow(/PNG, JPEG, or WebP/);
  });

  it('rejects reference image collections outside the 1-2 range', () => {
    expect(() => validateReferenceImages([])).toThrow(/exactly 1 or 2 images/);
    expect(() =>
      validateReferenceImages([imageFile('one.png'), imageFile('two.png'), imageFile('three.png')])
    ).toThrow(/exactly 1 or 2 images/);
  });

  it('converts files to data URLs', async () => {
    await expect(fileToDataUrl(imageFile())).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
