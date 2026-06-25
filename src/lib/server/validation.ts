import { DEFAULT_SYSTEM_PROMPT } from '$lib/prompt';

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_SYSTEM_PROMPT_CHARS = 7000;

export interface ValidatedGenerateInput {
  productImage: File;
  referenceImage: File;
  systemPrompt: string;
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
  const referenceImage = validateImageField(formData.get('referenceImage'), 'referenceImage');
  const systemPrompt = validateSystemPrompt(formData.get('systemPrompt'));

  return {
    productImage,
    referenceImage,
    systemPrompt
  };
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

export function validateSystemPrompt(value: FormDataEntryValue | null): string {
  if (value === null || value instanceof File) {
    return DEFAULT_SYSTEM_PROMPT;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_SYSTEM_PROMPT;
  }

  if (trimmed.length > MAX_SYSTEM_PROMPT_CHARS) {
    throw new RequestValidationError(
      `systemPrompt must be ${MAX_SYSTEM_PROMPT_CHARS} characters or fewer.`
    );
  }

  return trimmed;
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
