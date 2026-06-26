<script lang="ts">
  import { labelFor } from './helpers';
  import type { GeneratedPostResult, ProductGenerationError } from './types';

  export let results: GeneratedPostResult[] = [];
  export let productErrors: ProductGenerationError[] = [];
</script>

<section class="result-panel" aria-labelledby="results-title">
  <div class="panel-heading">
    <h2 id="results-title">Generated Posts</h2>
    <p>One social post per product image, each styled against the reference. The page renders every result as it lands.</p>
  </div>

  {#if productErrors.length}
    <div class="warning-stack" aria-label="Product errors">
      {#each productErrors as productError}
        <p>Product {productError.index + 1}: {productError.error}</p>
      {/each}
    </div>
  {/if}

  {#if results.length}
    <div class="post-results">
      {#each results as post}
        <article class="post-card">
          <div class="post-card-heading">
            <div>
              <h3>Product {post.index + 1}</h3>
              <p>{post.productName}</p>
            </div>
            <span data-mode={post.result.mode}>
              {post.result.mode === 'fallback' ? 'Demo fallback' : 'Generated'}
            </span>
          </div>

          {#if post.result.warnings?.length}
            <div class="warning-stack" aria-label={`Warnings for ${post.productName}`}>
              {#each post.result.warnings as warning}
                <p>{warning}</p>
              {/each}
            </div>
          {/if}

          <div class="prompt-plan">
            <p>{post.result.promptPlan.creative_direction}</p>
          </div>

          <figure class="image-frame" data-kind={post.image.kind}>
            <img src={post.image.url} alt={`Generated social post for ${post.productName}`} />
          </figure>

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
              class="secondary-button"
              href={post.image.url}
              download={`social-product-${post.index + 1}.${post.image.fileExtension}`}
            >
              Download
            </a>
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-results">
      <img src="/demo/square.svg" alt="Demo social ad placeholder" />
    </div>
  {/if}
</section>
