<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getCurrentWebview } from '@tauri-apps/api/webview'
  import { handleDroppedPaths } from '$lib/services/dragDropService'
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
  import { refreshLocalMaps } from '$lib/stores/mapsStore'
  import { handleError } from '$lib/utils/errorHandler'

  let isDraggingOver = false
  let unlisten: (() => void) | null = null

  // Use a reactive statement to obtain mapsPath from your store:
  $: mapsPath = $mapsDirectory // This gives you an absolute path

  onMount(async () => {
    try {
      const webview = await getCurrentWebview()
      unlisten = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type === 'over') {
          isDraggingOver = true
        } else if (event.payload.type === 'leave') {
          isDraggingOver = false
        } else if (event.payload.type === 'drop') {
          isDraggingOver = false
          if (event.payload.paths && event.payload.paths.length > 0) {
            if (!mapsPath) {
              handleError(
                'Cannot handle drop: Maps path destination is invalid.',
                'File Drop',
              )
              return
            }
            try {
              await handleDroppedPaths(event.payload.paths, mapsPath)
              await refreshLocalMaps()
            } catch (error) {
              handleError(error, 'Processing Dropped Files')
            }
          }
        }
      })
    } catch (error) {
      handleError(error, 'Initializing Drag/Drop Listener')
    }
  })

  onDestroy(() => {
    unlisten?.()
  })
</script>

{#if isDraggingOver}
  <div
    class="fixed inset-0 top-16 z-50 flex items-center justify-center pointer-events-none bg-neutral/60 bg-opacity-75 backdrop-blur-sm"
  >
    <div class="rounded-box p-8 bg-base-100 shadow-xl">
      <p class="text-xl font-bold text-base-content">
        Drop files or folders here
      </p>
      <p class="text-sm text-base-content/70">Target: {mapsPath ?? '...'}</p>
    </div>
  </div>
{/if}
