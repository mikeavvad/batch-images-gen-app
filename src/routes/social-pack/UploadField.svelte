<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  export let field: string;
  export let inputName = `${field}Image`;
  export let label: string;
  export let placeholder: string;
  export let preview = '';
  export let previews: string[] = [];
  export let alt: string;
  export let multiple = false;
  export let helperText = '';
  export let disabled = false;

  const acceptedFileTypes = 'image/png,image/jpeg,image/webp';
  let inputElement: HTMLInputElement;
  let isDragging = false;

  $: selectedCount = previews.filter(Boolean).length + (preview ? 1 : 0);
  $: pickerStatus = selectedCount
    ? multiple
      ? `${selectedCount} selected`
      : 'Selected'
    : multiple
      ? 'No files selected'
      : 'No file selected';
  $: previewItems = previews.filter(Boolean).length
    ? previews.filter(Boolean)
    : preview
      ? [preview]
      : [];
  $: emptyMessage = multiple ? 'Drop images here or browse files' : 'Drop an image here or browse';

  function openPicker(event?: MouseEvent) {
    event?.stopPropagation();
    if (!disabled) {
      inputElement.click();
    }
  }

  function handleDragOver(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    const dropZone = event.currentTarget as HTMLElement | null;
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !dropZone?.contains(nextTarget)) {
      isDragging = false;
    }
  }

  function handleDrop(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files?.length || !inputElement) return;

    inputElement.files = files;
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
</script>

<div class="upload-field">
  <div class="upload-copy">
    <span class="upload-label">{label}</span>
    <span>{helperText}</span>
  </div>

  <div
    class="upload-box"
    class:is-dragging={isDragging}
    class:has-files={selectedCount > 0}
    class:is-disabled={disabled}
    role="button"
    tabindex={disabled ? -1 : 0}
    aria-label={label}
    on:click={openPicker}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    }}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    <input
      bind:this={inputElement}
      name={inputName}
      type="file"
      accept={acceptedFileTypes}
      {multiple}
      {disabled}
      on:change
    />

    <div class="upload-empty">
      <span class="upload-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 3v11m0-11 4 4m-4-4-4 4" />
          <path d="M5 15v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3" />
        </svg>
      </span>
      <strong>{selectedCount ? pickerStatus : emptyMessage}</strong>
      <span>{placeholder}</span>
      <Button type="button" size="sm" variant="secondary" disabled={disabled} on:click={openPicker}>
        {multiple ? 'Browse files' : 'Browse file'}
      </Button>
      <small>PNG, JPG, or WebP</small>
    </div>

    {#if previewItems.length}
      <div class="preview-grid" aria-label={`${label} previews`}>
        {#each previewItems as itemPreview, index}
          <img src={itemPreview} alt={`${alt} ${index + 1}`} />
        {/each}
      </div>
    {/if}
  </div>
</div>
