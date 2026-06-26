import { OPENAI_IMAGES_EDITS_URL, OPENAI_RESPONSES_URL } from './constants';

const RESPONSES_API_TIMEOUT_MS = 120000;
const IMAGES_EDIT_API_TIMEOUT_MS = 300000;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export async function callResponsesApi(
  fetchImpl: typeof fetch,
  apiKey: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const startedAt = Date.now();
  const model = typeof body.model === 'string' ? body.model : 'unknown';

  console.info('[openai-provider] Sending Responses API request.', {
    model
  });
  let response: Response;
  try {
    response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESPONSES_API_TIMEOUT_MS)
    });
  } catch (error) {
    console.warn('[openai-provider] Responses API request failed before response.', {
      model,
      durationMs: Date.now() - startedAt,
      error: summarizeRequestError(error)
    });
    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = extractProviderError(payload);
    console.warn('[openai-provider] Responses API request failed.', {
      model,
      status: response.status,
      code: error.code,
      durationMs: Date.now() - startedAt
    });
    throw new ProviderError(error.message, response.status, error.code);
  }

  console.info('[openai-provider] Responses API request succeeded.', {
    model,
    status: response.status,
    durationMs: Date.now() - startedAt
  });
  return payload;
}

export async function callImagesEditApi(
  fetchImpl: typeof fetch,
  apiKey: string,
  body: FormData
): Promise<unknown> {
  const startedAt = Date.now();
  const model = String(body.get('model') ?? 'unknown');
  const imageCount = body.getAll('image[]').length;

  console.info('[openai-provider] Sending Images Edit API request.', {
    model,
    imageCount
  });
  let response: Response;
  try {
    response = await fetchImpl(OPENAI_IMAGES_EDITS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body,
      signal: AbortSignal.timeout(IMAGES_EDIT_API_TIMEOUT_MS)
    });
  } catch (error) {
    console.warn('[openai-provider] Images Edit API request failed before response.', {
      model,
      imageCount,
      durationMs: Date.now() - startedAt,
      error: summarizeRequestError(error)
    });
    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = extractProviderError(payload);
    console.warn('[openai-provider] Images Edit API request failed.', {
      model,
      imageCount,
      status: response.status,
      code: error.code,
      durationMs: Date.now() - startedAt
    });
    throw new ProviderError(error.message, response.status, error.code);
  }

  console.info('[openai-provider] Images Edit API request succeeded.', {
    model,
    imageCount,
    status: response.status,
    durationMs: Date.now() - startedAt
  });
  return payload;
}

function extractProviderError(payload: unknown): { message: string; code?: string } {
  if (isRecord(payload) && isRecord(payload.error)) {
    return {
      message:
        typeof payload.error.message === 'string'
          ? payload.error.message
          : 'Provider request failed.',
      code: typeof payload.error.code === 'string' ? payload.error.code : undefined
    };
  }

  return { message: 'Provider request failed.' };
}

function summarizeRequestError(error: unknown): { message: string; code?: string } {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return {
      message: 'Request timed out (AbortSignal.timeout fired).',
      code: 'TIMEOUT'
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      message: error.message || 'Request was aborted.',
      code: 'ABORTED'
    };
  }

  if (error instanceof Error) {
    return { message: error.message, code: error.name };
  }

  return { message: 'Unknown request error.' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
