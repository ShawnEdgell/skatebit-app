<script lang="ts">
  export let show = false;
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none mt-16 bg-neutral/60 bg-opacity-75 backdrop-blur-sm">
    <div class="rounded-box p-8">
      <p class="text-xl font-bold">Drop files or folders here</p>
    </div>
  </div>
{/if}
