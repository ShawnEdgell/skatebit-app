<script lang="ts">
  export let show = false
  export let targetInfo: { path: string | null; label: string | null } = {
    path: null,
    label: null,
  }

  $: targetDisplay = targetInfo.label
    ? `${targetInfo.label} (${targetInfo.path})`
    : (targetInfo.path ?? '...')
</script>

{#if show}
  <div
    class="bg-neutral/60 bg-opacity-75 pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
    style="top: 4rem;"
  >
    <div class="rounded-box bg-base-100 p-8 text-center shadow-md">
      <p class="text-base-content text-xl font-bold">
        Drop files or folders here
      </p>
      {#if targetInfo.path}
        <p class="text-base-content/70 mt-2 text-sm">
          Target: {targetDisplay}
        </p>
      {:else}
        <p class="text-base-content/70 mt-2 text-sm">
          No active drop target defined for this view.
        </p>
      {/if}
    </div>
  </div>
{/if}
