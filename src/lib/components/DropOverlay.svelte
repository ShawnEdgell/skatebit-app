<script lang="ts">
  export let show = false
</script>

{#if show}
  <div
    class="fixed top-16 inset-0 z-50 flex items-center justify-center pointer-events-none bg-neutral/60 bg-opacity-75 backdrop-blur-sm"
  >
    <div class="rounded-box p-8 bg-base-100 shadow-xl">
      <p class="text-xl font-bold text-base-content">
        Drop files or folders here
      </p>
    </div>
  </div>
{/if}
