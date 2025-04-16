<script lang="ts">
  import { toastStore } from '$lib/stores/uiStore';
  import type { Toast } from '$lib/types/uiTypes';
  import { onDestroy } from 'svelte';

  let toasts: Toast[] = [];

  const unsubscribe = toastStore.subscribe((value: Toast[]) => {
    toasts = value;
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<div class="toast toast-center z-999">
  {#each toasts as toast (toast.id)}
    <div class="alert {toast.variant}">
      <span>{toast.message}</span>
    </div>
  {/each}
</div>
