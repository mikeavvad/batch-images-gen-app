<script lang="ts">
  export let value = 0;
  export let max = 100;
  export let label = 'Progress';
  let className = '';
  export { className as class };

  $: normalizedValue = Math.min(Math.max(value, 0), max);
  $: percent = max > 0 ? Math.round((normalizedValue / max) * 100) : 0;
</script>

<div
  class={`ui-progress ${className}`}
  role="progressbar"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax={max}
  aria-valuenow={normalizedValue}
  {...$$restProps}
>
  <span style={`width: ${percent}%`}></span>
</div>
