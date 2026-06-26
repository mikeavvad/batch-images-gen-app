<script lang="ts">
  export let githubUrl = '';
</script>

<section class="info-band" aria-labelledby="built-title">
  <div>
    <p class="eyebrow">How It Was Built</p>
    <h2 id="built-title">Vision plan first, integrated image generation second</h2>
  </div>
  <div class="info-grid">
    <article>
      <h3>Architecture</h3>
      <p>
        SvelteKit keeps the upload UI and server endpoint together. The backend accepts
        multipart form data, validates the product and reference images, and converts them to data
        URLs only for the provider request.
      </p>
    </article>
    <article>
      <h3>AI Flow</h3>
      <p>
        A vision model creates a strict JSON prompt plan, then the Images API receives the product
        and references together to compose final ad images for each format.
      </p>
    </article>
    <article>
      <h3>Fallbacks</h3>
      <p>
        Missing keys, provider failures, and invalid model output return honest demo fallback
        states. If the prompt plan succeeds but image output fails, the UI still shows the plan.
      </p>
    </article>
    <article>
      <h3>Tradeoffs</h3>
      <p>
        The model is asked to preserve the product silhouette, packaging, colors, and visible
        branding where possible, but natural scene integration can slightly alter product details.
      </p>
    </article>
  </div>
</section>

<section class="code-band" aria-labelledby="code-title">
  <div>
    <p class="eyebrow">The Code</p>
    <h2 id="code-title">Deploy with server-side provider calls</h2>
  </div>
  <p>
    Configure <code>OPENAI_API_KEY</code>, optional <code>OPENAI_PROMPT_MODEL</code>, optional
    <code>OPENAI_GENERATION_MODEL</code>, and <code>PUBLIC_GITHUB_URL</code> in the deployment
    environment. Secrets stay server-side.
  </p>
  {#if githubUrl}
    <a class="repo-link" href={githubUrl}>Open GitHub repo</a>
  {:else}
    <span class="repo-link muted">Set PUBLIC_GITHUB_URL to show the repo link</span>
  {/if}
</section>
