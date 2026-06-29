<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Progress } from '$lib/components/ui/progress';
  import { createEventDispatcher } from 'svelte';
  import { labelFor } from './helpers';
  import type { GeneratedPostResult, ProductGenerationError, ProductProgressItem } from './types';

  export let results: GeneratedPostResult[] = [];
  export let productErrors: ProductGenerationError[] = [];
  export let productProgress: ProductProgressItem[] = [];
  export let productPreviews: string[] = [];
  export let referencePreviews: [string, string] = ['', ''];
  export let isGenerating = false;

  const dispatch = createEventDispatcher<{
    retry: { index: number };
  }>();

  let selectedPost: GeneratedPostResult | null = null;

  $: firstReferencePreview = referencePreviews.find(Boolean) ?? '';
  $: completedResultIndexes = new Set(results.map((post) => post.index));
  $: visibleProgress = productProgress.filter(
    (item) => item.status !== 'done' || !completedResultIndexes.has(item.index)
  );
  $: visibleErrors = productErrors.filter(
    (productError) => !productProgress.some((item) => item.index === productError.index)
  );

  function openPost(post: GeneratedPostResult) {
    selectedPost = post;
  }

  function closePost() {
    selectedPost = null;
  }

  function statusLabel(status: ProductProgressItem['status']) {
    if (status === 'queued') return 'Queued';
    if (status === 'generating') return 'Generating';
    if (status === 'done') return 'Done';
    return 'Error';
  }
</script>

<section class="result-panel" aria-labelledby="results-title">
  <div class="panel-heading">
    <h2 id="results-title">Results</h2>
    <p>Each product gets its own progress card and square post result as the stream returns it.</p>
  </div>

  {#if visibleProgress.length}
    <div class="progress-grid" aria-label="Product generation progress">
      {#each visibleProgress as item}
        <Card class={`progress-card progress-card-${item.status}`}>
          <img src={item.preview} alt={`Product ${item.index + 1} preview`} />
          <div class="progress-content">
            <div class="progress-heading">
              <div>
                <h3>Product {item.index + 1}</h3>
                <p>{item.name}</p>
              </div>
              <span>{statusLabel(item.status)}</span>
            </div>
            <Progress value={item.progress} label={`Product ${item.index + 1} progress`} />
            <p class="progress-message">{item.error || item.message}</p>
            {#if item.status === 'error'}
              <Button
                size="sm"
                variant="secondary"
                type="button"
                disabled={isGenerating}
                on:click={() => dispatch('retry', { index: item.index })}
              >
                Retry
              </Button>
            {/if}
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if visibleErrors.length}
    <div class="warning-stack" aria-label="Product errors">
      {#each visibleErrors as productError}
        <p>Product {productError.index + 1}: {productError.error}</p>
      {/each}
    </div>
  {/if}

  {#if results.length}
    <div class="post-results">
      {#each results as post}
        <Card class="post-card" interactive>
          <div class="post-card-heading">
            <div>
              <h3>Product {post.index + 1}</h3>
              <p>{post.productName}</p>
            </div>
            <span data-mode={post.result.mode}>
              {post.result.mode === 'fallback' ? 'Demo fallback' : 'Generated'}
            </span>
          </div>

          <button class="post-preview-button" type="button" on:click={() => openPost(post)}>
            <img src={post.image.url} alt={`Generated social post for ${post.productName}`} />
          </button>

          <div class="compare-strip" aria-label={`Comparison for ${post.productName}`}>
            {#if productPreviews[post.index]}
              <img src={productPreviews[post.index]} alt={`Original product ${post.index + 1}`} />
            {/if}
            {#if firstReferencePreview}
              <img src={firstReferencePreview} alt="Reference preview" />
            {/if}
            <img src={post.image.url} alt={`Generated result for ${post.productName}`} />
          </div>

          {#if post.result.warnings?.length}
            <div class="warning-stack compact" aria-label={`Warnings for ${post.productName}`}>
              {#each post.result.warnings as warning}
                <p>{warning}</p>
              {/each}
            </div>
          {/if}

          <div class="result-actions">
            <span>
              {labelFor(post.image.kind)}
              {#if post.image.actualWidth && post.image.actualHeight}
                , {post.image.actualWidth} x {post.image.actualHeight}
              {:else}
                , target {post.image.aspect}, {post.image.targetWidth} x {post.image.targetHeight}
              {/if}
            </span>
            <a
              class="ui-button ui-button-secondary ui-button-sm"
              href={post.image.url}
              download={`social-product-${post.index + 1}.${post.image.fileExtension}`}
            >
              Download
            </a>
          </div>
        </Card>
      {/each}
    </div>
  {:else}
    <div class="empty-results">
      <span class="empty-results-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
          <path d="m8 14 2.2-2.2a1.2 1.2 0 0 1 1.7 0L16 16" />
          <path d="M14.5 9.5h.01" />
        </svg>
      </span>
      <h3>No posts generated yet</h3>
      <p>Upload products and references, then generate to see square cards, progress, and comparisons here.</p>
    </div>
  {/if}
</section>

{#if selectedPost}
  <div class="lightbox-backdrop" role="presentation" on:click={closePost}>
    <Card
      class="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Generated post for ${selectedPost.productName}`}
      on:click={(event) => event.stopPropagation()}
    >
      <div class="lightbox-heading">
        <div>
          <h2>Product {selectedPost.index + 1}</h2>
          <p>{selectedPost.productName}</p>
        </div>
        <Button size="sm" variant="ghost" type="button" on:click={closePost}>Close</Button>
      </div>

      <div class="compare-view">
        <figure>
          <span>Product</span>
          {#if productPreviews[selectedPost.index]}
            <img src={productPreviews[selectedPost.index]} alt={`Original product ${selectedPost.index + 1}`} />
          {:else}
            <div class="empty-preview">No product preview</div>
          {/if}
        </figure>
        <figure>
          <span>Reference</span>
          {#if firstReferencePreview}
            <img src={firstReferencePreview} alt="Reference preview" />
          {:else}
            <div class="empty-preview">No reference preview</div>
          {/if}
        </figure>
        <figure>
          <span>Generated</span>
          <img src={selectedPost.image.url} alt={`Generated social post for ${selectedPost.productName}`} />
        </figure>
      </div>

      <div class="prompt-plan">
        <p>{selectedPost.result.promptPlan.creative_direction}</p>
      </div>
    </Card>
  </div>
{/if}
