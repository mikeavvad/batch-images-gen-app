<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'ghost' = 'secondary';
  export let size: 'sm' | 'md' = 'md';
  export let loading = false;
  export let disabled = false;
  let className = '';
  export { className as class };
</script>

<button
  class={`ui-button ui-button-${variant} ui-button-${size} ${className}`}
  disabled={disabled || loading}
  aria-busy={loading}
  on:click
  {...$$restProps}
>
  <slot />
</button>
