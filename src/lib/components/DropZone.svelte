<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  // --- Adjust import path if handleDroppedPaths is elsewhere ---
  import { handleDroppedPaths } from '$lib/ts/dragDrop';
  // --- Import fsOperations baseFolder directly ---
  import { baseFolder } from '$lib/ts/fsOperations';
  import { normalizePath } from '$lib/ts/pathUtils';
  import { refreshLocalMaps } from '$lib/stores/localMapsStore';
  import { handleError } from '$lib/ts/errorHandler'; // Import error handler

  // Calculate relative path (should always be valid unless baseFolder is weird)
  const mapsPath = normalizePath(`${baseFolder}/Maps`);

  let isDraggingOver = false;
  let unlisten: (() => void) | null = null;

  onMount(async () => {
    try {
      const webview = await getCurrentWebview();
      unlisten = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type === 'over') {
          isDraggingOver = true;
        } else if (event.payload.type === 'leave') {
          isDraggingOver = false;
        } else if (event.payload.type === 'drop') {
          isDraggingOver = false;
          if (event.payload.paths && event.payload.paths.length > 0) {
            // --- ADD CHECK FOR mapsPath ---
            if (!mapsPath) {
                handleError("Cannot handle drop: Maps path destination is invalid.", "File Drop");
                return;
            }
            // --- END CHECK ---
            try {
              // Now mapsPath is guaranteed to be a string
              await handleDroppedPaths(event.payload.paths, mapsPath);
              await refreshLocalMaps(); // Refresh after successful drop handling
            } catch (error) {
               handleError(error, "Processing Dropped Files");
            }
          }
        }
      });
    } catch (error) {
         handleError(error, "Initializing Drag/Drop Listener");
    }
  });

  onDestroy(() => {
    unlisten?.();
  });
</script>

{#if isDraggingOver}
  <div class="fixed inset-0 top-16 z-50 flex items-center justify-center pointer-events-none bg-neutral/60 bg-opacity-75 backdrop-blur-sm">
    <div class="rounded-box p-8 bg-base-100 shadow-xl">
      <p class="text-xl font-bold text-base-content">Drop files or folders here</p>
      <p class="text-sm text-base-content/70">Target: {mapsPath ?? '...'}</p> <!-- Show target path -->
    </div>
  </div>
{/if}