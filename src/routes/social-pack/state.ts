import type { SocialImageKind } from '$lib/prompt';
import type { GenerateResponse, SocialPackPageState, UploadField } from './types';

export const MAX_CLIENT_WARN_BYTES = 6 * 1024 * 1024;

export interface ApplyUploadSelectionResult {
  nextState: SocialPackPageState;
  resetInputValue: boolean;
}

export function createPageState(): SocialPackPageState {
  return {
    productFile: null,
    referenceFiles: [null, null],
    productPreview: '',
    referencePreviews: ['', ''],
    selectedKind: 'square',
    result: null,
    errorMessage: '',
    clientWarning: '',
    isGenerating: false
  };
}

export function revokePreview(preview: string, revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL) {
  if (preview) {
    revokeObjectUrl(preview);
  }
}

export function revokePagePreviews(
  state: Pick<SocialPackPageState, 'productPreview' | 'referencePreviews'>,
  revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL
) {
  revokePreview(state.productPreview, revokeObjectUrl);
  for (const preview of state.referencePreviews) {
    revokePreview(preview, revokeObjectUrl);
  }
}

export function applyUploadSelection(
  state: SocialPackPageState,
  field: UploadField,
  file: File | null,
  createObjectUrl: (file: File) => string = URL.createObjectURL,
  revokeObjectUrl: (preview: string) => void = URL.revokeObjectURL
): ApplyUploadSelectionResult {
  if (field === 'reference') {
    return applyReferenceUploadSelection(state, file ? [file] : [], createObjectUrl, revokeObjectUrl);
  }

  const clearedState = {
    ...state,
    errorMessage: '',
    clientWarning: ''
  };

  if (!file) {
    return {
      nextState: assignFile(clearedState, field, null, '', revokeObjectUrl),
      resetInputValue: false
    };
  }

  if (!file.type.startsWith('image/')) {
    return {
      nextState: {
        ...assignFile(clearedState, field, null, '', revokeObjectUrl),
        errorMessage: 'Please choose an image file.'
      },
      resetInputValue: true
    };
  }

  const clientWarning =
    file.size > MAX_CLIENT_WARN_BYTES
      ? 'Large uploads may be slower. The server accepts images up to 8 MB each.'
      : '';

  return {
    nextState: assignFile(
      {
        ...clearedState,
        clientWarning
      },
      field,
      file,
      createObjectUrl(file),
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
  state: Pick<SocialPackPageState, 'productFile' | 'referenceFiles'>,
  fetcher: typeof fetch = fetch
): Promise<{ result: GenerateResponse; selectedKind: SocialImageKind }> {
  if (!state.productFile) {
    throw new Error('Add a product image first.');
  }

  const referenceFiles = state.referenceFiles.filter((file): file is File => file !== null);
  if (referenceFiles.length < 1 || referenceFiles.length > 2) {
    throw new Error('Add 1 or 2 reference images.');
  }

  const formData = new FormData();
  formData.set('productImage', state.productFile);
  for (const file of referenceFiles) {
    formData.append('referenceImages', file);
  }

  const response = await fetcher('/api/generate', {
    method: 'POST',
    body: formData
  });
  const payload = (await response.json()) as GenerateResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Generation failed.');
  }

  return {
    result: payload,
    selectedKind: payload.images[0]?.kind ?? 'square'
  };
}

function assignFile(
  state: SocialPackPageState,
  field: UploadField,
  file: File | null,
  preview: string,
  revokeObjectUrl: (preview: string) => void
): SocialPackPageState {
  if (field === 'product') {
    revokePreview(state.productPreview, revokeObjectUrl);
    return {
      ...state,
      productFile: file,
      productPreview: preview
    };
  }

  for (const existingPreview of state.referencePreviews) {
    revokePreview(existingPreview, revokeObjectUrl);
  }

  return {
    ...state,
    referenceFiles: [file, null],
    referencePreviews: [preview, '']
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
