<script lang="ts">
  import { onDestroy } from 'svelte';
  import './social-pack/page.css';
  import InfoBands from './social-pack/InfoBands.svelte';
  import InputPanel from './social-pack/InputPanel.svelte';
  import ResultPanel from './social-pack/ResultPanel.svelte';
  import { getSelectedImage, getStatusLabel } from './social-pack/helpers';
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

  $: selectedImage = getSelectedImage(state.result, state.selectedKind);

  onDestroy(() => {
    revokePagePreviews(state);
  });

  function handleFileChange(event: CustomEvent<{ event: Event; field: UploadField }>) {
    const { field } = event.detail;
    const input = event.detail.event.currentTarget as HTMLInputElement;
    const result =
      field === 'reference'
        ? applyReferenceUploadSelection(state, Array.from(input.files ?? []))
        : applyUploadSelection(state, field, input.files?.[0] ?? null);

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
      isGenerating: true
    };

    try {
      const { result, selectedKind } = await requestGeneration(state);
      state = {
        ...state,
        result,
        selectedKind
      };
    } catch (error) {
      state = {
        ...state,
        errorMessage: error instanceof Error ? error.message : 'Generation failed.'
      };
    } finally {
      state = {
        ...state,
        isGenerating: false
      };
    }
  }
</script>

<svelte:head>
  <title>Social Post Pack Generator</title>
  <meta
    name="description"
    content="Upload a product image and 1-2 reference images to generate a social ad image pack."
  />
</svelte:head>

<main class="app-shell">
  <section class="product-workspace" aria-labelledby="product-title">
    <div class="workspace-header">
      <div>
        <p class="eyebrow">Creative generator</p>
        <h1 id="product-title">Social Post Pack</h1>
      </div>
      <div class="status-pill" data-mode={state.result?.mode ?? 'ready'}>
        {getStatusLabel(state.result?.mode)}
      </div>
    </div>

    <div class="tool-grid">
      <InputPanel
        productPreview={state.productPreview}
        referencePreviews={state.referencePreviews}
        clientWarning={state.clientWarning}
        errorMessage={state.errorMessage}
        isGenerating={state.isGenerating}
        on:filechange={handleFileChange}
        on:generate={submitJob}
      />

      <ResultPanel bind:selectedKind={state.selectedKind} result={state.result} {selectedImage} />
    </div>
  </section>

  <InfoBands githubUrl={data.githubUrl} />
</main>
