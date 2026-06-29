<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
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
    <h2>Build the set</h2>
    <p>Upload product shots and style references, then generate one square social post for each product.</p>
  </div>

  <div class="step-stack">
    <Card class="step-card">
      <div class="step-heading">
        <span>1</span>
        <div>
          <h3>Upload products</h3>
          <p>Add up to two product images.</p>
        </div>
      </div>

      <UploadField
        field="product"
        inputName="productImages"
        label="Product images"
        placeholder="Use clear square or portrait product shots."
        helperText="These become the products in the generated posts."
        alt="Product preview"
        previews={productPreviews}
        multiple
        disabled={isGenerating}
        on:change={(event) => handleFileChange(event, 'product')}
      />
    </Card>

    <Card class="step-card">
      <div class="step-heading">
        <span>2</span>
        <div>
          <h3>Upload references</h3>
          <p>Add one or two visual references.</p>
        </div>
      </div>

      <UploadField
        field="reference"
        inputName="referenceImages"
        label="Reference images"
        placeholder="Use campaign, mood, or layout examples."
        helperText="References guide styling and composition."
        alt="Reference preview"
        previews={referencePreviews}
        multiple
        disabled={isGenerating}
        on:change={(event) => handleFileChange(event, 'reference')}
      />
    </Card>
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

  <Card class="step-card generate-step">
    <div class="step-heading">
      <span>3</span>
      <div>
        <h3>Generate</h3>
        <p>Start the stream and watch each product progress individually.</p>
      </div>
    </div>

    <Button class="generate-button" variant="primary" type="submit" disabled={isGenerating} loading={isGenerating}>
      {isGenerating ? 'Generating social posts...' : 'Generate social posts'}
    </Button>
  </Card>
</form>
