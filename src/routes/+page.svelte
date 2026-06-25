<script lang="ts">
  import { DEFAULT_SYSTEM_PROMPT, IMAGE_VARIANTS, type PromptPlan, type SocialImageKind } from '$lib/prompt';

  interface GeneratedImage {
    kind: SocialImageKind;
    url: string;
    fileExtension: 'png' | 'svg';
    aspect: string;
    targetWidth: number;
    targetHeight: number;
    actualWidth?: number;
    actualHeight?: number;
  }

  interface GenerateResponse {
    mode: 'generated' | 'fallback';
    promptPlan: PromptPlan;
    promptGrade: {
      score: number;
      issues: string[];
    };
    images: GeneratedImage[];
    warnings?: string[];
  }

  export let data: { githubUrl: string };

  let productFile: File | null = null;
  let referenceFile: File | null = null;
  let productPreview = '';
  let referencePreview = '';
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let selectedKind: SocialImageKind = 'square';
  let result: GenerateResponse | null = null;
  let errorMessage = '';
  let clientWarning = '';
  let isGenerating = false;

  const maxClientWarnBytes = 6 * 1024 * 1024;

  $: selectedImage = result?.images.find((image) => image.kind === selectedKind) ?? result?.images[0];

  function handleFileChange(event: Event, field: 'product' | 'reference') {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    errorMessage = '';
    clientWarning = '';

    if (!file) {
      setFile(field, null, '');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFile(field, null, '');
      errorMessage = 'Please choose an image file.';
      input.value = '';
      return;
    }

    if (file.size > maxClientWarnBytes) {
      clientWarning = 'Large uploads may be slower. The server accepts images up to 8 MB each.';
    }

    const preview = URL.createObjectURL(file);
    setFile(field, file, preview);
  }

  function setFile(field: 'product' | 'reference', file: File | null, preview: string) {
    if (field === 'product') {
      if (productPreview) URL.revokeObjectURL(productPreview);
      productFile = file;
      productPreview = preview;
    } else {
      if (referencePreview) URL.revokeObjectURL(referencePreview);
      referenceFile = file;
      referencePreview = preview;
    }
  }

  async function submitJob() {
    errorMessage = '';
    clientWarning = '';

    if (!productFile) {
      errorMessage = 'Add a product image first.';
      return;
    }

    if (!referenceFile) {
      errorMessage = 'Add a reference image first.';
      return;
    }

    const formData = new FormData();
    formData.set('productImage', productFile);
    formData.set('referenceImage', referenceFile);
    formData.set('systemPrompt', systemPrompt);

    isGenerating = true;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Generation failed.');
      }

      result = payload;
      selectedKind = payload.images?.[0]?.kind ?? 'square';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Generation failed.';
    } finally {
      isGenerating = false;
    }
  }

  function resetPrompt() {
    systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  function labelFor(kind: SocialImageKind) {
    return IMAGE_VARIANTS.find((variant) => variant.kind === kind)?.label ?? kind;
  }
</script>

<svelte:head>
  <title>Social Post Pack Generator</title>
  <meta
    name="description"
    content="Upload a product image and reference image to generate a social ad image pack."
  />
</svelte:head>

<main class="app-shell">
  <section class="product-workspace" aria-labelledby="product-title">
    <div class="workspace-header">
      <div>
        <p class="eyebrow">Creative generator</p>
        <h1 id="product-title">Social Post Pack</h1>
      </div>
      <div class="status-pill" data-mode={result?.mode ?? 'ready'}>
        {result?.mode === 'generated' ? 'Generated' : result?.mode === 'fallback' ? 'Demo fallback' : 'Ready'}
      </div>
    </div>

    <div class="tool-grid">
      <form class="input-panel" on:submit|preventDefault={submitJob}>
        <div class="panel-heading">
          <h2>The Product</h2>
          <p>Upload the product hero and the visual reference that should guide style.</p>
        </div>

        <div class="upload-grid">
          <label class="upload-box">
            <span>Product image</span>
            <input name="productImage" type="file" accept="image/png,image/jpeg,image/webp" on:change={(event) => handleFileChange(event, 'product')} />
            {#if productPreview}
              <img src={productPreview} alt="Product preview" />
            {:else}
              <div class="empty-preview">PNG, JPEG, or WebP</div>
            {/if}
          </label>

          <label class="upload-box">
            <span>Reference image</span>
            <input name="referenceImage" type="file" accept="image/png,image/jpeg,image/webp" on:change={(event) => handleFileChange(event, 'reference')} />
            {#if referencePreview}
              <img src={referencePreview} alt="Reference preview" />
            {:else}
              <div class="empty-preview">Mood, setting, palette</div>
            {/if}
          </label>
        </div>

        <details class="advanced">
          <summary>Prompt contract</summary>
          <textarea bind:value={systemPrompt} rows="13" spellcheck="false" aria-label="System prompt"></textarea>
          <button class="secondary-button" type="button" on:click={resetPrompt}>Reset prompt</button>
        </details>

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

      <section class="result-panel" aria-labelledby="results-title">
        <div class="panel-heading">
          <h2 id="results-title">Output Pack</h2>
          <p>Square, story, and banner variants return as generated images or explicit demo fallback.</p>
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
              <a class="secondary-button" href={selectedImage.url} download={`social-${selectedImage.kind}.${selectedImage.fileExtension}`}>Download</a>
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
    </div>
  </section>

  <section class="info-band" aria-labelledby="built-title">
    <div>
      <p class="eyebrow">How It Was Built</p>
      <h2 id="built-title">Vision plan first, image generation second</h2>
    </div>
    <div class="info-grid">
      <article>
        <h3>Architecture</h3>
        <p>SvelteKit keeps the upload UI and server endpoint together. The backend accepts multipart form data, validates both images, and converts them to data URLs only for the provider request.</p>
      </article>
      <article>
        <h3>AI Flow</h3>
        <p>A vision model creates a strict JSON prompt plan, then the image generation tool receives the plan plus the original product and reference images for each social format.</p>
      </article>
      <article>
        <h3>Fallbacks</h3>
        <p>Missing keys, provider failures, and invalid model output return honest demo fallback states. If the prompt plan succeeds but image output fails, the UI still shows the plan.</p>
      </article>
      <article>
        <h3>Tradeoffs</h3>
        <p>No accounts, database, queue, or permanent storage. The app favors one polished request path with strict validation and clear degradation over broader workflow scope.</p>
      </article>
    </div>
  </section>

  <section class="code-band" aria-labelledby="code-title">
    <div>
      <p class="eyebrow">The Code</p>
      <h2 id="code-title">Deploy with server-side provider calls</h2>
    </div>
    <p>
      Configure <code>OPENAI_API_KEY</code>, optional <code>OPENAI_PROMPT_MODEL</code>, optional <code>OPENAI_GENERATION_MODEL</code>, and <code>PUBLIC_GITHUB_URL</code> in the deployment environment. Secrets stay server-side.
    </p>
    {#if data.githubUrl}
      <a class="repo-link" href={data.githubUrl}>Open GitHub repo</a>
    {:else}
      <span class="repo-link muted">Set PUBLIC_GITHUB_URL to show the repo link</span>
    {/if}
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1d2430;
    background: #f6f3ed;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app-shell {
    min-height: 100vh;
  }

  .product-workspace {
    padding: 32px;
    background:
      linear-gradient(120deg, rgba(246, 243, 237, 0.92), rgba(235, 241, 238, 0.94)),
      url('/demo/texture.svg');
    background-size: cover;
  }

  .workspace-header,
  .tool-grid,
  .info-band,
  .code-band {
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  .workspace-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #66756c;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 0;
    font-size: clamp(2.4rem, 7vw, 5.2rem);
    line-height: 0.94;
    letter-spacing: 0;
  }

  h2 {
    margin-bottom: 8px;
    font-size: 1.35rem;
    letter-spacing: 0;
  }

  h3 {
    margin-bottom: 8px;
    font-size: 1rem;
    letter-spacing: 0;
  }

  p {
    color: #536055;
    line-height: 1.55;
  }

  .status-pill {
    min-width: 118px;
    padding: 10px 14px;
    border: 1px solid #cbd5cd;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.7);
    color: #2f4738;
    font-weight: 700;
    text-align: center;
  }

  .status-pill[data-mode='fallback'] {
    color: #7a421c;
    border-color: #e0bb89;
    background: #fff3df;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: minmax(320px, 0.95fr) minmax(360px, 1.05fr);
    gap: 20px;
    align-items: start;
  }

  .input-panel,
  .result-panel {
    border: 1px solid #d9ddd5;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 18px 50px rgba(41, 54, 46, 0.08);
    padding: 22px;
  }

  .panel-heading p {
    margin-bottom: 18px;
  }

  .upload-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .upload-box {
    display: grid;
    gap: 10px;
    font-weight: 700;
  }

  .upload-box input {
    width: 100%;
    min-height: 42px;
    color: #334238;
  }

  .upload-box img,
  .empty-preview,
  .empty-results img,
  .image-frame img {
    width: 100%;
    display: block;
    border-radius: 8px;
  }

  .upload-box img,
  .empty-preview {
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border: 1px solid #dbe0d9;
    background: #edf0eb;
  }

  .empty-preview {
    display: grid;
    place-items: center;
    min-width: 0;
    padding: 18px;
    color: #657064;
    font-size: 0.9rem;
    text-align: center;
  }

  .advanced {
    margin-top: 18px;
    border-top: 1px solid #e1e5df;
    padding-top: 14px;
  }

  summary {
    cursor: pointer;
    font-weight: 800;
  }

  textarea {
    width: 100%;
    margin: 14px 0 10px;
    resize: vertical;
    border: 1px solid #cbd5cd;
    border-radius: 8px;
    padding: 12px;
    color: #1f2a23;
    background: #fbfcfa;
    font: 0.86rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .primary-button,
  .secondary-button,
  .variant-tabs button,
  .repo-link {
    min-height: 42px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-weight: 800;
    letter-spacing: 0;
  }

  .primary-button {
    width: 100%;
    margin-top: 18px;
    background: #274d3b;
    color: #fff;
    cursor: pointer;
  }

  .primary-button:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  .secondary-button,
  .repo-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border-color: #bfcac2;
    background: #fff;
    color: #274d3b;
    text-decoration: none;
    cursor: pointer;
  }

  .notice,
  .error,
  .warning-stack p {
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.92rem;
  }

  .notice {
    margin: 14px 0 0;
    background: #edf6ff;
    color: #315b7b;
  }

  .error {
    margin: 14px 0 0;
    background: #fff0eb;
    color: #8a341f;
  }

  .warning-stack {
    display: grid;
    gap: 8px;
    margin-bottom: 14px;
  }

  .warning-stack p {
    margin: 0;
    background: #fff7e8;
    color: #744d1a;
  }

  .variant-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }

  .variant-tabs button {
    background: #eef2ed;
    color: #314238;
    cursor: pointer;
  }

  .variant-tabs button.active {
    background: #274d3b;
    color: #fff;
  }

  .image-frame {
    display: grid;
    place-items: center;
    margin: 0;
    min-height: 420px;
    border: 1px solid #d8ded7;
    border-radius: 8px;
    overflow: hidden;
    background: #eef0eb;
  }

  .image-frame[data-kind='story'] {
    min-height: 540px;
  }

  .image-frame img {
    max-height: 620px;
    object-fit: contain;
  }

  .result-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 12px 0 18px;
    color: #68736b;
    font-size: 0.92rem;
    font-weight: 700;
  }

  .prompt-plan {
    border-top: 1px solid #e1e5df;
    padding-top: 14px;
  }

  .prompt-plan p {
    margin: 14px 0;
  }

  .copy-lines {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    color: #29352d;
  }

  pre {
    max-height: 260px;
    overflow: auto;
    border-radius: 8px;
    background: #17211b;
    color: #e8eee9;
    padding: 14px;
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .empty-results {
    border: 1px dashed #c7d0c9;
    border-radius: 8px;
    padding: 16px;
    background: #f7f8f5;
  }

  .empty-results img {
    aspect-ratio: 1 / 1;
    object-fit: cover;
  }

  .info-band,
  .code-band {
    padding: 44px 32px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
    margin-top: 22px;
  }

  .info-grid article {
    border-top: 2px solid #91a69a;
    padding-top: 14px;
  }

  .code-band {
    border-top: 1px solid #d9ddd5;
    padding-bottom: 64px;
  }

  code {
    border-radius: 6px;
    background: #e8ede7;
    padding: 2px 6px;
    color: #24392d;
  }

  .repo-link {
    width: fit-content;
    margin-top: 8px;
  }

  .muted {
    color: #657064;
  }

  @media (max-width: 900px) {
    .product-workspace {
      padding: 24px 16px;
    }

    .workspace-header,
    .tool-grid {
      display: grid;
    }

    .tool-grid,
    .info-grid {
      grid-template-columns: 1fr;
    }

    .status-pill {
      justify-self: start;
    }

    .image-frame,
    .image-frame[data-kind='story'] {
      min-height: 320px;
    }

    .info-band,
    .code-band {
      padding: 34px 16px;
    }
  }

  @media (max-width: 560px) {
    .upload-grid,
    .variant-tabs,
    .result-actions {
      grid-template-columns: 1fr;
    }

    .upload-grid,
    .result-actions {
      display: grid;
    }
  }
</style>
