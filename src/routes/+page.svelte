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
  import type { UploadField } from './social-pack/types';

  export let data: { githubUrl: string };

  let state = createPageState();
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

    if (result.resetInputValue) {
      input.value = '';
    }
  }

  async function submitJob() {
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
        },
        (post) => {
          state = {
            ...state,
            results: [...state.results, post]
          };
        },
        (productError) => {
          state = {
            ...state,
            productErrors: [...state.productErrors, productError]
          };
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

      <ResultPanel results={state.results} productErrors={state.productErrors} />
    </div>
  </section>

  <InfoBands githubUrl={data.githubUrl} />
</main>
