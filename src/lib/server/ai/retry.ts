import { ProviderError } from './provider';

const RETRY_DELAY_MS = 600;

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!shouldRetry(error)) {
      throw error;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return operation();
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.status === 429 || (typeof error.status === 'number' && error.status >= 500);
  }

  if (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return true;
  }

  return false;
}
