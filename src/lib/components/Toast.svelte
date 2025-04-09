<script lang="ts">
  import { toastStore, type Toast } from '$lib/stores/toastStore';
  import { onDestroy } from 'svelte';

  let toasts: Toast[] = [];

  const unsubscribe = toastStore.subscribe((value: Toast[]) => {
    toasts = value;
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<div class="toast toast-center">
  {#each toasts as toast (toast.id)}
    <div class="alert {toast.variant}">
      <span>{toast.message}</span>
    </div>
  {/each}
</div>
