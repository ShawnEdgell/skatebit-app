<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { handleDroppedPaths } from '$lib/ts/dragDrop';
  import { baseFolder } from '$lib/ts/fsOperations';
  import { normalizePath } from '$lib/ts/pathUtils';
  import { toastStore } from '$lib/stores/toastStore';
  // Import the refresh function from your local maps store.
  import { refreshLocalMaps } from '$lib/stores/localMapsStore';

  // Set fixed destination for dropped maps.
  const mapsPath = normalizePath(`${baseFolder}/Maps`);

  let isDraggingOver = false;
  let unlisten: (() => void) | null = null;

  onMount(async () => {
    const webview = await getCurrentWebview();
    unlisten = await webview.onDragDropEvent(async (event) => {
      if (event.payload.type === 'over') {
        isDraggingOver = true;
      } else if (event.payload.type === 'leave') {
        isDraggingOver = false;
      } else if (event.payload.type === 'drop') {
        isDraggingOver = false;
        if (event.payload.paths && event.payload.paths.length > 0) {
          try {
            await handleDroppedPaths(event.payload.paths, mapsPath);
            // Refresh the local maps store after handling the drop.
            await refreshLocalMaps();
          } catch (error) {
            console.error("Error processing drop:", error);
          }
        }
      }
    });
  });

  onDestroy(() => {
    unlisten?.();
  });
</script>

{#if isDraggingOver}
  <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none mt-16 bg-neutral/60 bg-opacity-75 backdrop-blur-sm">
    <div class="rounded-box p-8">
      <p class="text-xl font-bold">Drop files or folders here</p>
    </div>
  </div>
{/if}
