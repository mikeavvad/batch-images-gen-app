<script lang="ts">
  export let interactive = false;
  let className = '';
  export { className as class };
</script>

<div class={`ui-card ${interactive ? 'ui-card-interactive' : ''} ${className}`} on:click {...$$restProps}>
  <slot />
</div>
