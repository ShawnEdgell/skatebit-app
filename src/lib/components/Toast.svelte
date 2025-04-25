<script lang="ts">
  import { onDestroy } from 'svelte'
  import { toastStore } from '$lib/stores/uiStore'
  import type { Toast } from '$lib/types/uiTypes'

  let toasts: Toast[] = []

  const unsubscribe = toastStore.subscribe((value: Toast[]) => {
    toasts = value
  })

  onDestroy(() => {
    unsubscribe()
  })
</script>

<div class="toast toast-center z-[9999]">
  {#each toasts as toast (toast.id)}
    <div class="alert {toast.variant} shadow-lg">
      <span>{@html toast.message}</span>
    </div>
  {/each}
</div>
