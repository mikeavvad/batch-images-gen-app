<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import UploadField from './UploadField.svelte';
  import type { UploadField as UploadFieldName } from './types';

  export let productPreviews: string[] = [];
  export let referencePreviews: [string, string] = ['', ''];
  export let clientWarning = '';
  export let errorMessage = '';
  export let isGenerating = false;
  export let generationStatus = '';

  const dispatch = createEventDispatcher<{
    filechange: { event: Event; field: UploadFieldName };
    generate: void;
  }>();

  function handleFileChange(event: Event, field: UploadFieldName) {
    dispatch('filechange', { event, field });
  }
</script>

<form class="input-panel" on:submit|preventDefault={() => dispatch('generate')}>
  <div class="panel-heading">
    <h2>Product Images</h2>
    <p>Upload product shots and 1-2 references for one square social post per product.</p>
  </div>

  <div class="upload-grid">
    <UploadField
      field="product"
      inputName="productImages"
      label="Product images"
      placeholder="Upload product shots"
      alt="Product preview"
      previews={productPreviews}
      multiple
      on:change={(event) => handleFileChange(event, 'product')}
    />

    <UploadField
      field="reference"
      inputName="referenceImages"
      label="Reference images"
      placeholder="Upload 1-2 style references"
      alt="Reference preview"
      previews={referencePreviews}
      multiple
      on:change={(event) => handleFileChange(event, 'reference')}
    />
  </div>

  {#if clientWarning}
    <p class="notice">{clientWarning}</p>
  {/if}

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if isGenerating && generationStatus}
    <p class="generation-status" aria-live="polite">{generationStatus}</p>
  {/if}

  <button class="primary-button" type="submit" disabled={isGenerating}>
    {isGenerating ? generationStatus || 'Generating social posts...' : 'Generate social posts'}
  </button>
</form>
