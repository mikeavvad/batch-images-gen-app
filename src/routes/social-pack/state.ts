import type {
  GeneratedPostResult,
  ProductGenerationError,
  SocialPackPageState,
  UploadField
} from './types';

export const MAX_CLIENT_WARN_BYTES = 6 * 1024 * 1024;
export const MAX_PRODUCT_FILES = 2;

export interface ApplyUploadSelectionResult {
  nextState: SocialPackPageState;
  resetInputValue: boolean;
}

export function createPageState(): SocialPackPageState {
  return {
    productFiles: [],
    referenceFiles: [null, null],
    productPreviews: [],
    referencePreviews: ['', ''],
    results: [],
    productErrors: [],
    errorMessage: '',
    clientWarning: '',
    isGenerating: false,
    generationStatus: ''
  };
}

export function revokePreview(preview: string, revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL) {
  if (preview) {
    revokeObjectUrl(preview);
  }
}

export function revokePagePreviews(
  state: Pick<SocialPackPageState, 'productPreviews' | 'referencePreviews'>,
  revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL
) {
  for (const preview of state.productPreviews) {
    revokePreview(preview, revokeObjectUrl);
  }
  for (const preview of state.referencePreviews) {
    revokePreview(preview, revokeObjectUrl);
  }
}

export function applyUploadSelection(
  state: SocialPackPageState,
  field: UploadField,
  fileOrFiles: File | File[] | null,
  createObjectUrl: (file: File) => string = URL.createObjectURL,
  revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL
): ApplyUploadSelectionResult {
  if (field === 'reference') {
    return applyReferenceUploadSelection(
      state,
      Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [],
      createObjectUrl,
      revokeObjectUrl
    );
  }

  const files = Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [];
  const clearedState = {
    ...state,
    errorMessage: '',
    clientWarning: ''
  };

  if (files.length === 0) {
    return {
      nextState: assignProductFiles(clearedState, [], [], revokeObjectUrl),
      resetInputValue: false
    };
  }

  if (files.length > MAX_PRODUCT_FILES) {
    return {
      nextState: {
        ...clearedState,
        errorMessage: `Choose up to ${MAX_PRODUCT_FILES} product images.`
      },
      resetInputValue: true
    };
  }

  if (files.some((file) => !file.type.startsWith('image/'))) {
    return {
      nextState: {
        ...assignProductFiles(clearedState, [], [], revokeObjectUrl),
        errorMessage: 'Please choose image files only.'
      },
      resetInputValue: true
    };
  }

  const productPreviews = files.map((file) => createObjectUrl(file));
  const clientWarning =
    files.some((file) => file.size > MAX_CLIENT_WARN_BYTES)
      ? 'Large uploads may be slower. The server accepts images up to 8 MB each.'
      : '';

  return {
    nextState: assignProductFiles(
      {
        ...clearedState,
        clientWarning
      },
      files,
      productPreviews,
      revokeObjectUrl
    ),
    resetInputValue: false
  };
}

export function applyReferenceUploadSelection(
  state: SocialPackPageState,
  files: File[],
  createObjectUrl: (file: File) => string = URL.createObjectURL,
  revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL
): ApplyUploadSelectionResult {
  const clearedState = {
    ...state,
    errorMessage: '',
    clientWarning: ''
  };

  if (files.length > 2) {
    return {
      nextState: {
        ...clearedState,
        errorMessage: 'Choose up to 2 reference images.'
      },
      resetInputValue: true
    };
  }

  if (files.some((file) => !file.type.startsWith('image/'))) {
    return {
      nextState: {
        ...clearReferences(clearedState, revokeObjectUrl),
        errorMessage: 'Please choose image files only.'
      },
      resetInputValue: true
    };
  }

  const referenceFiles = [files[0] ?? null, files[1] ?? null] as [File | null, File | null];
  const referencePreviews = [
    files[0] ? createObjectUrl(files[0]) : '',
    files[1] ? createObjectUrl(files[1]) : ''
  ] as [string, string];

  for (const preview of state.referencePreviews) {
    revokePreview(preview, revokeObjectUrl);
  }

  return {
    nextState: {
      ...clearedState,
      referenceFiles,
      referencePreviews,
      clientWarning: files.some((file) => file.size > MAX_CLIENT_WARN_BYTES)
        ? 'Large uploads may be slower. The server accepts images up to 8 MB each.'
        : ''
    },
    resetInputValue: false
  };
}

export async function requestGeneration(
  state: Pick<SocialPackPageState, 'productFiles' | 'referenceFiles'>,
  fetcher: typeof fetch = fetch,
  onStatus?: (status: string) => void,
  onPost?: (post: GeneratedPostResult) => void,
  onProductError?: (error: ProductGenerationError) => void
): Promise<{ results: GeneratedPostResult[]; productErrors: ProductGenerationError[] }> {
  if (state.productFiles.length < 1) {
    throw new Error('Add at least one product image first.');
  }

  if (state.productFiles.length > MAX_PRODUCT_FILES) {
    throw new Error(`Add no more than ${MAX_PRODUCT_FILES} product images.`);
  }

  const referenceFiles = state.referenceFiles.filter((file): file is File => file !== null);
  if (referenceFiles.length < 1 || referenceFiles.length > 2) {
    throw new Error('Add 1 or 2 reference images.');
  }

  const formData = new FormData();
  for (const file of state.productFiles) {
    formData.append('productImages', file);
  }
  for (const file of referenceFiles) {
    formData.append('referenceImages', file);
  }

  const response = await fetcher('/api/generate', {
    method: 'POST',
    body: formData
  });

  return readGenerateResponseStream(response, onStatus, onPost, onProductError);
}

async function readGenerateResponseStream(
  response: Response,
  onStatus?: (status: string) => void,
  onPost?: (post: GeneratedPostResult) => void,
  onProductError?: (error: ProductGenerationError) => void
): Promise<{ results: GeneratedPostResult[]; productErrors: ProductGenerationError[] }> {
  if (!response.body) {
    throw new Error('Generation failed.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const results: GeneratedPostResult[] = [];
  const productErrors: ProductGenerationError[] = [];
  let errorMessage = '';
  let doneReceived = false;

  const consumeBlock = (block: string) => {
    let event = '';
    const dataLines: string[] = [];

    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }

    if (!event || dataLines.length === 0) {
      return;
    }

    const data = JSON.parse(dataLines.join('\n')) as unknown;

    if (event === 'status' && typeof data === 'string') {
      onStatus?.(statusToLoadingText(data));
      return;
    }

    if (event === 'post') {
      const post = data as GeneratedPostResult;
      results.push(post);
      onPost?.(post);
      return;
    }

    if (event === 'product-error') {
      const productError = data as ProductGenerationError;
      productErrors.push(productError);
      onProductError?.(productError);
      return;
    }

    if (event === 'done') {
      doneReceived = true;
      return;
    }

    if (event === 'error') {
      const payload = data as { error?: string };
      errorMessage = payload.error ?? 'Generation failed.';
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = findStreamEventBoundary(buffer);
    while (boundary) {
      consumeBlock(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary.length);
      boundary = findStreamEventBoundary(buffer);
    }

    if (done) {
      break;
    }
  }

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (buffer.trim()) {
    throw new Error('Generation stream ended before completion.');
  }

  if (!doneReceived) {
    throw new Error('Generation stream ended before completion.');
  }

  return { results, productErrors };
}

function findStreamEventBoundary(buffer: string) {
  const match = /\r?\n\r?\n/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

function statusToLoadingText(status: string) {
  const productMatch = status.match(/^generating-product-(\d+)-of-(\d+)$/);
  if (productMatch) {
    return `Generating product ${productMatch[1]} of ${productMatch[2]}.`;
  }

  switch (status) {
    case 'accepted':
      return 'Upload accepted.';
    case 'validating':
      return 'Checking images.';
    case 'generating':
      return 'Generating posts.';
    case 'finalizing':
      return 'Finalizing posts.';
    default:
      return 'Generating posts.';
  }
}

function assignProductFiles(
  state: SocialPackPageState,
  files: File[],
  previews: string[],
  revokeObjectUrl: (preview: string) => void
): SocialPackPageState {
  for (const existingPreview of state.productPreviews) {
    revokePreview(existingPreview, revokeObjectUrl);
  }

  return {
    ...state,
    productFiles: files,
    productPreviews: previews
  };
}

function clearReferences(
  state: SocialPackPageState,
  revokeObjectUrl: (preview: string) => void
): SocialPackPageState {
  for (const preview of state.referencePreviews) {
    revokePreview(preview, revokeObjectUrl);
  }

  return {
    ...state,
    referenceFiles: [null, null],
    referencePreviews: ['', '']
  };
}
