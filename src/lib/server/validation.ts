import { Buffer } from 'node:buffer';

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ValidatedGenerateInput {
  productImage: File;
  referenceImages: File[];
}

export class RequestValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

export function validateGenerateFormData(formData: FormData): ValidatedGenerateInput {
  const productImage = validateImageField(formData.get('productImage'), 'productImage');
  const referenceImages = validateReferenceImages(formData.getAll('referenceImages'));

  return {
    productImage,
    referenceImages
  };
}

export function validateReferenceImages(values: FormDataEntryValue[]): File[] {
  if (values.length < 1 || values.length > 2) {
    throw new RequestValidationError('referenceImages must include exactly 1 or 2 images.');
  }

  return values.map((value, index) => validateImageField(value, `referenceImages[${index}]`));
}

export function validateImageField(value: FormDataEntryValue | null, fieldName: string): File {
  if (!isFileLike(value) || value.size === 0) {
    throw new RequestValidationError(`${fieldName} is required.`);
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(value.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new RequestValidationError(
      `${fieldName} must be a PNG, JPEG, or WebP image.`
    );
  }

  if (value.size > MAX_IMAGE_BYTES) {
    throw new RequestValidationError(
      `${fieldName} must be ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)} MB or smaller.`
    );
  }

  return value;
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).size === 'number' &&
    typeof (value as File).type === 'string'
  );
}
