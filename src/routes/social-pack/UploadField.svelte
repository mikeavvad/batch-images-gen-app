<script lang="ts">
  export let field: string;
  export let inputName = `${field}Image`;
  export let label: string;
  export let placeholder: string;
  export let preview = '';
  export let previews: string[] = [];
  export let alt: string;
  export let multiple = false;

  const acceptedFileTypes = 'image/png,image/jpeg,image/webp';

  $: selectedCount = previews.filter(Boolean).length + (preview ? 1 : 0);
  $: pickerStatus = selectedCount
    ? multiple
      ? `${selectedCount} selected`
      : 'Selected'
    : multiple
      ? 'No files selected'
      : 'No file selected';
</script>

<label class="upload-box">
  <span>{label}</span>
  <span class="file-picker">
    <input name={inputName} type="file" accept={acceptedFileTypes} {multiple} on:change />
    <span class="file-button">{multiple ? 'Choose files' : 'Choose file'}</span>
    <span class="file-status">{pickerStatus}</span>
  </span>
  {#if previews.length}
    <div class="preview-grid">
      {#each previews as itemPreview, index}
        {#if itemPreview}
          <img src={itemPreview} alt={`${alt} ${index + 1}`} />
        {:else}
          <div class="empty-preview">{index === 0 ? placeholder : 'Optional second reference'}</div>
        {/if}
      {/each}
    </div>
  {:else if preview}
    <img src={preview} alt={alt} />
  {:else}
    <div class="empty-preview">{placeholder}</div>
  {/if}
</label>
