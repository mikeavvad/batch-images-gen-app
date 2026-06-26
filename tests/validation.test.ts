import { describe, expect, it } from 'vitest';
import {
  RequestValidationError,
  MAX_PRODUCT_IMAGES,
  fileToDataUrl,
  validateGenerateFormData,
  validateImageField,
  validateProductImages,
  validateReferenceImages
} from '../src/lib/server/validation';

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function imageFile(name = 'image.png') {
  return new File([pngBytes], name, { type: 'image/png' });
}

describe('upload validation', () => {
  it('accepts multiple productImages and 1-2 referenceImages fields', () => {
    const formData = new FormData();
    formData.append('productImages', imageFile('product-1.png'));
    formData.append('productImages', imageFile('product-2.png'));
    formData.append('referenceImages', imageFile('reference-1.png'));
    formData.append('referenceImages', imageFile('reference-2.png'));

    const validated = validateGenerateFormData(formData);

    expect(validated.productImages.map((file) => file.name)).toEqual([
      'product-1.png',
      'product-2.png'
    ]);
    expect(validated.referenceImages.map((file) => file.name)).toEqual([
      'reference-1.png',
      'reference-2.png'
    ]);
  });

  it('rejects missing required image fields', () => {
    expect(() => validateImageField(null, 'productImages[0]')).toThrow(RequestValidationError);
    expect(() => validateProductImages([])).toThrow(/at least 1 image/);
  });

  it('rejects non-image uploads', () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

    expect(() => validateProductImages([file])).toThrow(/PNG, JPEG, or WebP/);
  });

  it('rejects oversized product image uploads', () => {
    const file = imageFile('large.png');
    Object.defineProperty(file, 'size', {
      configurable: true,
      value: 8 * 1024 * 1024 + 1
    });

    expect(() => validateProductImages([file])).toThrow(/8 MB or smaller/);
  });

  it('rejects product image collections over the max count', () => {
    expect(() =>
      validateProductImages(
        Array.from({ length: MAX_PRODUCT_IMAGES + 1 }, (_, index) => imageFile(`product-${index}.png`))
      )
    ).toThrow(`${MAX_PRODUCT_IMAGES} images or fewer`);
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
