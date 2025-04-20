<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { getCurrentWebview } from '@tauri-apps/api/webview'
  import { handleDroppedPaths } from '$lib/services/dragDropService'
  import { handleError } from '$lib/utils/errorHandler'

  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import Updater from '$lib/components/Updater.svelte'
  import GlobalDropOverlay from '$lib/components/GlobalDropOverlay.svelte'

  // DnD Store
  import { isDraggingOver, activeDropTargetInfo } from '$lib/stores/dndStore'

  // Path setup
  import {
    initializeGlobalPaths,
    initializeExplorerPaths,
    // Optionally import mapsDirectory if comparing paths instead of labels
    // mapsDirectory
  } from '$lib/stores/globalPathsStore'

  // Maps: remote + local
  // *** Import the function to refresh the local maps store ***
  import { refreshModioMaps, refreshLocalMaps } from '$lib/stores/mapsStore'

  // Explorer
  import { refreshExplorer, watchExplorer } from '$lib/stores/explorerStore'

  let unlistenExplorer: (() => void) | null = null
  let unlistenDragDrop: (() => void) | null = null

  onMount(async () => {
    console.log('[Layout] onMount executed')
    // Bootstrap paths
    await initializeGlobalPaths()
    await initializeExplorerPaths()

    // One‑time fetches
    await refreshModioMaps()
    await refreshExplorer() // Initial load for explorer
    // NOTE: Initial load for local maps might happen within ModioLayout/LocalMapList or need adding here if not done elsewhere
    // await refreshLocalMaps(); // Consider if needed here

    // Fire up watchers
    try {
      unlistenExplorer = await watchExplorer()
      console.log('[Layout] Explorer watcher attached.')
    } catch (error) {
      handleError(error, '[Layout] Initializing Explorer Watcher')
    }

    // --- Setup Global Drag and Drop Listener ---
    try {
      unlistenDragDrop = await getCurrentWebview().onDragDropEvent(
        async (event: any) => {
          const payload = event.payload
          if (payload.type === 'over') {
            isDraggingOver.set(true)
          } else if (payload.type === 'leave') {
            isDraggingOver.set(false)
          } else if (payload.type === 'drop') {
            isDraggingOver.set(false)
            const paths = payload.paths
            const targetInfo = get(activeDropTargetInfo)

            if (paths && paths.length > 0) {
              if (!targetInfo.path) {
                handleError(
                  'Cannot handle drop: No active target path set.',
                  'File Drop',
                )
                return
              }
              try {
                console.log(
                  `[DnD] Dropping ${paths.length} item(s) onto '${targetInfo.label || targetInfo.path}' at: ${targetInfo.path}`,
                )
                const result = await handleDroppedPaths(paths, targetInfo.path)

                // *** Refresh based on the target where the drop occurred ***
                if (result.success > 0) {
                  console.log(
                    '[DnD] Drop processed with successes, triggering refresh(es)...',
                  )

                  // Check which area was the target
                  if (targetInfo.label === 'Maps Folder') {
                    // Check label set by ModioLayout
                    console.log('[DnD] Refreshing local maps list...')
                    await refreshLocalMaps()
                    // Optionally refresh explorer too, in case user is viewing maps folder there
                    // await refreshExplorer();
                  } else {
                    // Assume other labeled targets or unlabeled paths fall under general explorer
                    console.log('[DnD] Refreshing explorer...')
                    await refreshExplorer()
                    // Optionally refresh maps too, although less likely needed
                    // await refreshLocalMaps();
                  }
                } else {
                  console.log(
                    '[DnD] Drop processed, but no successful operations to trigger refresh.',
                  )
                }
              } catch (error) {
                handleError(
                  error,
                  `Processing Dropped Files to ${targetInfo.label || targetInfo.path}`,
                )
              }
            }
          } else if (payload.type === 'cancel') {
            isDraggingOver.set(false)
          }
        },
      )
      console.log('[Layout] Drag/Drop listener attached.')
    } catch (error) {
      handleError(error, '[Layout] Initializing Drag/Drop Listener')
    }
    // --- End Drag and Drop Setup ---
  })

  onDestroy(() => {
    unlistenExplorer?.()
    unlistenDragDrop?.()
    console.log('[Layout] Cleaned up listeners.')
  })
</script>

<CrudModal />
<Toast />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />

<Updater />
<NavBar />
<slot />
