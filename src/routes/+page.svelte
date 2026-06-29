<script lang="ts">
  import { onDestroy } from 'svelte';
  import './social-pack/page.css';
  import InfoBands from './social-pack/InfoBands.svelte';
  import InputPanel from './social-pack/InputPanel.svelte';
  import ResultPanel from './social-pack/ResultPanel.svelte';
  import { getStatusLabel } from './social-pack/helpers';
  import {
    applyReferenceUploadSelection,
    applyUploadSelection,
    createPageState,
    requestGeneration,
    revokePagePreviews
  } from './social-pack/state';
  import type {
    GeneratedPostResult,
    ProductGenerationError,
    ProductProgressItem,
    UploadField
  } from './social-pack/types';

  export let data: { githubUrl: string };

  let state = createPageState();
  let productProgress: ProductProgressItem[] = [];
  $: statusLabel = getStatusLabel(state);
  $: statusMode = statusLabel.toLowerCase().replace(' ', '-');

  onDestroy(() => {
    revokePagePreviews(state);
  });

  function handleFileChange(event: CustomEvent<{ event: Event; field: UploadField }>) {
    const { field } = event.detail;
    const input = event.detail.event.currentTarget as HTMLInputElement;
    const result =
      field === 'reference'
        ? applyReferenceUploadSelection(state, Array.from(input.files ?? []))
        : applyUploadSelection(state, field, Array.from(input.files ?? []));

    state = result.nextState;
    productProgress = [];

    if (result.resetInputValue) {
      input.value = '';
    }
  }

  function createProgressItems(): ProductProgressItem[] {
    return state.productFiles.map((file, index) => ({
      index,
      name: file.name || `Product ${index + 1}`,
      preview: state.productPreviews[index] ?? '',
      status: 'queued',
      progress: 8,
      message: 'Queued'
    }));
  }

  function updateProgress(index: number, update: Partial<ProductProgressItem>) {
    productProgress = productProgress.map((item) =>
      item.index === index ? { ...item, ...update } : item
    );
  }

  function markActiveProduct(generationStatus: string) {
    const match = generationStatus.match(/^Generating product (\d+) of \d+\.$/);
    if (!match) {
      if (generationStatus === 'Checking images.' || generationStatus === 'Upload accepted.') {
        productProgress = productProgress.map((item) =>
          item.status === 'queued'
            ? { ...item, progress: Math.max(item.progress, 16), message: generationStatus }
            : item
        );
      }
      return;
    }

    const activeIndex = Number(match[1]) - 1;
    productProgress = productProgress.map((item) => {
      if (item.status === 'done' || item.status === 'error') return item;
      if (item.index < activeIndex) {
        return {
          ...item,
          status: 'generating',
          progress: Math.max(item.progress, 86),
          message: 'Finalizing'
        };
      }
      if (item.index === activeIndex) {
        return { ...item, status: 'generating', progress: 58, message: generationStatus };
      }
      return { ...item, status: 'queued', progress: Math.max(item.progress, 8), message: 'Queued' };
    });
  }

  function markPostDone(post: GeneratedPostResult) {
    updateProgress(post.index, {
      name: post.productName,
      status: 'done',
      progress: 100,
      message: 'Done',
      error: ''
    });
  }

  function markProductError(productError: ProductGenerationError) {
    updateProgress(productError.index, {
      name: productError.productName,
      status: 'error',
      progress: 100,
      message: 'Error',
      error: productError.error
    });
  }

  async function submitJob() {
    productProgress = createProgressItems();
    state = {
      ...state,
      errorMessage: '',
      clientWarning: '',
      results: [],
      productErrors: [],
      isGenerating: true,
      generationStatus: 'Starting generation.'
    };

    try {
      await requestGeneration(
        state,
        fetch,
        (generationStatus) => {
          state = {
            ...state,
            generationStatus
          };
          markActiveProduct(generationStatus);
        },
        (post) => {
          state = {
            ...state,
            results: [...state.results, post]
          };
          markPostDone(post);
        },
        (productError) => {
          state = {
            ...state,
            productErrors: [...state.productErrors, productError]
          };
          markProductError(productError);
        }
      );
      state = {
        ...state,
        generationStatus: 'Done.'
      };
    } catch (error) {
      state = {
        ...state,
        errorMessage: error instanceof Error ? error.message : 'Generation failed.',
        generationStatus: ''
      };
      productProgress = productProgress.map((item) =>
        item.status === 'done'
          ? item
          : {
              ...item,
              status: 'error',
              progress: 100,
              message: 'Error',
              error: error instanceof Error ? error.message : 'Generation failed.'
            }
      );
    } finally {
      state = {
        ...state,
        isGenerating: false,
        generationStatus: ''
      };
    }
  }

  async function retryProduct(event: CustomEvent<{ index: number }>) {
    if (state.isGenerating) return;

    const originalIndex = event.detail.index;
    const productFile = state.productFiles[originalIndex];
    if (!productFile) return;

    state = {
      ...state,
      errorMessage: '',
      productErrors: state.productErrors.filter(
        (productError) => productError.index !== originalIndex
      ),
      results: state.results.filter((post) => post.index !== originalIndex),
      isGenerating: true,
      generationStatus: `Generating product ${originalIndex + 1} of ${state.productFiles.length}.`
    };
    updateProgress(originalIndex, {
      status: 'generating',
      progress: 42,
      message: 'Retrying',
      error: ''
    });

    try {
      await requestGeneration(
        {
          productFiles: [productFile],
          referenceFiles: state.referenceFiles
        },
        fetch,
        (generationStatus) => {
          state = {
            ...state,
            generationStatus
          };
          updateProgress(originalIndex, {
            status: generationStatus.startsWith('Generating product') ? 'generating' : 'queued',
            progress: generationStatus.startsWith('Generating product') ? 58 : 24,
            message: generationStatus
          });
        },
        (post) => {
          const remappedPost = {
            ...post,
            index: originalIndex,
            productName: post.productName || productFile.name || `Product ${originalIndex + 1}`
          };
          state = {
            ...state,
            results: [...state.results, remappedPost].sort((a, b) => a.index - b.index)
          };
          markPostDone(remappedPost);
        },
        (productError) => {
          const remappedError = {
            ...productError,
            index: originalIndex,
            productName: productError.productName || productFile.name || `Product ${originalIndex + 1}`
          };
          state = {
            ...state,
            productErrors: [...state.productErrors, remappedError]
          };
          markProductError(remappedError);
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed.';
      state = {
        ...state,
        errorMessage: message
      };
      updateProgress(originalIndex, {
        status: 'error',
        progress: 100,
        message: 'Error',
        error: message
      });
    } finally {
      state = {
        ...state,
        isGenerating: false,
        generationStatus: ''
      };
    }
  }
</script>

<svelte:head>
  <title>Square Social Post Generator</title>
  <meta
    name="description"
    content="Upload product images and 1-2 reference images to generate one square social post per product."
  />
</svelte:head>

<main class="app-shell">
  <section class="product-workspace" aria-labelledby="product-title">
    <div class="workspace-header">
      <div>
        <p class="eyebrow">Creative generator</p>
        <h1 id="product-title">Square Social Posts</h1>
      </div>
      <div class="status-pill" data-mode={statusMode}>
        {statusLabel}
      </div>
    </div>

    <div class="tool-grid">
      <InputPanel
        productPreviews={state.productPreviews}
        referencePreviews={state.referencePreviews}
        clientWarning={state.clientWarning}
        errorMessage={state.errorMessage}
        isGenerating={state.isGenerating}
        generationStatus={state.generationStatus}
        on:filechange={handleFileChange}
        on:generate={submitJob}
      />

      <ResultPanel
        results={state.results}
        productErrors={state.productErrors}
        productProgress={productProgress}
        productPreviews={state.productPreviews}
        referencePreviews={state.referencePreviews}
        isGenerating={state.isGenerating}
        on:retry={retryProduct}
      />
    </div>
  </section>

  <InfoBands githubUrl={data.githubUrl} />
</main>
