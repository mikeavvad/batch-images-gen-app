<script lang="ts">
  import { labelFor } from './helpers';
  import type { SocialImageKind } from '$lib/prompt';
  import type { GenerateResponse, GeneratedImage } from './types';

  export let result: GenerateResponse | null = null;
  export let selectedKind: SocialImageKind = 'square';
  export let selectedImage: GeneratedImage | undefined;
</script>

<section class="result-panel" aria-labelledby="results-title">
  <div class="panel-heading">
    <h2 id="results-title">Output Pack</h2>
    <p>Square, story, and banner variants return as model-composed ad images or explicit demo fallback.</p>
  </div>

  {#if result}
    {#if result.warnings?.length}
      <div class="warning-stack" aria-label="Warnings">
        {#each result.warnings as warning}
          <p>{warning}</p>
        {/each}
      </div>
    {/if}

    <div class="variant-tabs" role="tablist" aria-label="Generated image formats">
      {#each result.images as image}
        <button
          type="button"
          class:active={selectedKind === image.kind}
          on:click={() => (selectedKind = image.kind)}
        >
          {labelFor(image.kind)}
        </button>
      {/each}
    </div>

    {#if selectedImage}
      <figure class="image-frame" data-kind={selectedImage.kind}>
        <img src={selectedImage.url} alt={`${labelFor(selectedImage.kind)} generated social ad`} />
      </figure>
      <div class="result-actions">
        <span>
          {#if selectedImage.actualWidth && selectedImage.actualHeight}
            {selectedImage.actualWidth} x {selectedImage.actualHeight}
          {:else}
            Target {selectedImage.aspect}, {selectedImage.targetWidth} x {selectedImage.targetHeight}
          {/if}
        </span>
        <a
          class="secondary-button"
          href={selectedImage.url}
          download={`social-${selectedImage.kind}.${selectedImage.fileExtension}`}
        >
          Download
        </a>
      </div>
    {/if}

    <details class="prompt-plan" open>
      <summary>Creative direction</summary>
      <p>{result.promptPlan.creative_direction}</p>
      <div class="copy-lines">
        <strong>{result.promptPlan.overlay_copy.headline}</strong>
        <span>{result.promptPlan.overlay_copy.subline}</span>
      </div>
      <pre>{JSON.stringify(result.promptPlan, null, 2)}</pre>
    </details>
  {:else}
    <div class="empty-results">
      <img src="/demo/square.svg" alt="Demo social ad placeholder" />
    </div>
  {/if}
</section>
