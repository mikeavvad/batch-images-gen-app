<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import UploadField from './UploadField.svelte';
  import type { UploadField as UploadFieldName } from './types';

  export let productPreview = '';
  export let referencePreviews: [string, string] = ['', ''];
  export let clientWarning = '';
  export let errorMessage = '';
  export let isGenerating = false;

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
    <h2>The Product</h2>
    <p>Upload the product hero and 1-2 references for the generated ad scene.</p>
  </div>

  <div class="upload-grid">
    <UploadField
      field="product"
      label="Product image"
      placeholder="Upload product hero"
      alt="Product preview"
      preview={productPreview}
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

  <button class="primary-button" type="submit" disabled={isGenerating}>
    {isGenerating ? 'Generating pack...' : 'Generate social pack'}
  </button>
</form>
