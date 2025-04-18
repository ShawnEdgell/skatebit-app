<!-- toast.svelte -->
<script lang="ts">
  import { toastStore } from '$lib/stores/uiStore'
  import type { Toast } from '$lib/types/uiTypes'
  import { onDestroy } from 'svelte'

  let toasts: Toast[] = []

  const unsubscribe = toastStore.subscribe((value: Toast[]) => {
    toasts = value
  })

  onDestroy(() => {
    unsubscribe()
  })
</script>

<!-- Use a container that allows stacking, toast-end is common -->
<div class="toast toast-center z-[9999]">
  {#each toasts as toast (toast.id)}
    <div class="alert {toast.variant} shadow-lg">
      <!-- Use {@html} to render the message content -->
      <span>{@html toast.message}</span>
    </div>
  {/each}
</div>
