<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  // No longer need 'get', 'getCurrentWebview', 'handleDroppedPaths' here for DnD
  import { handleError } from '$lib/utils/errorHandler' // Keep error handler

  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import Updater from '$lib/components/Updater.svelte'
  import GlobalDropOverlay from '$lib/components/GlobalDropOverlay.svelte'

  // DnD Store - Import store values AND listener management functions
  import {
    isDraggingOver,
    activeDropTargetInfo,
    attachGlobalDropListener, // Import function to attach
    detachGlobalDropListener, // Import function to detach
  } from '$lib/stores/dndStore'

  // Path setup
  import {
    initializeGlobalPaths,
    initializeExplorerPaths,
  } from '$lib/stores/globalPathsStore'

  // Maps: remote + local
  import { refreshModioMaps } from '$lib/stores/mapsStore' // Keep refresh if needed on mount

  // Explorer
  import { refreshExplorer, watchExplorer } from '$lib/stores/explorerStore' // Keep refresh/watch

  let unlistenExplorer: (() => void) | null = null
  // Listener state (unlistenDragDrop) is now managed within dndStore

  onMount(async () => {
    console.log('[Layout] onMount executed')
    // Bootstrap paths
    await initializeGlobalPaths()
    await initializeExplorerPaths()

    // One‑time fetches
    await refreshModioMaps()
    await refreshExplorer()

    // Fire up watchers
    try {
      unlistenExplorer = await watchExplorer()
      console.log('[Layout] Explorer watcher attached.')
    } catch (error) {
      handleError(error, '[Layout] Initializing Explorer Watcher')
    }

    // --- Attach global drop listener via store ---
    // Remove the old listener setup block entirely
    console.log('[Layout] Requesting listener attach from dndStore...')
    await attachGlobalDropListener() // Initial attach managed by the store
  })

  onDestroy(() => {
    unlistenExplorer?.()
    // --- Detach global drop listener via store on layout destroy ---
    console.log('[Layout] Requesting listener detach from dndStore...')
    detachGlobalDropListener() // Cleanup managed by the store
    console.log('[Layout] Cleaned up listeners.')
  })
</script>

<CrudModal />
<Toast />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />

<Updater />
<NavBar />
<slot />
